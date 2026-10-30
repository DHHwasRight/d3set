use crate::charts::table::{Th, Tr};

pub fn Table(head: &[Th], rows: &[Tr]) -> Element {
    <div class="d3s-table-wrap">
        <table class="d3s-table">
            <thead>
                <tr>
                    for h in head {
                        <th style={h.style} aria-sort="none">{h.text}</th>
                    }
                </tr>
            </thead>
            <tbody>
                for r in rows {
                    <tr { ...[("style", r.style)] }>
                        for (i, d) in r.cells.iter().enumerate() {
                            if d.link {
                                <td style={d.style} class="d3s-cell-link">{d.text}</td>
                            } else if let (0, Some(color)) = (i, r.swatch) {
                                <td style={d.style}><i class="d3s-swatch" style={swatch_style(color)}></i>{d.text}</td>
                            } else {
                                <td style={d.style}>{d.text}</td>
                            }
                        }
                    </tr>
                }
            </tbody>
        </table>
    </div>
}

fn swatch_style(color: &str) -> String {
    format!("background: {color};")
}
