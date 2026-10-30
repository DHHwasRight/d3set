import "d3set/style.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "d3set on Next.js" };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#1a1a1f" }}>
        <nav style={{ display: "flex", gap: 16, padding: "16px 24px", borderBottom: "1px solid #e6e6ea" }}>
          <Link href="/">d3set</Link>
          <Link href="/server">Server, hydrated</Link>
          <Link href="/static">Server, static</Link>
          <Link href="/client">Client only</Link>
          <Link href="/chart">One chart</Link>
        </nav>
        <main style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>{children}</main>
      </body>
    </html>
  );
}
