//! The library switch: the same gallery, drawn by each d3set binding. Each one is its own server;
//! the switch links to the current page on the others.
//!
//! `GALLERY_LIBRARIES=vanilla=http://host:port,rsx=...,react=...,next=...` sets where each one
//! runs. An id that is not given keeps its default (the ports of `galleries/` in development).

use std::sync::LazyLock;

/// A binding: its id (`data-library`), its label, and where it runs by default.
pub struct Library {
    pub id: &'static str,
    pub name: &'static str,
    pub default: &'static str,
}

/// In the order of the switch.
pub const LIBRARIES: [Library; 4] = [
    Library {
        id: "vanilla",
        name: "Vanilla",
        default: "http://localhost:3300",
    },
    Library {
        id: "rsx",
        name: "Rust",
        default: "http://localhost:3000",
    },
    Library {
        id: "react",
        name: "React",
        default: "http://localhost:3310",
    },
    Library {
        id: "next",
        name: "Next.js",
        default: "http://localhost:3320",
    },
];

/// This gallery.
pub const CURRENT: &str = "rsx";

pub const ENV: &str = "GALLERY_LIBRARIES";

/// The base URL of each library, in the order of [`LIBRARIES`]: from `value`, else the default.
/// A trailing `/` is dropped, so a base and a path join with one slash.
pub fn parse(value: Option<&str>) -> Result<Vec<String>, String> {
    let mut bases: Vec<String> = LIBRARIES.iter().map(|l| l.default.to_string()).collect();
    for item in value
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let (id, url) = item
            .split_once('=')
            .ok_or_else(|| format!("{ENV}: `{item}`: expected id=url"))?;
        let i = LIBRARIES
            .iter()
            .position(|l| l.id == id.trim())
            .ok_or_else(|| {
                format!(
                    "{ENV}: unknown library `{}` (vanilla, rsx, react, next)",
                    id.trim()
                )
            })?;
        bases[i] = url.trim().trim_end_matches('/').to_string();
    }
    Ok(bases)
}

/// The bases, read once at startup. `app.rs` checks them before serving.
pub static BASES: LazyLock<Result<Vec<String>, String>> =
    LazyLock::new(|| parse(std::env::var(ENV).ok().as_deref()));

/// The switch's links for `path`: (library, URL of `path` on it).
pub fn links(path: &str) -> Vec<(&'static Library, String)> {
    let bases = BASES.as_ref().ok();
    LIBRARIES
        .iter()
        .enumerate()
        .map(|(i, l)| {
            let base = bases.map_or(l.default, |b| b[i].as_str());
            (l, format!("{base}{path}"))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_and_overrides() {
        let d = parse(None).unwrap();
        assert_eq!(
            d,
            [
                "http://localhost:3300",
                "http://localhost:3000",
                "http://localhost:3310",
                "http://localhost:3320"
            ]
        );
        let b = parse(Some("next=https://next.example.com/, rsx = http://a:1")).unwrap();
        assert_eq!(b[1], "http://a:1");
        assert_eq!(b[3], "https://next.example.com");
        assert_eq!(b[0], "http://localhost:3300");
        assert!(parse(Some("vue=http://x")).is_err());
        assert!(parse(Some("next")).is_err());
    }
}
