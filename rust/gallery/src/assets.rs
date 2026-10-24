//! Static files. `assets/` is fingerprinted (`/js/d3set.<hash>.js`, cached forever); `public/` keeps its names.
//! `assets/js/d3set.js` and `assets/css/d3set.css` come from `npm run gallery:assets`.

brocanth_assets::assets!("assets", "public");
