"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NdaForm } from "@/components/NdaForm";
import { NdaPreview } from "@/components/NdaPreview";
import { RequireAuth } from "@/components/RequireAuth";
import {
  DEFAULT_VALUES,
  buildAgreement,
  validate,
  type NdaFormValues,
} from "@/lib/mutualNda";
import styles from "./mutual-nda.module.css";

function MutualNda() {
  const [values, setValues] = useState<NdaFormValues>(DEFAULT_VALUES);

  // Default the effective date to today, set after mount to avoid a
  // build-time/hydration date mismatch.
  useEffect(() => {
    setValues((current) =>
      current.effectiveDate
        ? current
        : { ...current, effectiveDate: new Date().toISOString().slice(0, 10) },
    );
  }, []);

  const errors = useMemo(() => validate(values), [values]);
  const agreement = useMemo(() => buildAgreement(values), [values]);
  const isComplete = errors.length === 0;

  function handleDownload() {
    const blob = new Blob([agreement], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mutual-nda.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`container ${styles.page}`}>
      <div className={`${styles.intro} no-print`}>
        <h1>Mutual NDA creator</h1>
        <p>
          Fill in the key terms and both parties&rsquo; details. The agreement on
          the right updates as you type — download it as Markdown or print it to
          PDF, then send it for signature.
        </p>
        <p className={styles.chatLink}>
          Prefer to describe it in your own words?{" "}
          <Link href="/tools/create?document=mutual-nda">
            Use the AI assistant
          </Link>
          .
        </p>
      </div>

      <p className="notice no-print">
        Preview only — not legal advice. Have a qualified lawyer review the draft
        before signing.
      </p>

      <div className={styles.layout}>
        <div className="no-print">
          <NdaForm values={values} errors={errors} onChange={setValues} />
        </div>

        <div className={styles.previewPanel}>
          <div className={`${styles.actions} no-print`}>
            <button
              type="button"
              className="button"
              onClick={handleDownload}
              disabled={!isComplete}
            >
              Download .md
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => window.print()}
            >
              Print / Save as PDF
            </button>
          </div>
          {!isComplete ? (
            <p className={`${styles.hint} no-print`}>
              Complete the {errors.length} remaining required field
              {errors.length === 1 ? "" : "s"} to enable download.
            </p>
          ) : null}
          <NdaPreview markdown={agreement} />
        </div>
      </div>
    </main>
  );
}

export default function MutualNdaPage() {
  return (
    <RequireAuth>
      <MutualNda />
    </RequireAuth>
  );
}
