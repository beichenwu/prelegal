"use client";

import { useMemo, useState } from "react";
import { DocChat, type DocChatResult } from "@/components/DocChat";
import { NdaPreview } from "@/components/NdaPreview";
import { buildDocument, missingFields } from "@/lib/buildDocument";
import type { SelectedDocument } from "@/lib/chat";
import { DOCUMENT_CATALOG, getDocument } from "@/lib/documents";
import styles from "./create.module.css";

function initialSlug(): string | null {
  if (typeof window === "undefined") return null;
  const wanted = new URLSearchParams(window.location.search).get("document");
  return wanted && DOCUMENT_CATALOG.some((d) => d.slug === wanted) ? wanted : null;
}

export default function CreatePage() {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [values, setValues] = useState<Record<string, string>>({});

  const doc = slug ? getDocument(slug) : undefined;

  const selected: SelectedDocument | null = doc
    ? {
        slug: doc.slug,
        label: doc.label,
        description: doc.description,
        fields: doc.fields,
        parties: doc.parties,
      }
    : null;

  const preview = useMemo(
    () => (doc ? buildDocument(doc.slug, values) : ""),
    [doc, values],
  );
  const missing = doc ? missingFields(doc.slug, values) : [];
  const canDownload = Boolean(doc) && missing.length === 0;

  function handleResult(result: DocChatResult) {
    if (result.document && result.document !== slug) setSlug(result.document);
    setValues(result.fields);
  }

  function handleDownload() {
    if (!doc) return;
    const blob = new Blob([preview], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.slug}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`container ${styles.page}`}>
      <div className={`${styles.intro} no-print`}>
        <h1>Create an agreement</h1>
        <p>
          {doc
            ? `Filling in a ${doc.label}. Answer the assistant's questions — the draft on the right updates as you go.`
            : "Describe what you're trying to put in place. The assistant picks the right document from our library, then guides you through it."}
        </p>
      </div>

      <div className={styles.layout}>
        <div className="no-print">
          <DocChat document={selected} values={values} onResult={handleResult} />
        </div>

        <div className={styles.previewPanel}>
          <div className={`${styles.actions} no-print`}>
            <button
              type="button"
              className="button"
              onClick={handleDownload}
              disabled={!canDownload}
            >
              Download .md
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => window.print()}
              disabled={!doc}
            >
              Print / Save as PDF
            </button>
          </div>
          {doc && !canDownload ? (
            <p className={`${styles.hint} no-print`}>
              {missing.length} field{missing.length === 1 ? "" : "s"} still needed
              before download.
            </p>
          ) : null}
          {doc ? (
            <NdaPreview markdown={preview} />
          ) : (
            <p className={`${styles.placeholder} no-print`}>
              Your document preview appears here once the assistant has picked a
              document.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
