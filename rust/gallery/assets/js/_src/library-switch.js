// The library switch links to the current page on the other galleries. Each gallery navigates
// without reloading its shell, so a link's path can be stale: on click, it takes the current one.

export function followPath(root = document) {
  root.addEventListener("click", (event) => {
    const link = event.target instanceof Element && event.target.closest(".library-switch a");
    if (!link) return;
    link.href = new URL(link.href).origin + location.pathname + location.search;
  });
}
