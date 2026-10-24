use crate::charts::hostmap::HexGroup;

pub fn Hostmap(groups: &[HexGroup]) -> Element {
    <div class="d3s-scroll d3s-hostmap">
        for g in groups {
            <section class="d3s-hostmap-group">
                if let Some(t) = &g.title {
                    <div class="d3s-hostmap-title">{t}</div>
                }
                <div class="d3s-hostmap-tiles">
                    for t in &g.tiles {
                        <div class="d3s-hex" style={t.style} title={t.title} aria-label={t.title}></div>
                    }
                </div>
            </section>
        }
    </div>
}
