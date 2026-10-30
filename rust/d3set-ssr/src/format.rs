//! A port of the d3-format subset d3set uses, so server labels match browser labels.
//!
//! Grammar: `[sign][$][,][.precision][~][type]`, types `s f % g r d e` and none.
//! Like d3's default locale, the minus sign is U+2212 (`−`), not a hyphen.

const MINUS: &str = "\u{2212}";
const PREFIXES: [&str; 17] = [
    "y", "z", "a", "f", "p", "n", "µ", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y",
];

/// A parsed format specifier, ready to format numbers.
#[derive(Clone, Debug)]
pub struct Format {
    sign: char,
    currency: bool,
    comma: bool,
    precision: Option<usize>,
    trim: bool,
    kind: char,
}

impl Format {
    /// Parse a d3-format specifier, for example `,.0f`, `.3~s`, `$,.0f`, `+.1%`.
    /// Parts outside the supported subset are ignored.
    pub fn new(spec: &str) -> Self {
        let mut chars = spec.chars().peekable();
        let mut f = Format {
            sign: '-',
            currency: false,
            comma: false,
            precision: None,
            trim: false,
            kind: ' ',
        };
        if let Some(&c) = chars.peek() {
            if matches!(c, '-' | '+' | '(' | ' ') {
                f.sign = c;
                chars.next();
            }
        }
        if chars.peek() == Some(&'$') {
            f.currency = true;
            chars.next();
        }
        // Width digits are not used by d3set; skip them.
        while chars.peek().is_some_and(char::is_ascii_digit) {
            chars.next();
        }
        if chars.peek() == Some(&',') {
            f.comma = true;
            chars.next();
        }
        if chars.peek() == Some(&'.') {
            chars.next();
            let mut digits = String::new();
            while let Some(&c) = chars.peek() {
                if !c.is_ascii_digit() {
                    break;
                }
                digits.push(c);
                chars.next();
            }
            f.precision = digits.parse().ok();
        }
        if chars.peek() == Some(&'~') {
            f.trim = true;
            chars.next();
        }
        if let Some(c) = chars.next() {
            f.kind = c;
        }
        // d3: "" type defaults to precision 12 and trims; others default to 6.
        if f.kind == ' ' {
            if f.precision.is_none() {
                f.precision = Some(12);
            }
            f.trim = true;
            f.kind = 'g';
        }
        if f.kind == 'r' {
            f.kind = 'g';
        }
        let p = f.precision.unwrap_or(6);
        f.precision = Some(if matches!(f.kind, 'g' | 's') {
            p.clamp(1, 21)
        } else {
            p.min(20)
        });
        f
    }

    pub fn format(&self, x: f64) -> String {
        if x.is_nan() {
            return "NaN".into();
        }
        let p = self.precision.unwrap_or(6);
        let negative = x < 0.0 || (x == 0.0 && x.is_sign_negative());
        let a = x.abs();
        let mut body = match self.kind {
            'f' => fixed(a, p),
            'd' => fixed(a.round(), 0),
            '%' => fixed(a * 100.0, p),
            'e' => exponential(a, p),
            's' => si(a, p),
            _ => general(a, p),
        };
        if self.trim {
            body = trim_zeros(&body);
        }
        // A value that rounds to zero is not negative ("-0" never shows), as in d3.
        let negative = negative && body.chars().any(|c| c.is_ascii_digit() && c != '0');
        if self.comma {
            body = group(&body);
        }
        if self.kind == '%' {
            body.push('%');
        }
        let prefix = if self.currency { "$" } else { "" };
        match (negative, self.sign) {
            (true, '(') => format!("({prefix}{body})"),
            (true, _) => format!("{MINUS}{prefix}{body}"),
            (false, '+') => format!("+{prefix}{body}"),
            (false, ' ') => format!(" {prefix}{body}"),
            _ => format!("{prefix}{body}"),
        }
    }
}

/// `d3.format(spec)(x)` in one call.
pub fn format(spec: &str, x: f64) -> String {
    Format::new(spec).format(x)
}

/// `a.toFixed(p)`. An exact tie (378.5 to 0 digits) rounds away from zero in JavaScript, but to
/// even in Rust: on a tie, format the next float away from zero instead.
fn fixed(a: f64, p: usize) -> String {
    let exact = format!("{a:.1100}");
    let tail = exact
        .split_once('.')
        .map_or("", |(_, f)| f.get(p..).unwrap_or(""));
    let tie = tail.starts_with('5') && tail[1..].bytes().all(|b| b == b'0');
    let a = if tie && a.is_finite() {
        f64::from_bits(a.to_bits() + 1)
    } else {
        a
    };
    format!("{a:.p$}")
}

/// `x.toExponential(p)` digits as d3 splits them: (coefficient digits without the point, exponent).
fn decimal_parts(a: f64, p: usize) -> (String, i32) {
    let s = format!("{:.*e}", p.saturating_sub(1), a);
    let (mantissa, exp) = s.split_once('e').unwrap_or((&s, "0"));
    (mantissa.replace('.', ""), exp.parse().unwrap_or(0))
}

fn exponential(a: f64, p: usize) -> String {
    let s = format!("{a:.p$e}");
    let (m, e) = s.split_once('e').unwrap_or((&s, "0"));
    let e: i32 = e.parse().unwrap_or(0);
    format!("{m}e{}{}", if e < 0 { "-" } else { "+" }, e.abs())
}

/// `toPrecision(p)`: exponential for very small or large numbers, else fixed.
fn general(a: f64, p: usize) -> String {
    if a == 0.0 {
        return if p > 1 {
            format!("0.{}", "0".repeat(p - 1))
        } else {
            "0".into()
        };
    }
    let (_, e) = decimal_parts(a, p);
    if e < -6 || e >= p as i32 {
        let s = format!("{:.*e}", p - 1, a);
        let (m, e) = s.split_once('e').unwrap_or((&s, "0"));
        let e: i32 = e.parse().unwrap_or(0);
        format!("{m}e{}{}", if e < 0 { "-" } else { "+" }, e.abs())
    } else {
        let decimals = (p as i32 - 1 - e).max(0) as usize;
        format!("{a:.decimals$}")
    }
}

/// d3's `formatPrefixAuto`: p significant digits and an SI prefix.
fn si(a: f64, p: usize) -> String {
    if a == 0.0 {
        return if p > 1 {
            format!("0.{}", "0".repeat(p - 1))
        } else {
            "0".into()
        };
    }
    let (coefficient, exponent) = decimal_parts(a, p);
    let prefix_exponent = ((exponent as f64 / 3.0).floor() as i32).clamp(-8, 8) * 3;
    let i = exponent - prefix_exponent + 1;
    let n = coefficient.len() as i32;
    let digits = if i == n {
        coefficient
    } else if i > n {
        format!("{coefficient}{}", "0".repeat((i - n) as usize))
    } else if i > 0 {
        format!(
            "{}.{}",
            &coefficient[..i as usize],
            &coefficient[i as usize..]
        )
    } else {
        let (c, _) = decimal_parts(a, (p as i32 + i - 1).max(0) as usize);
        format!("0.{}{}", "0".repeat((1 - i) as usize), c)
    };
    let symbol = PREFIXES[(8 + prefix_exponent / 3) as usize];
    format!("{digits}{symbol}")
}

/// d3's `formatTrim`: drop insignificant trailing zeros of the decimal part, keep any suffix.
fn trim_zeros(s: &str) -> String {
    let Some(dot) = s.find('.') else {
        return s.to_string();
    };
    let end = s[dot + 1..]
        .find(|c: char| !c.is_ascii_digit())
        .map_or(s.len(), |i| dot + 1 + i);
    let decimals = s[dot + 1..end].trim_end_matches('0');
    let head = if decimals.is_empty() {
        s[..dot].to_string()
    } else {
        format!("{}.{decimals}", &s[..dot])
    };
    format!("{head}{}", &s[end..])
}

/// Thousands separators on the integer part.
fn group(s: &str) -> String {
    let end = s.find(|c: char| !c.is_ascii_digit()).unwrap_or(s.len());
    let (int, rest) = s.split_at(end);
    let mut out = String::with_capacity(s.len() + int.len() / 3);
    for (i, c) in int.chars().enumerate() {
        if i > 0 && (int.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out + rest
}

/// `String(n)` in JavaScript for the numbers d3set meets: integers without `.0`.
pub fn js_number(n: f64) -> String {
    if n.is_nan() {
        "NaN".into()
    } else if n.is_infinite() {
        if n > 0.0 {
            "Infinity".into()
        } else {
            "-Infinity".into()
        }
    } else {
        format!("{n}")
    }
}

#[cfg(test)]
mod tests {
    use super::format;

    #[test]
    fn si_prefixes_match_d3() {
        assert_eq!(format(".3~s", 12345.0), "12.3k");
        assert_eq!(format("~s", 1500.0), "1.5k");
        assert_eq!(format(".3~s", 0.0), "0");
        assert_eq!(format(".3~s", 800.0), "800");
        assert_eq!(format(".3~s", 0.25), "250m");
        assert_eq!(format("$~s", 2_500_000.0), "$2.5M");
    }

    #[test]
    fn fixed_ties_round_away_from_zero_like_to_fixed() {
        assert_eq!(format(",.0f", 378.5), "379");
        assert_eq!(format(",.0f", 2.5), "3");
        assert_eq!(format(".1f", -0.25), "−0.3");
        assert_eq!(format(".2f", 1.005), "1.00");
    }

    #[test]
    fn fixed_with_grouping_and_currency() {
        assert_eq!(format(",.0f", 1234567.4), "1,234,567");
        assert_eq!(format("$,.0f", 98252.0), "$98,252");
        assert_eq!(format(",.0f", -5.0), "\u{2212}5");
    }

    #[test]
    fn percentages() {
        assert_eq!(format(".1%", 0.4321), "43.2%");
        assert_eq!(format("+.1%", 0.5), "+50.0%");
        assert_eq!(format(".2~%", 0.95), "95%");
        assert_eq!(format(".2~%", 0.9502), "95.02%");
    }

    #[test]
    fn general_precision() {
        assert_eq!(format(".4~g", 99.2834), "99.28");
        assert_eq!(format(".4~g", 249.8), "249.8");
    }
}
