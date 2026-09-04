import Link from "next/link";

/**
 * Placeholder home page. The full marketing site is delivered in SCRUM-1;
 * this keeps the route valid and points visitors at the working tool.
 */
export default function HomePage() {
  return (
    <main className="container" style={{ padding: "64px 24px", maxWidth: 680 }}>
      <h1 style={{ letterSpacing: "-0.02em" }}>Prelegal</h1>
      <p style={{ color: "var(--text-muted)", fontSize: "1.05rem" }}>
        Contract groundwork before it reaches the lawyers. The marketing site is
        coming in a follow-up; the first tool is ready now.
      </p>
      <p style={{ marginTop: 32 }}>
        <Link className="button" href="/tools/mutual-nda">
          Open the Mutual NDA creator →
        </Link>
      </p>
    </main>
  );
}
