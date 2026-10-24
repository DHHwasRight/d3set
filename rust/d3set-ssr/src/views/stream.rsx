use crate::charts::stream::Line;

pub fn Stream(lines: &[Line]) -> Element {
    <div class="d3s-scroll d3s-stream">
        for l in lines {
            <div class="d3s-stream-line" style={l.style}>
                <time>{l.time}</time>
                if !l.level.is_empty() {
                    <span class="d3s-stream-level">{l.level}</span>
                }
                <span class="d3s-stream-msg">{l.message}</span>
                for t in &l.tags {
                    <span class="d3s-stream-tag">{t}</span>
                }
            </div>
        }
    </div>
}
