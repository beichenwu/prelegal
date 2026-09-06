"use client";

import { useEffect, useMemo, useState } from "react";
import { NdaForm } from "@/components/NdaForm";
import { NdaChat } from "@/components/NdaChat";
import { NdaPreview } from "@/components/NdaPreview";
import {
  DEFAULT_VALUES,
  buildAgreement,
  validate,
  type NdaFormValues,
} from "@/lib/mutualNda";
import styles from "./mutual-nda.module.css";

type Mode = "form" | "chat";
const MODE_KEY = "prelegal.nda.mode";

export default function MutualNdaPage() {
  const [values, setValues] = useState<NdaFormValues>(DEFAULT_VALUES);
  const [mode, setMode] = useState<Mode>("form");

  // Default the effective date to today, set after mount to avoid a
  // build-time/hydration date mismatch.
  useEffect(() => {
    setValues((current) =>
      current.effectiveDate
        ? current
        : { ...current, effectiveDate: new Date().toISOString().slice(0, 10) },
    );
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "form" || saved === "chat") setMode(saved);
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  const chooseMode = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore unwritable storage */
    }
  };

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
          Fill in the key terms and both parties&rsquo; details, or let the AI
          assistant ask you. The agreement on the right updates as you go —
          download it as Markdown or print it to PDF, then send it for signature.
        </p>
        <div className={styles.modeToggle} role="tablist" aria-label="Input mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "form"}
            className={mode === "form" ? styles.modeActive : styles.mode}
            onClick={() => chooseMode("form")}
          >
            Guided form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "chat"}
            className={mode === "chat" ? styles.modeActive : styles.mode}
            onClick={() => chooseMode("chat")}
          >
            AI chat <span className={styles.beta}>beta</span>
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <div className="no-print">
          {mode === "form" ? (
            <NdaForm values={values} errors={errors} onChange={setValues} />
          ) : (
            <NdaChat values={values} errors={errors} onChange={setValues} />
          )}
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
