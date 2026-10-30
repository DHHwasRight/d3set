//! Server-side code highlighting with giallo: TextMate grammars and VS Code themes, so a snippet
//! looks the way it does in the editor.
//!
//! The built-in registry has Rust, JSON, TypeScript, CSS, and JavaScript. rsx and jt bring their
//! own grammars (`rsx::grammar`, `jt::grammar`): the same files their VS Code extensions ship.

use std::sync::LazyLock;

use giallo::{HighlightOptions, HtmlRenderer, Registry, RenderOptions, ThemeVariant};

static REGISTRY: LazyLock<Registry> =
    LazyLock::new(|| build().unwrap_or_else(|e| panic!("gallery: code highlighting: {e}")));

fn build() -> Result<Registry, String> {
    let mut registry = Registry::builtin().map_err(|e| e.to_string())?;
    // giallo loads grammars from files. Write the crates' grammars where it can read them.
    let dir = std::env::temp_dir().join(format!("d3set-gallery-grammars-{}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for (file, grammar) in [
        ("rsx.tmLanguage.json", rsx::grammar::TEXTMATE),
        ("jt.tmLanguage.json", jt::grammar::TEXTMATE),
        ("jt-injection.tmLanguage.json", jt::grammar::INJECTION),
    ] {
        let path = dir.join(file);
        std::fs::write(&path, grammar).map_err(|e| e.to_string())?;
        registry
            .add_grammar_from_path(&path)
            .map_err(|e| format!("{file}: {e}"))?;
    }
    let _ = std::fs::remove_dir_all(&dir);
    // giallo resolves `injectTo` by grammar name, VS Code by scope name: the jt injection says
    // `source.rust`, so make that name resolve too.
    registry.add_alias("rust", "source.rust");
    registry.add_alias(giallo::PLAIN_GRAMMAR_NAME, "text");
    registry.link_grammars();
    Ok(registry)
}

/// `<pre><code>` with inline colors. `lang` is a grammar name or alias: `rust`, `rsx`, `jt`, `json`, `ts`, `text`.
pub fn html(code: &str, lang: &str) -> String {
    let options = HighlightOptions::new(
        lang,
        ThemeVariant::Single(crate::styles::CODE_THEME),
    )
    .fallback_to_plain(true);
    match REGISTRY.highlight(code.trim_end(), &options) {
        Ok(highlighted) => HtmlRenderer::default().render(&highlighted, &RenderOptions::default()),
        Err(e) => {
            eprintln!("gallery: cannot highlight {lang}: {e}");
            let escaped = code
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            format!("<pre><code>{escaped}</code></pre>")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::html;

    /// The number of differently colored spans: a grammar that did not load gives one color.
    fn colors(out: &str) -> usize {
        let mut seen: Vec<&str> = out
            .split("style=\"")
            .skip(1)
            .filter_map(|s| s.split('"').next())
            .collect();
        seen.sort_unstable();
        seen.dedup();
        seen.len()
    }

    #[test]
    fn every_language_the_gallery_shows_gets_colors() {
        for (lang, code) in [
            ("rust", "fn main() { let x: u32 = 1; }"),
            ("json", r#"{ "a": [1, true, null] }"#),
            (
                "ts",
                "import { hydrate } from \"d3set\";\nconst x: number = 1;",
            ),
            (
                "rsx",
                "pub fn Card(title: &str) -> Element {\n    <div class=\"card\">{title}</div>\n}",
            ),
            ("jt", "pub fn User(id: u64) -> Json {\n    \"id\": id,\n}"),
        ] {
            let out = html(code, lang);
            assert!(
                colors(&out) >= 3,
                "{lang} has only {} colors: {out}",
                colors(&out)
            );
        }
    }

    #[test]
    fn jt_keys_inside_a_rust_macro_get_the_jt_colors() {
        let key = |out: &str| {
            out.split("&quot;id&quot;")
                .next()
                .and_then(|s| s.rsplit("style=\"").next())
                .map(str::to_string)
        };
        let in_macro = html(
            "jt::template! {\n    pub fn U(id: u64) -> Json {\n        \"id\": id,\n    }\n}",
            "rust",
        );
        let plain = html("let s = \"id\";", "rust");
        assert_ne!(
            key(&in_macro),
            key(&plain),
            "a key in jt::template! is colored like a plain Rust string"
        );
    }
}
