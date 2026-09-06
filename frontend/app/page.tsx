import Link from "next/link";
import catalog from "@/catalog.json";
import styles from "./page.module.css";

const features = [
  {
    title: "Standard, not bespoke",
    body: "Every document starts from a widely reviewed standard template — CC BY 4.0 licensed, free to adapt, familiar to counterparties.",
  },
  {
    title: "Guided, not blank-page",
    body: "Answer a short form. Prelegal fills the template, shows you the finished agreement, and flags what still needs a decision.",
  },
  {
    title: "Ready before the lawyer",
    body: "Get a clean draft in minutes. Involve counsel for the judgement calls, not the boilerplate.",
  },
];

const steps = [
  {
    title: "Pick a document",
    body: "Choose from the template library — NDAs, service agreements, DPAs, and more.",
  },
  {
    title: "Fill the key terms",
    body: "Parties, dates, term length, governing law. Plain-language fields, sensible defaults.",
  },
  {
    title: "Export and send",
    body: "Download the completed agreement or print it to PDF, then route it for signature.",
  },
];

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Legal groundwork, before the lawyers.</h1>
          <p className={styles.heroLead}>
            Prelegal is where teams handle routine contracts and agreements —
            drafting from trusted templates, filling in the terms, and producing
            a signature-ready document without a billable hour in sight.
          </p>
          <div className={styles.heroActions}>
            <Link className="button" href="/tools/mutual-nda">
              Try the Mutual NDA creator
            </Link>
            <Link className="button button--ghost" href="#templates">
              Browse the template library
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <h2 className={styles.sectionTitle}>What Prelegal is</h2>
          <p className={styles.sectionLead}>
            A pre-legal workbench: the step between &ldquo;we need an agreement&rdquo;
            and &ldquo;send it to legal.&rdquo; It turns standard legal templates
            into short, guided forms so the routine 80% never becomes a bottleneck.
          </p>
          <div className={styles.grid}>
            {features.map((f) => (
              <article key={f.title} className={styles.card}>
                <h3 className={styles.cardTitle}>{f.title}</h3>
                <p className={styles.cardBody}>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <h2 className={styles.sectionTitle}>How it works</h2>
          <p className={styles.sectionLead}>
            Three steps from template to signature-ready draft.
          </p>
          <div className={styles.grid}>
            {steps.map((s, i) => (
              <article key={s.title} className={styles.card}>
                <span className={styles.stepNum}>{i + 1}</span>
                <h3 className={styles.cardTitle}>{s.title}</h3>
                <p className={styles.cardBody}>{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="templates" className={styles.section}>
        <div className="container">
          <h2 className={styles.sectionTitle}>Template library</h2>
          <p className={styles.sectionLead}>
            {catalog.templates.length} standard agreements from{" "}
            <a href={catalog.source}>Common Paper</a>, available under{" "}
            {catalog.license.split(" (")[0]}. The Mutual NDA is live as a guided
            tool today; the rest are next.
          </p>
          <ul className={styles.templateList}>
            {catalog.templates.map((t) => (
              <li key={t.filename} className={styles.templateItem}>
                <p className={styles.templateName}>{t.name}</p>
                <p className={styles.templateDesc}>{t.description}</p>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Templates are drafts to build on, not legal advice.
          </p>
        </div>
      </section>

      <section className={styles.cta}>
        <div className="container">
          <h2 className={styles.ctaTitle}>Start with a Mutual NDA</h2>
          <Link className="button" href="/tools/mutual-nda">
            Open the creator
          </Link>
        </div>
      </section>
    </main>
  );
}
