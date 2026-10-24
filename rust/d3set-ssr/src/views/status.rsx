use crate::charts::status::{Chip, Tile};

pub fn Status(chips: &[Chip], tiles: &[Tile]) -> Element {
    <div class="d3s-scroll d3s-status-grid">
        <div class="d3s-status-summary">
            for ch in chips {
                <span style={ch.style}>{ch.text}</span>
            }
        </div>
        <div class="d3s-status-tiles">
            for t in tiles {
                <div class="d3s-status-tile" data-level={t.level} style={t.style} title={t.title}>
                    <strong>{t.name}</strong>
                    <span>{t.value}</span>
                    if let Some(s) = &t.seen {
                        <small>{s}</small>
                    }
                </div>
            }
        </div>
    </div>
}
