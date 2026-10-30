//! The d3set gallery, a brocanth application.
//!
//! Every chart is rendered on the server with rsx, so a page is complete without JavaScript.
//! The browser then hydrates it from the embedded JSON and follows the live feeds over SSE.

mod analytics;
mod app;
mod assets;
mod billing;
mod catalog;
mod data;
mod export;
mod highlight;
mod libraries;
mod pages;
mod paths;
mod pretty;
mod site;
mod snippets;
mod stream;
mod styles;
mod theme;

use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("export") {
        return match export::run(&args[1..]) {
            Ok(()) => ExitCode::SUCCESS,
            Err(message) => {
                eprintln!("error: {message}");
                ExitCode::FAILURE
            }
        };
    }
    let addr = std::env::var("GALLERY_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_string());
    match app::serve(&addr) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::FAILURE
        }
    }
}
