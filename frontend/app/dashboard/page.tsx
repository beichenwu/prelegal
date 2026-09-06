"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { NdaPreview } from "@/components/NdaPreview";
import { RequireAuth } from "@/components/RequireAuth";
import { AuthError } from "@/lib/auth";
import {
  deleteDocument,
  getDocument,
  listDocuments,
  type SavedDocument,
  type SavedDocumentSummary,
} from "@/lib/documentsApi";
import { DOCUMENT_CATALOG } from "@/lib/documents";
import styles from "./dashboard.module.css";

const labelFor = (slug: string) =>
  DOCUMENT_CATALOG.find((d) => d.slug === slug)?.label ?? slug;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function Dashboard() {
  const [docs, setDocs] = useState<SavedDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [open, setOpen] = useState<SavedDocument | null>(null);
  const [openBusy, setOpenBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    listDocuments()
      .then(setDocs)
      .catch((e) =>
        setError(e instanceof AuthError ? e.message : "Couldn't load your documents."),
      );
  }, []);

  useEffect(load, [load]);

  async function toggle(id: number) {
    if (openId === id) {
      setOpenId(null);
      setOpen(null);
      return;
    }
    setOpenId(id);
    setOpen(null);
    setOpenBusy(true);
    try {
      setOpen(await getDocument(id));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't open that document.");
      setOpenId(null);
    } finally {
      setOpenBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this document? This can't be undone.")) return;
    try {
      await deleteDocument(id);
      if (openId === id) {
        setOpenId(null);
        setOpen(null);
      }
      setDocs((prev) => (prev ?? []).filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't delete the document.");
    }
  }

  function download(doc: SavedDocument) {
    const blob = new Blob([doc.markdown], { type: "text/markdown;charset=utf-8" });
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
      <div className={styles.head}>
        <h1>My documents</h1>
        <Link href="/tools/create" className="button">
          New document
        </Link>
      </div>

      <p className="notice">
        Preview only — every draft here should be reviewed by a qualified lawyer
        before use.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {docs === null && !error ? (
        <p className={styles.muted}>Loading…</p>
      ) : docs && docs.length === 0 ? (
        <p className={styles.muted}>
          Nothing saved yet. <Link href="/tools/create">Create your first agreement</Link>.
        </p>
      ) : (
        <ul className={styles.list}>
          {docs?.map((d) => (
            <li key={d.id} className={styles.item}>
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => toggle(d.id)}
                  aria-expanded={openId === d.id}
                >
                  <span className={styles.docTitle}>{d.title}</span>
                  <span className={styles.meta}>
                    {labelFor(d.slug)} · {fmtDate(d.updated_at)}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => remove(d.id)}
                >
                  Delete
                </button>
              </div>

              {openId === d.id ? (
                <div className={styles.detail}>
                  {openBusy || !open ? (
                    <p className={styles.muted}>Loading…</p>
                  ) : (
                    <>
                      <div className={styles.detailActions}>
                        <button
                          type="button"
                          className="button button--sm"
                          onClick={() => download(open)}
                        >
                          Download .md
                        </button>
                      </div>
                      <NdaPreview markdown={open.markdown} />
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
