import Link from "next/link";
import catalog from "@/catalog.json";
import { DOCUMENT_CATALOG } from "@/lib/documents";
import styles from "./page.module.css";

const docHref = (slug: string) =>
  slug === "mutual-nda" ? "/tools/mutual-nda" : `/tools/create?document=${slug}`;

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
    title: "Describe what you need",
    body: "Tell the assistant the situation. It picks the right document from the library — NDAs, service agreements, DPAs, and more.",
  },
  {
    title: "Answer a few questions",
    body: "Parties, dates, term length, governing law, in plain language. The draft fills in as you go.",
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
            <Link className="button" href="/tools/create">
              Create an agreement
            </Link>
            <Link className="button button--ghost" href="#templates">
              Browse the document library
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
          <h2 className={styles.sectionTitle}>Document library</h2>
          <p className={styles.sectionLead}>
            {DOCUMENT_CATALOG.length} standard agreements from{" "}
            <a href={catalog.source}>Common Paper</a>, available under{" "}
            {catalog.license.split(" (")[0]}. All are live — pick one to start, or
            let the assistant choose.
          </p>
          <ul className={styles.templateList}>
            {DOCUMENT_CATALOG.map((d) => (
              <li key={d.slug} className={styles.templateItem}>
                <Link href={docHref(d.slug)} className={styles.templateName}>
                  {d.label}
                </Link>
                <p className={styles.templateDesc}>{d.description}</p>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Drafts to build on, not legal advice.
          </p>
        </div>
      </section>

      <section className={styles.cta}>
        <div className="container">
          <h2 className={styles.ctaTitle}>Create your first agreement</h2>
          <Link className="button" href="/tools/create">
            Open the assistant
          </Link>
        </div>
      </section>
    </main>
  );
}
