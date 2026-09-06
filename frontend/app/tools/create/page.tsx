"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DocChat, type DocChatResult } from "@/components/DocChat";
import { NdaPreview } from "@/components/NdaPreview";
import { RequireAuth } from "@/components/RequireAuth";
import { buildDocument, missingFields } from "@/lib/buildDocument";
import type { SelectedDocument } from "@/lib/chat";
import { DOCUMENT_CATALOG, getDocument } from "@/lib/documents";
import { AuthError } from "@/lib/auth";
import { saveDocument } from "@/lib/documentsApi";
import styles from "./create.module.css";

function initialSlug(): string | null {
  if (typeof window === "undefined") return null;
  const wanted = new URLSearchParams(window.location.search).get("document");
  return wanted && DOCUMENT_CATALOG.some((d) => d.slug === wanted) ? wanted : null;
}

const defaultTitle = (label: string) =>
  `${label} — ${new Date().toISOString().slice(0, 10)}`;

function Create() {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [values, setValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const titleTouched = useRef(false);

  const doc = slug ? getDocument(slug) : undefined;

  useEffect(() => {
    if (doc && !titleTouched.current) setTitle(defaultTitle(doc.label));
  }, [doc]);

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
  const ready = Boolean(doc) && missing.length === 0;

  function handleResult(result: DocChatResult) {
    if (result.document && result.document !== slug) {
      setSlug(result.document);
      titleTouched.current = false;
    }
    setValues(result.fields);
    setSaveState("idle");
  }

  async function handleSave() {
    if (!doc) return;
    setSaveState("saving");
    setSaveMsg(null);
    try {
      await saveDocument({
        slug: doc.slug,
        title: title.trim() || defaultTitle(doc.label),
        values,
        markdown: preview,
      });
      setSaveState("saved");
      setSaveMsg("Saved to your documents.");
    } catch (e) {
      setSaveState("error");
      setSaveMsg(
        e instanceof AuthError ? e.message : "Couldn't save. Please try again.",
      );
    }
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
    // Save-on-download, best effort.
    if (saveState === "idle") void handleSave();
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

      <p className="notice no-print">
        Preview only — Prelegal drafts are a starting point, not legal advice.
        Have a qualified lawyer review any agreement before signing.
      </p>

      <div className={styles.layout}>
        <div className="no-print">
          <DocChat document={selected} values={values} onResult={handleResult} />
        </div>

        <div className={styles.previewPanel}>
          {doc ? (
            <div className={`${styles.saveRow} no-print`}>
              <input
                className={styles.titleInput}
                value={title}
                onChange={(e) => {
                  titleTouched.current = true;
                  setTitle(e.target.value);
                }}
                placeholder="Document title"
                aria-label="Document title"
              />
              <button
                type="button"
                className="button"
                onClick={handleSave}
                disabled={saveState === "saving"}
              >
                {saveState === "saving" ? "Saving…" : "Save to my documents"}
              </button>
            </div>
          ) : null}
          {saveMsg ? (
            <p
              className={`${saveState === "error" ? styles.hint : styles.saved} no-print`}
            >
              {saveMsg}
            </p>
          ) : null}

          <div className={`${styles.actions} no-print`}>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleDownload}
              disabled={!ready}
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
          {doc && !ready ? (
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

export default function CreatePage() {
  return (
    <RequireAuth>
      <Create />
    </RequireAuth>
  );
}
