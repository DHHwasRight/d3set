//! Sample billing data for the Analytics page: customers, subscriptions, invoices,
//! payments, dunning, prepaid credits, and usage over the last 24 months: a 12-month period and
//! the 12 months before it, which the big numbers compare against.
//!
//! The model is seeded and built once, so every view reads the same history. The values are
//! invented. Each view gets one row set (`rows(view)`): the charts of a view share it, and
//! `set=...` / other `where` options pick the rows each chart reads.

use std::sync::LazyLock;

use d3set_ssr::Row;

use crate::data::Rng;

/// Months of history, the current month included.
pub const MONTHS: i32 = 24;

const COUNTRIES: [(&str, &str); 6] = [
    ("US", "USD"),
    ("US", "USD"),
    ("CA", "USD"),
    ("FR", "EUR"),
    ("DE", "EUR"),
    ("GB", "GBP"),
];
const FIRST: [&str; 16] = [
    "Acme", "Blue", "Cobalt", "Delta", "Ember", "Fable", "Granite", "Harbor", "Iris", "Juniper",
    "Kite", "Lumen", "Maple", "Nimbus", "Orbit", "Quartz",
];
const SECOND: [&str; 4] = ["Labs", "Cloud", "AI", "Systems"];

struct Plan {
    name: &'static str,
    code: &'static str,
    /// Monthly amount; yearly plans are billed monthly here, as their monthly share.
    amount: f64,
    interval: &'static str,
    metrics: &'static [usize],
    /// Minimum monthly usage spend, topped up as a commitment fee.
    commitment: f64,
}

struct Metric {
    name: &'static str,
    code: &'static str,
    /// Units a typical customer uses in a month.
    base: f64,
    price: f64,
}

const METRICS: [Metric; 5] = [
    Metric {
        name: "API calls",
        code: "api_calls",
        base: 180_000.0,
        price: 0.0004,
    },
    Metric {
        name: "Storage (GB)",
        code: "storage_gb",
        base: 420.0,
        price: 0.08,
    },
    Metric {
        name: "Input tokens",
        code: "tokens_input",
        base: 9_000_000.0,
        price: 0.000_003,
    },
    Metric {
        name: "Output tokens",
        code: "tokens_output",
        base: 2_400_000.0,
        price: 0.000_012,
    },
    Metric {
        name: "Seats",
        code: "seats",
        base: 14.0,
        price: 9.0,
    },
];

const PLANS: [Plan; 6] = [
    Plan {
        name: "Starter",
        code: "starter",
        amount: 49.0,
        interval: "monthly",
        metrics: &[0],
        commitment: 0.0,
    },
    Plan {
        name: "Growth",
        code: "growth",
        amount: 199.0,
        interval: "monthly",
        metrics: &[0, 1],
        commitment: 0.0,
    },
    Plan {
        name: "Scale",
        code: "scale",
        amount: 799.0,
        interval: "monthly",
        metrics: &[0, 1, 4],
        commitment: 0.0,
    },
    Plan {
        name: "Enterprise",
        code: "enterprise",
        amount: 2400.0,
        interval: "yearly",
        metrics: &[0, 1, 4],
        commitment: 600.0,
    },
    Plan {
        name: "AI Tokens",
        code: "ai_tokens",
        amount: 0.0,
        interval: "monthly",
        metrics: &[2, 3],
        commitment: 0.0,
    },
    Plan {
        name: "Agent SDK",
        code: "agent_sdk",
        amount: 99.0,
        interval: "monthly",
        metrics: &[0, 2, 3],
        commitment: 0.0,
    },
];

/// The plan a subscription moves to on an upgrade.
fn upgrade(plan: usize) -> usize {
    match plan {
        0 => 1,
        1 => 2,
        2 => 3,
        4 => 5,
        5 => 2,
        p => p,
    }
}

struct Customer {
    name: String,
    external_id: String,
    email: String,
    country: &'static str,
    currency: &'static str,
    kind: &'static str,
    wallet: bool,
    /// Usage scale: 0.3 to 3 times the typical customer.
    size: f64,
}

struct Subscription {
    id: usize,
    customer: usize,
    plan: usize,
    /// Month index of activation; negative: before the window.
    start: i32,
    start_day: u32,
    /// Termination: month index, day, and why.
    end: Option<(i32, u32, &'static str)>,
    previous: Option<usize>,
    next: Option<usize>,
    overridden: bool,
}

impl Subscription {
    fn active(&self, m: i32) -> bool {
        self.start <= m && self.end.is_none_or(|(e, _, _)| m < e)
    }
}

struct Invoice {
    number: String,
    customer: usize,
    plan: Option<usize>,
    month: i32,
    day: u32,
    kind: &'static str,
    status: &'static str,
    payment_status: &'static str,
    amount: f64,
    paid: f64,
    /// Payment attempts: day offset from issue, and the error of a failed one.
    attempts: Vec<(u32, Option<&'static str>)>,
    method: &'static str,
}

struct Model {
    year: i32,
    month: u32,
    customers: Vec<Customer>,
    subscriptions: Vec<Subscription>,
    invoices: Vec<Invoice>,
    /// Prepaid credit movements: customer, month, type, amount (negative: consumed or voided).
    credits: Vec<(usize, i32, &'static str, f64)>,
    /// Usage: subscription, month, metric, units, amount.
    usage: Vec<(usize, i32, usize, f64, f64)>,
}

static MODEL: LazyLock<Model> = LazyLock::new(|| Model::build(crate::data::now()));

/// Calendar month of index `m` (0 is the oldest of the window).
fn ym(model: &Model, m: i32) -> (i32, u32) {
    let total = model.year * 12 + model.month as i32 - 1 - (MONTHS - 1 - m);
    (total.div_euclid(12), (total.rem_euclid(12) + 1) as u32)
}

fn date(model: &Model, m: i32, day: u32) -> String {
    let (y, mo) = ym(model, m);
    format!("{y:04}-{mo:02}-{day:02}")
}

/// `2026-03`: a month as a category that sorts in time order.
fn period(model: &Model, m: i32) -> String {
    let (y, mo) = ym(model, m);
    format!("{y:04}-{mo:02}")
}

/// The weekday of a date. Charts put them on a fixed Sunday–Saturday axis (`WEEK`).
fn weekday(iso: &str) -> &'static str {
    const DAYS: [&str; 7] = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
    let days = d3set_ssr::time::parse_iso(iso).map_or(0, |ms| (ms / 86_400_000.0).floor() as i64);
    DAYS[days.rem_euclid(7) as usize]
}

/// `finalized` → `Finalized`: statuses as the charts label (and color) them.
fn title(s: &str) -> String {
    let mut c = s.chars();
    c.next().map_or_else(String::new, |f| {
        f.to_uppercase().collect::<String>() + c.as_str()
    })
}

fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

impl Model {
    fn build(now: f64) -> Model {
        let iso = d3set_ssr::time::iso(now);
        let year: i32 = iso[0..4].parse().unwrap_or(2026);
        let month: u32 = iso[5..7].parse().unwrap_or(1);
        let mut rng = Rng(0x1A60);
        let mut model = Model {
            year,
            month,
            customers: Vec::new(),
            subscriptions: Vec::new(),
            invoices: Vec::new(),
            credits: Vec::new(),
            usage: Vec::new(),
        };

        for i in 0..FIRST.len() * SECOND.len() {
            let name = format!("{} {}", FIRST[i % FIRST.len()], SECOND[i / FIRST.len()]);
            let slug = name.to_lowercase().replace(' ', "-");
            let (country, currency) = *rng.pick(&COUNTRIES);
            model.customers.push(Customer {
                external_id: format!("cus_{slug}"),
                email: format!("billing@{slug}.example"),
                name,
                country,
                currency,
                kind: if rng.f() < 0.2 {
                    "individual"
                } else {
                    "company"
                },
                wallet: rng.f() < 0.3,
                size: 0.3 + rng.f() * rng.f() * 2.7,
            });
        }

        // Subscriptions: most customers start in the window, later more often (the business grows).
        for c in 0..model.customers.len() {
            let start = if rng.f() < 0.3 {
                -1 - (rng.f() * 12.0) as i32
            } else {
                (rng.f().sqrt() * f64::from(MONTHS)) as i32
            };
            let weights = [0.26, 0.24, 0.16, 0.06, 0.16, 0.12];
            let mut pick = rng.f();
            let mut plan = 0;
            for (p, w) in weights.iter().enumerate() {
                if pick < *w {
                    plan = p;
                    break;
                }
                pick -= w;
            }
            model.lifecycle(&mut rng, c, plan, start, None);
        }

        model.bill(&mut rng);
        model
    }

    /// One subscription and the ones that replace it on upgrades.
    fn lifecycle(
        &mut self,
        rng: &mut Rng,
        customer: usize,
        plan: usize,
        start: i32,
        previous: Option<usize>,
    ) {
        let id = self.subscriptions.len();
        let start_day = 1 + (rng.next() % 28) as u32;
        let mut end = None;
        let mut next = None;
        for m in start.max(0)..MONTHS {
            if m == start {
                continue;
            }
            let roll = rng.f();
            if roll < 0.025 {
                let why = *rng.pick(&["churned", "churned", "non_payment", "downgraded_to_free"]);
                end = Some((m, 1 + (rng.next() % 28) as u32, why));
                break;
            }
            if roll < 0.06 && upgrade(plan) != plan {
                end = Some((m, 1 + (rng.next() % 28) as u32, "plan_change"));
                next = Some(upgrade(plan));
                break;
            }
        }
        self.subscriptions.push(Subscription {
            id,
            customer,
            plan,
            start,
            start_day,
            end,
            previous,
            next,
            overridden: rng.f() < 0.1,
        });
        if let (Some(next), Some((m, _, _))) = (next, end) {
            self.lifecycle(rng, customer, next, m, Some(plan));
        }
    }

    /// Invoices, payments, usage, and credits for every month of every subscription.
    fn bill(&mut self, rng: &mut Rng) {
        let mut number = 1000;
        let mut invoice = |model: &mut Model,
                           rng: &mut Rng,
                           customer: usize,
                           plan: Option<usize>,
                           m: i32,
                           day: u32,
                           kind: &'static str,
                           amount: f64| {
            number += 1;
            let age = MONTHS - 1 - m;
            let currency = model.customers[customer].currency;
            let method = match (currency, rng.f()) {
                ("EUR", r) if r < 0.4 => "sepa_debit",
                ("USD", r) if r < 0.2 => "us_bank_account",
                ("GBP", r) if r < 0.3 => "bacs_debit",
                _ => "card",
            };
            let status = if rng.f() < 0.02 {
                "voided"
            } else {
                "finalized"
            };
            let mut attempts = Vec::new();
            let mut payment_status = "pending";
            if status == "finalized" && amount > 0.0 {
                // A first attempt on the issue day, then dunning every few days.
                let mut day_offset = 0;
                for attempt in 0..4 {
                    if age == 0 && day_offset > 6 {
                        break;
                    }
                    let fails = rng.f() < if attempt == 0 { 0.14 } else { 0.45 };
                    if fails {
                        let error = *rng.pick(&[
                            "card_declined",
                            "insufficient_funds",
                            "expired_card",
                            "authentication_required",
                            "processing_error",
                        ]);
                        attempts.push((day_offset, Some(error)));
                        payment_status = "failed";
                        day_offset += 2 + (rng.next() % 6) as u32;
                    } else {
                        attempts.push((day_offset, None));
                        payment_status = "succeeded";
                        break;
                    }
                }
                // The newest invoices are still being collected.
                if age == 0 && rng.f() < 0.5 {
                    attempts.clear();
                    payment_status = "pending";
                }
            }
            let paid = if payment_status == "succeeded" {
                amount
            } else {
                0.0
            };
            model.invoices.push(Invoice {
                number: format!("INV-{number:05}"),
                customer,
                plan,
                month: m,
                day,
                kind,
                status,
                payment_status,
                amount: round2(amount),
                paid: round2(paid),
                attempts,
                method,
            });
        };

        for s in 0..self.subscriptions.len() {
            let (customer, plan, start, start_day) = {
                let sub = &self.subscriptions[s];
                (sub.customer, sub.plan, sub.start, sub.start_day)
            };
            let size = self.customers[customer].size;
            for m in 0..MONTHS {
                if !self.subscriptions[s].active(m) {
                    continue;
                }
                // Usage grows over the life of the subscription, with monthly noise.
                let age = f64::from(m - start).max(0.0);
                let mut spend = 0.0;
                for &k in PLANS[plan].metrics {
                    let metric = &METRICS[k];
                    let units =
                        (metric.base * size * (0.6 + age * 0.05) * (0.75 + rng.f() * 0.5)).round();
                    let amount = round2(units * metric.price);
                    spend += amount;
                    self.usage.push((s, m, k, units, amount));
                }
                let fee = if self.subscriptions[s].overridden {
                    PLANS[plan].amount * 0.85
                } else {
                    PLANS[plan].amount
                };
                let commitment = (PLANS[plan].commitment - spend).max(0.0);
                let day = if m == start { start_day } else { 1 };
                invoice(
                    self,
                    rng,
                    customer,
                    Some(plan),
                    m,
                    day,
                    "subscription",
                    fee + spend + commitment,
                );
                if rng.f() < 0.03 {
                    let one_off = 150.0 + (rng.f() * 18.0).round() * 100.0;
                    let day = 5 + (rng.next() % 20) as u32;
                    invoice(self, rng, customer, Some(plan), m, day, "one_off", one_off);
                }
            }
        }

        // Prepaid credits: wallets are topped up, sometimes credits are offered, usage consumes them.
        for c in 0..self.customers.len() {
            if !self.customers[c].wallet {
                continue;
            }
            let first = (rng.f() * f64::from(MONTHS / 2)) as i32;
            let mut balance = 0.0;
            for m in first..MONTHS {
                if m == first || balance < 100.0 || rng.f() < 0.15 {
                    let amount = (2.0 + (rng.f() * 8.0).round()) * 50.0;
                    balance += amount;
                    self.credits.push((c, m, "Purchased credits", amount));
                    let day = 1 + (rng.next() % 27) as u32;
                    invoice(self, rng, c, None, m, day, "credit", amount);
                }
                if rng.f() < 0.12 {
                    let amount = (1.0 + (rng.f() * 3.0).round()) * 25.0;
                    balance += amount;
                    self.credits.push((c, m, "Offered credits", amount));
                }
                let consumed = round2((balance * (0.2 + rng.f() * 0.4)).min(balance));
                balance -= consumed;
                self.credits.push((c, m, "Consumed credits", -consumed));
                if rng.f() < 0.03 && balance > 0.0 {
                    let voided = round2(balance * 0.5);
                    balance -= voided;
                    self.credits.push((c, m, "Voided credits", -voided));
                }
            }
        }
    }

    fn base(&self, customer: usize, m: i32) -> Row {
        let c = &self.customers[customer];
        Row::new()
            .with("month", date(self, m, 1))
            .with("period", period(self, m))
            .with("currency", c.currency)
            // The same value under the header the pivot tables show.
            .with("Currency", c.currency)
            .with("customer_country", c.country)
            .with("customer_type", c.kind)
            .with("customer_name", c.name.as_str())
            // One category for a split drawn as a single bar (inline bars); no label.
            .with("all", "")
    }
}

/// The fixed weekday axis, Sunday first, as a d3set `categories` option.
pub const WEEK: &str = "Sun|Mon|Tue|Wed|Thu|Fri|Sat";

/// Billable metrics, code and name, in name order.
pub fn metrics() -> Vec<(&'static str, &'static str)> {
    let mut m: Vec<_> = METRICS.iter().map(|m| (m.code, m.name)).collect();
    m.sort_by(|a, b| d3set_ssr::agg::by_name(a.1, b.1));
    m
}

/// The views of the Analytics page, by id.
pub fn rows(view: &str) -> Vec<Row> {
    let model = &*MODEL;
    let last = MONTHS - 1;
    let subs = &model.subscriptions;
    let plan_of = |s: &Subscription| &PLANS[s.plan];
    let sub_row = |s: &Subscription, m: i32| {
        let p = plan_of(s);
        model
            .base(s.customer, m)
            .with("plan_name", p.name)
            .with("Plan", p.name)
            .with("plan_code", p.code)
            .with("subscription_external_id", format!("sub_{:04}", s.id))
            .with(
                "customer_external_id",
                model.customers[s.customer].external_id.as_str(),
            )
            .with("billing_interval", p.interval)
            .with("is_override", s.overridden)
    };
    match view {
        // Monthly snapshots for the trend; one line per active subscription for the rest.
        "subscriptions-active" => {
            let mut rows = Vec::new();
            for s in subs {
                for m in 0..MONTHS {
                    if s.active(m) {
                        rows.push(
                            model
                                .base(s.customer, m)
                                .with("set", "snapshot")
                                .with("plan_name", plan_of(s).name)
                                .with("Plan", plan_of(s).name)
                                .with("active_subscriptions", 1u32),
                        );
                    }
                }
            }
            for s in subs.iter().filter(|s| s.active(last)) {
                let activated = date(model, s.start.max(0), s.start_day);
                let days = f64::from((last - s.start) * 30).max(0.0);
                rows.push(
                    sub_row(s, last)
                        .with("set", "current")
                        .with(
                            "activated_on",
                            if s.start < 0 {
                                format!("before {}", date(model, 0, 1))
                            } else {
                                activated
                            },
                        )
                        .with("active_subscriptions", 1u32)
                        .with("days_active", days)
                        .with("is_plan_change", s.previous.is_some()),
                );
            }
            rows
        }
        "subscriptions-new" => subs
            .iter()
            .filter(|s| s.start >= 0)
            .map(|s| {
                let activated = date(model, s.start, s.start_day);
                sub_row(s, s.start)
                    .with("weekday", weekday(&activated))
                    .with("activated_on", activated)
                    .with("new_subscriptions", 1u32)
                    .with(
                        "current_status",
                        if s.active(last) {
                            "active"
                        } else {
                            "terminated"
                        },
                    )
                    .with(
                        "subscription_type",
                        if s.previous.is_some() {
                            "Plan change"
                        } else {
                            "New"
                        },
                    )
                    .with(
                        "previous_plan_name",
                        s.previous.map_or("", |p| PLANS[p].name),
                    )
            })
            .collect(),
        "subscriptions-churn" => subs
            .iter()
            .filter_map(|s| s.end.map(|e| (s, e)))
            .map(|(s, (m, day, why))| {
                let terminated = date(model, m, day);
                let alive = (m - s.start) * 30 + day as i32 - s.start_day as i32;
                sub_row(s, m)
                    .with("weekday", weekday(&terminated))
                    .with("terminated_on", terminated)
                    .with(
                        "termination",
                        if why == "plan_change" {
                            "Plan changes"
                        } else {
                            "Terminations"
                        },
                    )
                    .with("terminations", 1u32)
                    .with("termination_category", why)
                    .with("plan_amount", plan_of(s).amount)
                    .with("days_alive", f64::from(alive.max(0)))
                    .with("next_plan_name", s.next.map_or("", |p| PLANS[p].name))
            })
            .collect(),
        "revenue-streams" => {
            let mut rows = Vec::new();
            for inv in model.invoices.iter().filter(|i| i.status == "finalized") {
                let plan = inv.plan.map_or("Wallet", |p| PLANS[p].name);
                let mut push = |section: &str, amount: f64| {
                    // Cents: float leftovers of a subtraction are not a stream.
                    if amount.abs() >= 0.005 {
                        rows.push(
                            model
                                .base(inv.customer, inv.month)
                                .with("set", if amount < 0.0 { "contra" } else { "gross" })
                                .with("Stream", section)
                                .with("breakdown", plan)
                                .with("plan_name", plan)
                                .with("Plan", plan)
                                .with("revenue_amount", round2(amount)),
                        );
                    }
                };
                match (inv.kind, inv.plan) {
                    ("subscription", Some(p)) => {
                        let usage: f64 = model
                            .usage
                            .iter()
                            .filter(|u| {
                                u.1 == inv.month
                                    && subs[u.0].customer == inv.customer
                                    && subs[u.0].plan == p
                            })
                            .map(|u| u.4)
                            .sum();
                        let fee = PLANS[p].amount.min(inv.amount - usage).max(0.0);
                        push("Subscription fee", fee);
                        push("Usage-based fee", usage);
                        push("Commitment fee", inv.amount - fee - usage);
                        // Contra revenue, below zero: a coupon on some invoices, a credit note now and then.
                        let seed = inv
                            .number
                            .bytes()
                            .fold(7u32, |h, b| h.wrapping_mul(31).wrapping_add(u32::from(b)));
                        if seed % 11 == 0 {
                            push("Coupons", -round2(fee * 0.15));
                        }
                        if seed % 37 == 0 {
                            push("Credit notes", -round2(inv.amount * 0.5));
                        }
                    }
                    ("one_off", _) => push("One-off fee", inv.amount),
                    // Wallet top-ups are not revenue until used: the spend counts in its own stream.
                    _ => {}
                }
            }
            // Credits pay part of the invoices: prepaid (purchased) and free (offered) credits.
            for &(c, m, kind, amount) in &model.credits {
                let section = match kind {
                    "Consumed credits" => "Prepaid credits",
                    "Offered credits" => "Free credits",
                    _ => continue,
                };
                let amount = if kind == "Offered credits" {
                    -amount
                } else {
                    amount
                };
                rows.push(
                    model
                        .base(c, m)
                        .with("set", "contra")
                        .with("Stream", section)
                        .with("breakdown", "Wallet")
                        .with("plan_name", "Wallet")
                        .with("Plan", "Wallet")
                        .with("revenue_amount", round2(amount)),
                );
            }
            // The breakout's line order is the order lines first appear: gross, then contra.
            let order = [
                "Subscription fee",
                "Usage-based fee",
                "Commitment fee",
                "One-off fee",
                "Coupons",
                "Credit notes",
                "Prepaid credits",
                "Free credits",
            ];
            rows.sort_by_key(|r| {
                order
                    .iter()
                    .position(|o| r.get("Stream").as_str() == Some(o))
            });
            rows
        }
        // MRR as the breakout reads it: Starting MRR, the movements, Ending MRR. Starting and
        // Ending are stocks (one line per active subscription), so filters apply to them too.
        "revenue-mrr" => {
            let mut rows = Vec::new();
            let mut starting = Vec::new();
            let mut ending = Vec::new();
            for s in subs.iter().filter(|s| plan_of(s).amount > 0.0) {
                let stock = |m: i32, section: &str| {
                    model
                        .base(s.customer, m)
                        .with("Movement", section)
                        .with("breakdown", plan_of(s).name)
                        .with("plan_name", plan_of(s).name)
                        .with("Plan", plan_of(s).name)
                        .with("mrr_amount", plan_of(s).amount)
                };
                for m in 0..MONTHS {
                    if s.active(m - 1) {
                        starting.push(stock(m, "Starting MRR"));
                    }
                    if s.active(m) {
                        ending.push(stock(m, "Ending MRR"));
                    }
                }
            }
            for s in subs {
                let amount = plan_of(s).amount;
                if amount == 0.0 {
                    continue;
                }
                let push = |rows: &mut Vec<Row>, m: i32, section: &str, v: f64| {
                    if (0..MONTHS).contains(&m) {
                        rows.push(
                            model
                                .base(s.customer, m)
                                .with("Movement", section)
                                .with("breakdown", plan_of(s).name)
                                .with("plan_name", plan_of(s).name)
                                .with("Plan", plan_of(s).name)
                                .with("mrr_amount", v),
                        );
                    }
                };
                match s.previous {
                    Some(p) if PLANS[p].amount <= amount => {
                        push(&mut rows, s.start, "Expansion", amount - PLANS[p].amount)
                    }
                    Some(p) => push(&mut rows, s.start, "Contraction", amount - PLANS[p].amount),
                    None => push(&mut rows, s.start, "New", amount),
                }
                if let Some((m, _, why)) = s.end {
                    if why != "plan_change" {
                        push(&mut rows, m, "Churn", -amount);
                    }
                }
            }
            // The breakout's line order is the order lines first appear.
            let order = ["New", "Expansion", "Contraction", "Churn"];
            rows.sort_by_key(|r| {
                order
                    .iter()
                    .position(|o| r.get("Movement").as_str() == Some(o))
            });
            starting.extend(rows);
            starting.extend(ending);
            starting
        }
        "credit-ledgers" => {
            let mut rows: Vec<Row> = model
                .credits
                .iter()
                .map(|&(c, m, kind, amount)| {
                    model
                        .base(c, m)
                        .with("set", "movement")
                        .with("Credit type", kind)
                        .with("amount_currency", model.customers[c].currency)
                        .with("metric_value", amount)
                })
                .collect();
            // Balances: one line per wallet and month, the newest first.
            for c in 0..model.customers.len() {
                let mut balance = 0.0;
                for m in 0..MONTHS {
                    let change: f64 = model
                        .credits
                        .iter()
                        .filter(|e| e.0 == c && e.1 == m)
                        .map(|e| e.3)
                        .sum();
                    if change == 0.0 && balance == 0.0 {
                        continue;
                    }
                    let start = balance;
                    balance = round2(balance + change);
                    rows.push(
                        model
                            .base(c, m)
                            .with("set", "balance")
                            .with(
                                "customer_external_id",
                                model.customers[c].external_id.as_str(),
                            )
                            .with("amount_currency", model.customers[c].currency)
                            .with("start_of_month_balance", round2(start))
                            .with("monthly_balance_change", round2(change))
                            .with("end_of_month_balance", balance),
                    );
                }
            }
            rows
        }
        "usage" => model
            .usage
            .iter()
            .map(|&(s, m, k, units, amount)| {
                // Only what the usage charts and filters read: the rows are many.
                let plan = plan_of(&subs[s]).name;
                model
                    .base(subs[s].customer, m)
                    .with("plan_name", plan)
                    .with("Plan", plan)
                    .with("breakdown", METRICS[k].name)
                    .with("Billable metric", METRICS[k].name)
                    .with("billable_metric_code", METRICS[k].code)
                    .with("units_consumed", units)
                    .with("usage_amount", amount)
            })
            .collect(),
        "payments" => {
            let mut rows = Vec::new();
            let mut id = 0;
            for inv in &model.invoices {
                let c = &model.customers[inv.customer];
                for (day, error) in &inv.attempts {
                    id += 1;
                    let total = inv.day + day;
                    let (m, d) = if total > 28 {
                        (inv.month + 1, total - 28)
                    } else {
                        (inv.month, total)
                    };
                    if m >= MONTHS {
                        continue;
                    }
                    rows.push(
                        model
                            .base(inv.customer, m)
                            .with("set", "attempt")
                            .with("payment_date", date(model, m, d))
                            .with("payment_id", format!("pay_{id:06}"))
                            .with("customer_external_id", c.external_id.as_str())
                            .with("email", c.email.as_str())
                            .with("invoice_number", inv.number.as_str())
                            .with("payment_amount", inv.amount)
                            .with(
                                "payment_status",
                                if error.is_some() {
                                    "Failed"
                                } else {
                                    "Succeeded"
                                },
                            )
                            .with("payment_method_type", inv.method)
                            .with(
                                "card_brand",
                                if inv.method == "card" {
                                    ["visa", "mastercard", "amex"][id % 3]
                                } else {
                                    ""
                                },
                            )
                            .with("error_code", error.unwrap_or(""))
                            .with("payment_count", 1u32),
                    );
                }
            }
            rows
        }
        "dunnings" => {
            let mut rows = Vec::new();
            for inv in model
                .invoices
                .iter()
                .filter(|i| i.attempts.first().is_some_and(|a| a.1.is_some()))
            {
                let paid = inv.payment_status == "succeeded";
                let days = inv.attempts.last().map_or(0, |a| a.0);
                let outcome = match (paid, inv.attempts.len()) {
                    (true, _) => "Recovered",
                    (false, n) if n >= 4 => "Exhausted",
                    _ => "In progress",
                };
                let row = model
                    .base(inv.customer, inv.month)
                    .with("invoice_number", inv.number.as_str())
                    .with("invoice_amount", inv.amount)
                    .with("status", outcome)
                    .with("invoice_count", 1u32)
                    .with("total_dunning_attempts", (inv.attempts.len() - 1) as u32)
                    .with("invoice_is_paid", paid)
                    .with("first_attempt_date", date(model, inv.month, inv.day))
                    .with("revenue_recovered", if paid { inv.amount } else { 0.0 })
                    .with("invoices_recovered", u32::from(paid))
                    .with(
                        "payment_timeframe",
                        match (paid, days) {
                            (false, _) => "Not recovered",
                            (true, 0..=3) => "0–3 days",
                            (true, 4..=7) => "4–7 days",
                            (true, 8..=14) => "8–14 days",
                            _ => "15+ days",
                        },
                    );
                // Unpaid invoices have no payment date: the cell stays empty.
                rows.push(if paid {
                    row.with("days_to_payment", f64::from(days))
                } else {
                    row
                });
            }
            rows
        }
        "invoices" => model
            .invoices
            .iter()
            .map(|inv| {
                let c = &model.customers[inv.customer];
                let outstanding = if inv.status == "finalized" {
                    inv.amount - inv.paid
                } else {
                    0.0
                };
                let age_days = (last - inv.month) * 30 + 28 - inv.day as i32;
                let overdue = outstanding > 0.0 && age_days > 30;
                model
                    .base(inv.customer, inv.month)
                    .with("issuing_date", date(model, inv.month, inv.day))
                    .with("invoice_number", inv.number.as_str())
                    .with("customer_external_id", c.external_id.as_str())
                    .with("invoice_type", inv.kind)
                    .with("invoice_status", title(inv.status))
                    .with("payment_status", title(inv.payment_status))
                    .with("plan_name", inv.plan.map_or("", |p| PLANS[p].name))
                    .with("Plan", inv.plan.map_or("", |p| PLANS[p].name))
                    .with("total_amount", inv.amount)
                    .with("total_paid", inv.paid)
                    .with("outstanding_amount", round2(outstanding))
                    .with("is_outstanding", outstanding > 0.0)
                    .with("is_overdue", overdue)
                    .with("invoice_count", 1u32)
                    .with(
                        "invoice_age",
                        match age_days {
                            ..=30 => "1 · Current",
                            31..=60 => "2 · 31–60 days",
                            61..=90 => "3 · 61–90 days",
                            _ => "4 · 90+ days",
                        },
                    )
            })
            .collect(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_view_has_rows() {
        for view in [
            "subscriptions-active",
            "subscriptions-new",
            "subscriptions-churn",
            "revenue-streams",
            "revenue-mrr",
            "credit-ledgers",
            "usage",
            "payments",
            "dunnings",
            "invoices",
        ] {
            let n = rows(view).len();
            eprintln!(
                "{view}: {n} rows, {} KB",
                jt::to_string(&rows(view)).len() / 1024
            );
            assert!(n > 10, "{view}: {n} rows");
        }
    }
}
