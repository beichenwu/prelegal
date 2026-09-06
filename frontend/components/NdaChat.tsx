"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NdaFormValues } from "@/lib/mutualNda";
import {
  applyExtracted,
  chatStatus,
  streamNdaChat,
  type ChatMessage,
  type ChatStatus,
} from "@/lib/ndaChat";
import styles from "./NdaChat.module.css";

const STORAGE_KEY = "prelegal.nda.chat.v1";

interface NdaChatProps {
  values: NdaFormValues;
  errors: { field: string }[];
  onChange: (next: NdaFormValues) => void;
}

export function NdaChat({ values, errors, onChange }: NdaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus | "checking">("checking");
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Restore a prior conversation.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as ChatMessage[]);
    } catch {
      /* ignore unreadable storage */
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
      /* ignore unwritable storage */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || status !== "enabled") return;

    const history = [...messages, { role: "user" as const, content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setReady(false);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const appendToAssistant = (chunk: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: next[next.length - 1].content + chunk,
        };
        return next;
      });

    for await (const event of streamNdaChat(history, values, controller.signal)) {
      if (event.type === "token") {
        appendToAssistant(event.text);
      } else if (event.type === "result") {
        onChange(applyExtracted(values, event.fields));
        setReady(event.readyToGenerate);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: event.reply };
          return next;
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
  }, [input, streaming, status, messages, values, onChange]);

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setReady(false);
    setConfirmed(false);
    setStreaming(false);
  };

  if (status === "disabled" || status === "unreachable") {
    return (
      <div className={styles.panel}>
        <p className={styles.disabled}>
          {status === "disabled"
            ? "AI chat isn't configured on this server (no API key). Use the guided form to continue."
            : "Can't reach the AI chat service. If the backend was just started, retry — otherwise use the guided form."}
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
            Describe the NDA you need — who the parties are and why they&rsquo;re
            sharing information — and I&rsquo;ll ask for the rest.
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
              disabled={errors.length > 0}
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
          void send();
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
              void send();
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
          <button
            type="submit"
            className="button"
            disabled={!input.trim() || busy}
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
