// Layer 2, the /analytics section. Each page under it is one view of the Analytics page; moving between
// them swaps the tabs and the view, and the shell and this layer stay.
//
// The marker is on the element that wraps exactly the children, so a swap replaces the page.

use crate::pages::views::layout::{LibrarySwitch, SideNav};

pub fn Layout(layout: &str, children: Element) -> Element {
    <div class="section" dp-layout={layout}>{children}</div>
}

// Sent with a partial that keeps this layer, in place of the shell's own: the section did not
// change, so the top nav is right, but the sidebar link and the library links name the path.

pub fn Oob(path: &str) -> Element {
    <LibrarySwitch path={path} oob={true} />
    <SideNav path={path} oob={true} />
}
