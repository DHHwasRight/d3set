//! `note`: static text, one paragraph per blank-line-separated block. Ignores data.
//! Port of `charts/note.ts`.
//!
//! The TS note element has only the `d3s-note` class and no inline height: a plain element.

use crate::chart::{Ctx, Error, Rendered};
use crate::views;

/// `text.split(/\n\s*\n/).map((p) => p.trim())`.
fn paragraphs(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut i = 0;
    // JS `\s` is Unicode white space, like `char::is_whitespace` for the cases that matter here.
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    while i < chars.len() {
        if chars[i].1 == '\n' {
            // `\s*` is greedy but backtracks to the last `\n` it can reach.
            let mut k = i + 1;
            let mut last_nl = None;
            while k < chars.len() && chars[k].1.is_whitespace() {
                if chars[k].1 == '\n' {
                    last_nl = Some(k);
                }
                k += 1;
            }
            if let Some(nl) = last_nl {
                out.push(text[start..chars[i].0].to_string());
                let end = chars.get(nl + 1).map_or(text.len(), |c| c.0);
                start = end;
                i = nl + 1;
                continue;
            }
        }
        i += 1;
    }
    out.push(text[start..].to_string());
    out.into_iter().map(|p| p.trim().to_string()).collect()
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let paras = paragraphs(c.spec.text.as_deref().unwrap_or(""));
    let body = rsx::Template::render_to_string(views::note::Note { paragraphs: &paras })?;
    Ok(Rendered {
        body,
        class: "d3s-note",
        plain: true,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::paragraphs;

    #[test]
    fn splits_on_blank_lines_like_the_ts_regex() {
        assert_eq!(paragraphs("a\n\nb"), ["a", "b"]);
        assert_eq!(paragraphs("a\n  \n\n b \nc"), ["a", "b \nc"]);
        assert_eq!(paragraphs("a\nb"), ["a\nb"]);
        assert_eq!(paragraphs(""), [""]);
    }
}
