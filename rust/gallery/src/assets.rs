//! Static files. `assets/` is fingerprinted (`/js/d3set.<hash>.js`, cached forever); `public/` keeps its names.
//! `js/gallery.js`, `css/gallery.css`, and `css/d3set.css` are built by `build.rs` from the `_`
//! inputs next to them; the chart types are chunks in `public/js/chunks/`, loaded on demand.

brocanth_assets::assets!("assets", "public");
