//! `gallery export`: the gallery as files, for GitHub Pages.
//!
//! `brocanth-static` does the work (github.com/DHHwasRight/brocanth, `docs/static-export.md`).
//! Every path in [`crate::paths::static_paths`] goes through the same `dispatch` that `serve`
//! uses, and is written under `--out`: each page as a document and as one partial per layout
//! depth (`partials/<depth>/…`, for dp-swap's `partialDir`), each recorded feed as
//! `data/<feed>.json`, every asset, and `404.html`.
//!
//! The pages must be the static ones: run with `GALLERY_STATIC=1`. The base path is
//! `GALLERY_BASE` and nothing else, because the pages already put it in their JSON payloads and
//! the export puts the same one in their HTML: two sources could disagree.
//!
//! ```text
//! GALLERY_STATIC=1 GALLERY_BASE=/d3set gallery export --out dist
//! ```

use std::path::PathBuf;

/// Runs the export. `args` are the arguments after `export`.
pub fn run(args: &[String]) -> Result<(), String> {
    let mut out = PathBuf::from("dist");
    let mut args = args.iter();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--out" => {
                out = args
                    .next()
                    .map(PathBuf::from)
                    .ok_or("--out needs a directory\nhelp: gallery export --out dist")?;
            }
            other => {
                return Err(format!(
                    "unknown argument `{other}`\n\
                     help: gallery export [--out DIR]; the base path is GALLERY_BASE"
                ))
            }
        }
    }
    if !crate::site::is_static() {
        return Err(
            "the export needs the static pages\n\
                    help: run it with GALLERY_STATIC=1 (and GALLERY_BASE=/d3set for GitHub Pages)"
                .to_string(),
        );
    }
    // `GALLERY_LIBRARIES`: a bad value stops here, as it does for `serve`.
    if let Err(message) = &*crate::libraries::BASES {
        return Err(message.clone());
    }

    let app = crate::app::build()?;
    let site = brocanth_static::Export::new(&out)
        .base(crate::site::base())
        .partials(crate::paths::max_depth())
        .paths(crate::paths::static_paths())
        .assets(
            crate::assets::ASSETS
                .iter()
                .map(|asset| (asset.published, asset.body)),
        );

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    let report = runtime
        .block_on(site.run(|request| {
            // Every static page runs with JavaScript: `?js=off` needs a server to read the query.
            let answered = crate::site::with_js(true, || crate::app::dispatch(&app, &request));
            std::future::ready(sent(answered))
        }))
        .map_err(|e| e.to_string())?;

    eprintln!("{}: export: {report} in {}", crate::app::APP, out.display());
    Ok(())
}

/// A page's answer as the server writes it: HTML unless the page names another content type.
/// The same rule as `sent` in `app.rs`.
fn sent(answered: crate::pages::Response) -> brocanth_server::Response {
    let mut out = brocanth_server::Response::html(answered.status, answered.body);
    for (name, value) in &answered.headers {
        if name.eq_ignore_ascii_case("content-type") {
            out = out.without_header(name);
        }
        out = out.with_header(name, value);
    }
    out
}
