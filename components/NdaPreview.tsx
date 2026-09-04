"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./NdaPreview.module.css";

/** Renders the assembled agreement Markdown as a formatted, printable document. */
export function NdaPreview({ markdown }: { markdown: string }) {
  return (
    <article className={`${styles.doc} print-target`}>
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  );
}
