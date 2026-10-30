export default function Home() {
  return (
    <>
      <h1>d3set on Next.js</h1>
      <p>The same dashboard, four ways:</p>
      <ul>
        <li>
          <b>Server, hydrated</b>: a Server Component draws the charts into the HTML, the browser hydrates them, then
          they follow server-sent events from a route handler.
        </li>
        <li>
          <b>Server, static</b>: the same markup and no client code.
        </li>
        <li>
          <b>Client only</b>: a Client Component draws everything in the browser.
        </li>
        <li>
          <b>One chart</b>: a single server-rendered chart.
        </li>
      </ul>
    </>
  );
}
