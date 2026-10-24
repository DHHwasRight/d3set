//! UTC time: ISO 8601 parsing, `d3.utcFormat`, and d3's time-scale ticks.
//! All times are milliseconds since the Unix epoch, as in JavaScript.

pub const SECOND: f64 = 1_000.0;
pub const MINUTE: f64 = 60_000.0;
pub const HOUR: f64 = 3_600_000.0;
pub const DAY: f64 = 86_400_000.0;
pub const WEEK: f64 = 604_800_000.0;
pub const MONTH: f64 = 2_592_000_000.0;
pub const YEAR: f64 = 31_536_000_000.0;

/// Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// Parse `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM[:SS[.sss]]` with `Z` or `±HH:MM`. A missing zone is UTC.
/// Returns `None` for anything else, like d3set's `asDate`, which only accepts strings that start with a date.
pub fn parse_iso(s: &str) -> Option<f64> {
    let b = s.as_bytes();
    let num = |from: usize, len: usize| -> Option<i64> {
        let part = s.get(from..from + len)?;
        part.bytes()
            .all(|c| c.is_ascii_digit())
            .then(|| part.parse().ok())?
    };
    if b.len() < 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let (y, mo, d) = (num(0, 4)?, num(5, 2)?, num(8, 2)?);
    let mut ms = days_from_civil(y, mo, d) as f64 * DAY;
    if b.len() == 10 {
        return Some(ms);
    }
    if !matches!(b[10], b'T' | b' ') {
        return None;
    }
    ms += num(11, 2)? as f64 * HOUR + num(14, 2)? as f64 * MINUTE;
    let mut i = 16;
    if b.get(i) == Some(&b':') {
        ms += num(17, 2)? as f64 * SECOND;
        i = 19;
        if b.get(i) == Some(&b'.') {
            let start = i + 1;
            let mut end = start;
            while b.get(end).is_some_and(u8::is_ascii_digit) {
                end += 1;
            }
            let frac: f64 = format!("0.{}", &s[start..end]).parse().ok()?;
            ms += (frac * 1000.0).round();
            i = end;
        }
    }
    match b.get(i) {
        None | Some(b'Z') => Some(ms),
        Some(sign @ (b'+' | b'-')) => {
            let offset = num(i + 1, 2)? as f64 * HOUR + num(i + 4, 2)? as f64 * MINUTE;
            Some(if *sign == b'+' {
                ms - offset
            } else {
                ms + offset
            })
        }
        _ => None,
    }
}

/// UTC calendar fields of a time.
#[derive(Clone, Copy, Debug)]
pub struct Utc {
    pub year: i64,
    pub month: i64,
    pub day: i64,
    pub hour: i64,
    pub minute: i64,
    pub second: i64,
    pub milli: i64,
    /// 0 = Sunday.
    pub weekday: i64,
}

pub fn utc(ms: f64) -> Utc {
    let ms = ms.floor() as i64;
    let days = ms.div_euclid(DAY as i64);
    let rest = ms.rem_euclid(DAY as i64);
    let (year, month, day) = civil_from_days(days);
    Utc {
        year,
        month,
        day,
        hour: rest / 3_600_000,
        minute: rest / 60_000 % 60,
        second: rest / 1000 % 60,
        milli: rest % 1000,
        weekday: (days + 4).rem_euclid(7),
    }
}

/// `toISOString()`.
pub fn iso(ms: f64) -> String {
    let t = utc(ms);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        t.year, t.month, t.day, t.hour, t.minute, t.second, t.milli
    )
}

const WEEKDAYS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/// `d3.utcFormat(spec)(date)` for `%Y %m %d %e %H %I %M %S %L %p %a %b %B %%`.
pub fn utc_format(spec: &str, ms: f64) -> String {
    let t = utc(ms);
    let mut out = String::new();
    let mut chars = spec.chars();
    while let Some(c) = chars.next() {
        if c != '%' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('Y') => out.push_str(&format!("{:04}", t.year)),
            Some('m') => out.push_str(&format!("{:02}", t.month)),
            Some('d') => out.push_str(&format!("{:02}", t.day)),
            Some('e') => out.push_str(&format!("{:>2}", t.day)),
            Some('H') => out.push_str(&format!("{:02}", t.hour)),
            Some('I') => out.push_str(&format!("{:02}", (t.hour + 11) % 12 + 1)),
            Some('M') => out.push_str(&format!("{:02}", t.minute)),
            Some('S') => out.push_str(&format!("{:02}", t.second)),
            Some('L') => out.push_str(&format!("{:03}", t.milli)),
            Some('p') => out.push_str(if t.hour >= 12 { "PM" } else { "AM" }),
            Some('a') => out.push_str(WEEKDAYS[t.weekday as usize]),
            Some('b') => out.push_str(&MONTHS[(t.month - 1) as usize][..3]),
            Some('B') => out.push_str(MONTHS[(t.month - 1) as usize]),
            Some('%') => out.push('%'),
            Some(other) => {
                out.push('%');
                out.push(other);
            }
            None => out.push('%'),
        }
    }
    out
}

/// d3's default multi-scale tick format for a UTC time scale.
pub fn multi_format(ms: f64) -> String {
    let t = utc(ms);
    let spec = if t.milli != 0 {
        ".%L"
    } else if t.second != 0 {
        ":%S"
    } else if t.minute != 0 {
        "%I:%M"
    } else if t.hour != 0 {
        "%I %p"
    } else if t.day != 1 {
        if t.weekday != 0 {
            "%a %d"
        } else {
            "%b %d"
        }
    } else if t.month != 1 {
        "%B"
    } else {
        "%Y"
    };
    utc_format(spec, ms)
}

/// Unit of a tick interval.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Unit {
    Milli,
    Second,
    Minute,
    Hour,
    Day,
    Week,
    Month,
    Year,
}

const INTERVALS: [(Unit, i64, f64); 18] = [
    (Unit::Second, 1, SECOND),
    (Unit::Second, 5, 5.0 * SECOND),
    (Unit::Second, 15, 15.0 * SECOND),
    (Unit::Second, 30, 30.0 * SECOND),
    (Unit::Minute, 1, MINUTE),
    (Unit::Minute, 5, 5.0 * MINUTE),
    (Unit::Minute, 15, 15.0 * MINUTE),
    (Unit::Minute, 30, 30.0 * MINUTE),
    (Unit::Hour, 1, HOUR),
    (Unit::Hour, 3, 3.0 * HOUR),
    (Unit::Hour, 6, 6.0 * HOUR),
    (Unit::Hour, 12, 12.0 * HOUR),
    (Unit::Day, 1, DAY),
    (Unit::Day, 2, 2.0 * DAY),
    (Unit::Week, 1, WEEK),
    (Unit::Month, 1, MONTH),
    (Unit::Month, 3, 3.0 * MONTH),
    (Unit::Year, 1, YEAR),
];

/// d3's `utcTicks(start, stop, count)`: nice calendar ticks, both ends inclusive.
pub fn ticks(start: f64, stop: f64, count: f64) -> Vec<f64> {
    let (lo, hi) = if stop < start {
        (stop, start)
    } else {
        (start, stop)
    };
    let target = (hi - lo) / count;
    let i = INTERVALS.partition_point(|(_, _, d)| *d <= target);
    let (unit, step) = if i == INTERVALS.len() {
        (
            Unit::Year,
            crate::scale::tick_step(lo / YEAR, hi / YEAR, count).max(1.0) as i64,
        )
    } else if i == 0 {
        (
            Unit::Milli,
            crate::scale::tick_step(lo, hi, count).max(1.0) as i64,
        )
    } else {
        let (prev, next) = (INTERVALS[i - 1], INTERVALS[i]);
        let pick = if target / prev.2 < next.2 / target {
            prev
        } else {
            next
        };
        (pick.0, pick.1)
    };
    let mut out = range(unit, step, lo, hi + 1.0);
    if stop < start {
        out.reverse();
    }
    out
}

/// Every interval boundary in `[start, stop)` whose field is a multiple of `step`, like `interval.every(step).range`.
fn range(unit: Unit, step: i64, start: f64, stop: f64) -> Vec<f64> {
    let fixed = |len: f64| {
        // Second, minute, and hour boundaries with these steps are multiples of the step since the epoch.
        let k = len * step as f64;
        let mut t = (start / k).ceil() * k;
        let mut out = Vec::new();
        while t < stop {
            out.push(t);
            t += k;
        }
        out
    };
    match unit {
        Unit::Milli => fixed(1.0),
        Unit::Second => fixed(SECOND),
        Unit::Minute => fixed(MINUTE),
        Unit::Hour => fixed(HOUR),
        Unit::Day | Unit::Week | Unit::Month | Unit::Year => {
            let mut out = Vec::new();
            let mut day = (start / DAY).ceil() as i64;
            let last = (stop / DAY).ceil() as i64;
            while day < last {
                let ms = day as f64 * DAY;
                let t = utc(ms);
                let keep = match unit {
                    Unit::Day => (t.day - 1) % step == 0,
                    Unit::Week => t.weekday == 0,
                    Unit::Month => t.day == 1 && (t.month - 1) % step == 0,
                    _ => t.day == 1 && t.month == 1 && t.year % step == 0,
                };
                if keep && ms >= start {
                    out.push(ms);
                }
                day += 1;
            }
            out
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_prints_iso() {
        let ms = parse_iso("2026-10-24T13:01:10.537Z").unwrap();
        assert_eq!(iso(ms), "2026-10-24T13:01:10.537Z");
        assert_eq!(
            parse_iso("2026-10-24"),
            Some(parse_iso("2026-10-24T00:00:00Z").unwrap())
        );
        assert_eq!(
            parse_iso("2026-10-24T15:00:00+02:00"),
            parse_iso("2026-10-24T13:00:00Z")
        );
        assert_eq!(parse_iso("not a date"), None);
    }

    #[test]
    fn formats_like_d3_utc_format() {
        let ms = parse_iso("2026-10-24T16:14:30Z").unwrap();
        assert_eq!(utc_format("%H:%M:%S", ms), "16:14:30");
        assert_eq!(utc_format("%I:%M %p %a %b", ms), "04:14 PM Sat Oct");
        assert_eq!(multi_format(ms), ":30");
        assert_eq!(
            multi_format(parse_iso("2026-10-24T16:15:00Z").unwrap()),
            "04:15"
        );
    }

    #[test]
    fn ticks_pick_a_nice_interval() {
        let start = parse_iso("2026-10-24T16:13:11Z").unwrap();
        let stop = parse_iso("2026-10-24T16:17:50Z").unwrap();
        let t: Vec<String> = ticks(start, stop, 8.0)
            .iter()
            .map(|&ms| multi_format(ms))
            .collect();
        assert_eq!(
            t,
            [":30", "04:14", ":30", "04:15", ":30", "04:16", ":30", "04:17", ":30"]
        );
    }
}
