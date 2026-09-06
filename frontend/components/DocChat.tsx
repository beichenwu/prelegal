"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DOCUMENT_CATALOG } from "@/lib/documents";
import {
  chatStatus,
  mergeFields,
  streamChat,
  type ChatMessage,
  type ChatStatus,
  type SelectedDocument,
} from "@/lib/chat";
import styles from "./DocChat.module.css";

const STORAGE_KEY = "prelegal.chat.v1";

export interface DocChatResult {
  /** Slug the assistant settled on during triage (null until it does). */
  document: string | null;
  /** All collected values so far (merged). */
  fields: Record<string, string>;
  ready: boolean;
  missing: string[];
}

interface DocChatProps {
  /** The chosen document, or null while still working out which one. */
  document: SelectedDocument | null;
  /** Values collected so far, owned by the page. */
  values: Record<string, string>;
  onResult: (result: DocChatResult) => void;
}

const labelFor = (slug: string) =>
  DOCUMENT_CATALOG.find((d) => d.slug === slug)?.label ?? slug;

export function DocChat({ document, values, onResult }: DocChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus | "checking">("checking");
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as ChatMessage[]);
    } catch {
      /* ignore */
    }
  }, []);

  const probe = useCallback(() => {
    setStatus("checking");
    const controller = new AbortController();
    chatStatus(controller.signal).then(setStatus);
    return () => controller.abort();
  }, []);

  useEffect(() => probe(), [probe]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming || status !== "enabled") return;

      const history = [...messages, { role: "user" as const, content: text.trim() }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setInput("");
      setError(null);
      setReady(false);
      setSuggestion(null);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const grow = (chunk: string) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });

      for await (const event of streamChat(
        { catalog: DOCUMENT_CATALOG, document, messages: history, fields: values },
        controller.signal,
      )) {
        if (event.type === "token") {
          grow(event.text);
        } else if (event.type === "result") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: event.reply };
            return next;
          });
          setReady(event.readyToGenerate);
          setSuggestion(event.suggestion);
          onResult({
            document: event.document,
            fields: mergeFields(values, event.fields),
            ready: event.readyToGenerate,
            missing: event.missingFields,
          });
        } else {
          setError(event.message);
          if (event.code === "unavailable") setStatus("disabled");
          setMessages((prev) =>
            prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev,
          );
        }
      }

      setStreaming(false);
      abortRef.current = null;
    },
    [streaming, status, messages, document, values, onResult],
  );

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setReady(false);
    setConfirmed(false);
    setSuggestion(null);
    setStreaming(false);
  };

  if (status === "disabled" || status === "unreachable") {
    return (
      <div className={styles.panel}>
        <p className={styles.disabled}>
          {status === "disabled"
            ? "AI chat isn't configured on this server (no API key)."
            : "Can't reach the AI chat service. If the backend was just started, retry."}
        </p>
        {status === "unreachable" ? (
          <button type="button" className="button button--ghost" onClick={probe}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const busy = streaming || status === "checking";

  return (
    <div className={styles.panel}>
      <div className={styles.transcript} ref={scrollRef}>
        {messages.length === 0 ? (
          <p className={styles.hello}>
            {document
              ? `Tell me the key terms for your ${document.label} and I'll ask for the rest.`
              : "What are you trying to put in place? Describe the situation and I'll pick the right document."}
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? styles.user : styles.assistant}
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))
        )}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {suggestion && !document ? (
        <div className={styles.suggestRow}>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void send(`Yes, let's use the ${labelFor(suggestion)}.`)}
          >
            Use the {labelFor(suggestion)} instead
          </button>
        </div>
      ) : null}

      {ready && !confirmed ? (
        <div className={styles.readyRow}>
          <span>All required details are in. Generate the draft?</span>
          <div className={styles.readyActions}>
            <button
              type="button"
              className="button"
              onClick={() => {
                setConfirmed(true);
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content:
                      "Your draft is ready — review it in the preview and download it when you're happy.",
                  },
                ]);
              }}
            >
              Generate draft
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setReady(false)}
            >
              Keep editing
            </button>
          </div>
        </div>
      ) : null}

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          className={styles.input}
          value={input}
          placeholder="Type your message…"
          rows={2}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <div className={styles.composerActions}>
          <button
            type="button"
            className={styles.reset}
            onClick={reset}
            disabled={messages.length === 0 && !streaming}
          >
            Reset chat
          </button>
          <button type="submit" className="button" disabled={!input.trim() || busy}>
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
