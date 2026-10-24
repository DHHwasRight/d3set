use crate::charts::toplist::TopRow;

pub fn Toplist(rows: &[TopRow], row_style: &str) -> Element {
    <div class="d3s-scroll d3s-toplist">
        for r in rows {
            <div class="d3s-toplist-row" title={r.title} style={row_style}><span class="d3s-toplist-rank">{r.rank}</span><span class="d3s-toplist-name">{r.name}</span><span class="d3s-toplist-value">{r.value}</span><div class="d3s-toplist-bar" style={r.bar_style}></div></div>
        }
    </div>
}
