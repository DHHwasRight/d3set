//! Sample data: two live feeds, typed in Rust and written as JSON with jt.
//!
//! - `ops`: request logs from 24 hosts (latency, status, level, check).
//! - `sales`: orders (region, product, customer, amount, seats, funnel stage).
//!
//! The generator is seeded, so a restart replays the same history shape. History covers the
//! last minutes at the live rate, then a task appends a batch every 500 ms and pushes it to
//! every SSE subscriber as one JSON array.

use std::collections::VecDeque;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use d3set_ssr::time::iso;
use d3set_ssr::Row;
use tokio::sync::mpsc;

/// SplitMix64: small, fast, and seedable.
pub(crate) struct Rng(pub(crate) u64);

impl Rng {
    pub(crate) fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    /// Uniform in [0, 1).
    pub(crate) fn f(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
    pub(crate) fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[(self.next() % items.len() as u64) as usize]
    }
}

pub const SERVICES: [&str; 4] = ["api", "billing", "web", "worker"];
pub const REGIONS: [&str; 4] = ["APAC", "EU", "LATAM", "US"];
const PRODUCTS: [&str; 3] = ["Starter", "Pro", "Enterprise"];
const CUSTOMERS: [&str; 8] = [
    "Acme", "Globex", "Hooli", "Initech", "Stark", "Umbrella", "Wayne", "Wonka",
];
const PATHS: [&str; 4] = ["invoices", "customers", "events", "plans"];

struct Host {
    name: String,
    service: &'static str,
    region: &'static str,
    slow: f64,
}

/// One request log line.
pub struct Request {
    pub id: u64,
    pub at: f64,
    pub host: Arc<str>,
    pub service: &'static str,
    pub region: &'static str,
    pub latency: u32,
    pub status: u16,
    pub errors: u8,
    pub level: &'static str,
    pub check: &'static str,
    pub message: String,
}

/// One order.
pub struct Sale {
    pub id: u64,
    pub at: f64,
    pub region: &'static str,
    pub product: &'static str,
    pub customer: &'static str,
    pub amount: u32,
    pub seats: u32,
    pub stage: &'static str,
}

jt::load!("src/feeds.jt");

impl Request {
    pub fn row(&self) -> Row {
        Row::new()
            .with("id", self.id as i64)
            .with("at", iso(self.at))
            .with("host", &*self.host)
            .with("service", self.service)
            .with("region", self.region)
            .with("latency", self.latency)
            .with("status", u32::from(self.status))
            .with("errors", u32::from(self.errors))
            .with("level", self.level)
            .with("check", self.check)
            .with("message", self.message.as_str())
    }
}

impl Sale {
    pub fn row(&self) -> Row {
        Row::new()
            .with("id", self.id as i64)
            .with("at", iso(self.at))
            .with("region", self.region)
            .with("product", self.product)
            .with("customer", self.customer)
            .with("amount", self.amount)
            .with("seats", self.seats)
            .with("stage", self.stage)
    }
}

/// A feed: recent rows, and the SSE subscribers waiting for the next batch.
pub struct Feed<T> {
    rows: Mutex<VecDeque<T>>,
    subscribers: Mutex<Vec<mpsc::UnboundedSender<Arc<Vec<u8>>>>>,
    capacity: usize,
}

impl<T> Feed<T> {
    fn new(capacity: usize) -> Self {
        Self {
            rows: Mutex::new(VecDeque::new()),
            subscribers: Mutex::new(Vec::new()),
            capacity,
        }
    }

    fn push(&self, batch: Vec<T>, frame: Vec<u8>) {
        let mut rows = self.rows.lock().expect("feed lock");
        rows.extend(batch);
        while rows.len() > self.capacity {
            rows.pop_front();
        }
        drop(rows);
        let frame = Arc::new(frame);
        // A closed connection has dropped its receiver; forget it.
        self.subscribers
            .lock()
            .expect("feed lock")
            .retain(|tx| tx.send(frame.clone()).is_ok());
    }

    /// Run `f` on the rows, oldest first.
    pub fn with_rows<R>(&self, f: impl FnOnce(&VecDeque<T>) -> R) -> R {
        f(&self.rows.lock().expect("feed lock"))
    }

    pub fn subscribe(&self) -> mpsc::UnboundedReceiver<Arc<Vec<u8>>> {
        let (tx, rx) = mpsc::unbounded_channel();
        self.subscribers.lock().expect("feed lock").push(tx);
        rx
    }
}

struct Generator {
    rng: Rng,
    hosts: Vec<Host>,
    next_request: u64,
    next_sale: u64,
}

impl Generator {
    fn new() -> Self {
        let mut rng = Rng(0x0d3_5e7);
        let hosts = (0..24)
            .map(|i| Host {
                name: format!("host-{:02}", i + 1),
                service: SERVICES[i % 4],
                region: REGIONS[i % 3 + usize::from(i % 7 == 0)],
                slow: 1.0 + rng.f() * 1.6,
            })
            .collect();
        Self {
            rng,
            hosts,
            next_request: 0,
            next_sale: 0,
        }
    }

    fn request(&mut self, at: f64) -> Request {
        let r = &mut self.rng;
        let host = &self.hosts[(r.next() % self.hosts.len() as u64) as usize];
        // Log-normal latency, a slow tail, and hosts that are slower than others.
        let spike = if r.f() < 0.04 { 1.4 } else { 0.0 };
        let latency = ((4.2 + r.f() * 0.9 + spike).exp() * host.slow).round() as u32;
        let error = r.f() < 0.02 + if latency > 600 { 0.25 } else { 0.0 };
        self.next_request += 1;
        let (method, path) = (*r.pick(&["GET", "GET", "POST", "PUT"]), *r.pick(&PATHS));
        Request {
            id: self.next_request,
            at,
            host: host.name.as_str().into(),
            service: host.service,
            region: host.region,
            latency,
            status: if error { 500 } else { 200 },
            errors: u8::from(error),
            level: if error {
                "error"
            } else if latency > 400 {
                "warn"
            } else {
                "info"
            },
            check: if error {
                "critical"
            } else if latency > 400 {
                "warning"
            } else {
                "ok"
            },
            message: format!(
                "{method} /{}/{path} {} {latency}ms",
                host.service,
                if error { 500 } else { 200 }
            ),
        }
    }

    fn sale(&mut self, at: f64) -> Sale {
        let r = &mut self.rng;
        self.next_sale += 1;
        let product = *r.pick(&PRODUCTS);
        let base = match product {
            "Starter" => 40.0,
            "Pro" => 180.0,
            _ => 420.0,
        };
        Sale {
            id: self.next_sale,
            at,
            region: r.pick(&REGIONS),
            product,
            customer: r.pick(&CUSTOMERS),
            amount: (base * (0.6 + r.f() * 0.9)).round() as u32,
            seats: 1 + (r.f().powi(2) * 48.0) as u32,
            stage: r.pick(&[
                "Visited",
                "Visited",
                "Visited",
                "Visited",
                "Signed up",
                "Signed up",
                "Signed up",
                "Trial",
                "Trial",
                "Paid",
            ]),
        }
    }
}

/// Requests: 0–2 per 500 ms tick, about 2 a second. Sales: about one every 2 seconds.
const TICK: Duration = Duration::from_millis(500);
const OPS_HISTORY: f64 = 15.0 * 60_000.0;
const SALES_HISTORY: f64 = 30.0 * 60_000.0;

pub static OPS: LazyLock<Feed<Request>> = LazyLock::new(|| Feed::new(4000));
pub static SALES: LazyLock<Feed<Sale>> = LazyLock::new(|| Feed::new(2000));
static GENERATOR: LazyLock<Mutex<Generator>> = LazyLock::new(|| Mutex::new(Generator::new()));

/// `GALLERY_NOW=2026-10-01T00:00:00Z`: a fixed clock, for galleries that must draw the same rows
/// (the conformity tests of `galleries/`). The history ends at that instant and the live feeds
/// send nothing. Unset, the clock is the system's and the feeds are live.
pub static FROZEN: LazyLock<Option<f64>> = LazyLock::new(|| {
    std::env::var("GALLERY_NOW")
        .ok()
        .and_then(|v| d3set_ssr::time::parse_iso(v.trim()))
});

pub fn now() -> f64 {
    FROZEN.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0.0, |d| d.as_millis() as f64)
    })
}

fn requests_frame(batch: &[Request]) -> Vec<u8> {
    let refs: Vec<&Request> = batch.iter().collect();
    format!("data: {}\n\n", jt::to_string(&RequestsJson(&refs))).into_bytes()
}

fn sales_frame(batch: &[Sale]) -> Vec<u8> {
    let refs: Vec<&Sale> = batch.iter().collect();
    format!("data: {}\n\n", jt::to_string(&SalesJson(&refs))).into_bytes()
}

/// Fill the history, then append a batch every tick. Call once, inside the runtime.
pub fn start() {
    let t = now();
    {
        let mut g = GENERATOR.lock().expect("generator lock");
        let mut at = t - OPS_HISTORY;
        let mut history = Vec::new();
        while at < t {
            history.push(g.request(at));
            // About 2 requests a second, the same rate as the live batches below.
            at += 250.0 + g.rng.f() * 500.0;
        }
        OPS.push(history, Vec::new());
        let mut at = t - SALES_HISTORY;
        let mut history = Vec::new();
        while at < t {
            history.push(g.sale(at));
            at += 500.0 + g.rng.f() * 3000.0;
        }
        SALES.push(history, Vec::new());
    }
    // A fixed clock has no future: the feeds keep their history.
    if FROZEN.is_some() {
        return;
    }
    tokio::spawn(async {
        let mut tick = tokio::time::interval(TICK);
        loop {
            tick.tick().await;
            let at = now();
            let (requests, sales) = {
                let mut g = GENERATOR.lock().expect("generator lock");
                let n = (g.rng.next() % 3) as usize;
                let requests: Vec<Request> = (0..n)
                    .map(|i| g.request(at - (n - 1 - i) as f64 * 120.0))
                    .collect();
                // An empty batch still goes out: it costs one small frame and keeps proxies from closing the stream.
                let sales: Vec<Sale> = if g.rng.f() < 0.25 {
                    vec![g.sale(at)]
                } else {
                    vec![]
                };
                (requests, sales)
            };
            let frame = requests_frame(&requests);
            OPS.push(requests, frame);
            if !sales.is_empty() {
                let frame = sales_frame(&sales);
                SALES.push(sales, frame);
            }
        }
    });
}

/// The last `limit` rows of a feed as d3set rows, for server rendering.
pub fn ops_rows(limit: usize) -> Vec<Row> {
    OPS.with_rows(|rows| {
        rows.iter()
            .skip(rows.len().saturating_sub(limit))
            .map(Request::row)
            .collect()
    })
}

pub fn sales_rows(limit: usize) -> Vec<Row> {
    SALES.with_rows(|rows| {
        rows.iter()
            .skip(rows.len().saturating_sub(limit))
            .map(Sale::row)
            .collect()
    })
}

/// A feed as a JSON array, written by jt.
pub fn feed_json(feed: &str, limit: usize) -> Option<String> {
    match feed {
        "ops" => Some(OPS.with_rows(|rows| {
            let refs: Vec<&Request> = rows.iter().skip(rows.len().saturating_sub(limit)).collect();
            jt::to_string(&RequestsJson(&refs))
        })),
        "sales" => Some(SALES.with_rows(|rows| {
            let refs: Vec<&Sale> = rows.iter().skip(rows.len().saturating_sub(limit)).collect();
            jt::to_string(&SalesJson(&refs))
        })),
        _ => None,
    }
}

/// Frames for one SSE connection, after its first frame.
pub type Frames = mpsc::UnboundedReceiver<Arc<Vec<u8>>>;

/// The first frame for a new connection: rows newer than `since` as an `upsert`, or the whole feed as a `replace`.
pub fn catch_up(feed: &str, since: Option<f64>) -> Option<(Vec<u8>, Frames)> {
    fn frame<T>(
        feed: &Feed<T>,
        since: Option<f64>,
        at: impl Fn(&T) -> f64,
        json: impl Fn(&[&T]) -> String,
    ) -> (Vec<u8>, Frames) {
        // Subscribe under the rows lock, so no batch falls between the catch-up and the first live frame.
        let rows = feed.rows.lock().expect("feed lock");
        let rx = feed.subscribe();
        let picked: Vec<&T> = rows
            .iter()
            .filter(|r| since.is_none_or(|s| at(r) > s))
            .collect();
        // A catch-up may replay rows the page already has: `upsert` (by id) makes that harmless.
        let op = if since.is_some() { "upsert" } else { "replace" };
        let body = jt::to_string(&Envelope(op, jt::Raw(&json(&picked))));
        (format!("data: {body}\n\n").into_bytes(), rx)
    }
    match feed {
        "ops" => Some(frame(
            &OPS,
            since,
            |r| r.at,
            |rs| jt::to_string(&RequestsJson(rs)),
        )),
        "sales" => Some(frame(
            &SALES,
            since,
            |s| s.at,
            |rs| jt::to_string(&SalesJson(rs)),
        )),
        _ => None,
    }
}
