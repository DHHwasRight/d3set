//! `cargo build` builds the gallery's JS and CSS: every `_` file of `assets/` is an entry
//! (brocanth-bundle). `DEV=1` keeps the code unminified.

fn main() {
    if let Err(message) = brocanth_bundle::build() {
        panic!("{message}");
    }
}
