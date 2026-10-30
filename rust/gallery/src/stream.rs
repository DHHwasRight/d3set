//! An SSE body over a feed subscription.

use std::sync::Arc;
use std::task::{Context, Poll};

use brocanth::plugin_body::{BodyStream, Chunk};
use tokio::sync::mpsc;

pub struct FeedStream {
    first: Option<Vec<u8>>,
    rx: mpsc::UnboundedReceiver<Arc<Vec<u8>>>,
    closing: bool,
    closed: bool,
}

/// A stream for `/events/{feed}`, or `None` for a feed that does not exist.
pub fn subscribe(feed: &str, since: Option<f64>) -> Option<FeedStream> {
    let (first, rx) = crate::data::catch_up(feed, since)?;
    Some(FeedStream {
        // With a fixed clock (`GALLERY_NOW`) nothing happens after the page: no catch-up either,
        // so a hydrated page keeps exactly the rows it was rendered with.
        first: crate::data::FROZEN.is_none().then_some(first),
        rx,
        closing: false,
        closed: false,
    })
}

impl BodyStream for FeedStream {
    fn poll_chunk(&mut self, cx: &mut Context<'_>) -> Chunk {
        if self.closed {
            return Poll::Ready(None);
        }
        if self.closing {
            // The server is stopping: tell EventSource not to reconnect at once, then end.
            self.closed = true;
            return Poll::Ready(Some(Ok(b"event: close\ndata: {}\n\n".to_vec())));
        }
        if let Some(first) = self.first.take() {
            return Poll::Ready(Some(Ok(first)));
        }
        match self.rx.poll_recv(cx) {
            Poll::Ready(Some(frame)) => Poll::Ready(Some(Ok(frame.to_vec()))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }

    fn finish(&mut self) {
        self.closing = true;
    }
}
