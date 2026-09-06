/**
 * Client for the document AI chat (`POST /api/chat`, Server-Sent Events).
 *
 * The backend runs the conversation and extracts field values; this module
 * streams its events. Two modes:
 *  - triage  (`document` null): the assistant works out which catalogue document
 *            the user needs, or says none fits and names the closest.
 *  - fill    (`document` set):  the assistant collects that document's fields.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CatalogEntry {
  slug: string;
  label: string;
  description: string;
}

export interface DocFieldSpec {
  name: string;
  label: string;
  hint: string;
}

export interface SelectedDocument {
  slug: string;
  label: string;
  description: string;
  fields: DocFieldSpec[];
  parties: { key: string; label: string }[];
}

export interface ChatRequest {
  catalog: CatalogEntry[];
  document: SelectedDocument | null;
  messages: ChatMessage[];
  fields: Record<string, string>;
}

export type ChatEvent =
  | { type: "token"; text: string }
  | {
      type: "result";
      reply: string;
      fields: Record<string, string | null>;
      missingFields: string[];
      readyToGenerate: boolean;
      degraded: boolean;
      /** In triage: the slug the assistant settled on, or null. */
      document: string | null;
      /** In triage: the closest slug when the request is unsupported. */
      suggestion: string | null;
    }
  | {
      type: "error";
      code: "unavailable" | "provider" | "network";
      message: string;
    };

export type ChatStatus = "enabled" | "disabled" | "unreachable";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const PROVIDER_MSG =
  "The AI service is unavailable right now. Try again in a moment.";
const NETWORK_MSG =
  "Couldn't reach the AI service. Check your connection or that the backend is running.";

/**
 * - `enabled`     — endpoint answered, an API key is configured
 * - `disabled`    — endpoint answered, no key configured
 * - `unreachable` — no `/api/chat` route / network error (wrong server, backend
 *                   down, or `NEXT_PUBLIC_API_BASE` unset in `next dev`)
 */
export async function chatStatus(signal?: AbortSignal): Promise<ChatStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, { signal });
    if (!res.ok) return "unreachable";
    const body = (await res.json()) as { enabled?: boolean };
    return body.enabled ? "enabled" : "disabled";
  } catch {
    return "unreachable";
  }
}

export async function* streamChat(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    yield { type: "error", code: "network", message: NETWORK_MSG };
    return;
  }

  if (!res.ok || !res.body) {
    yield { type: "error", code: "provider", message: PROVIDER_MSG };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = parseFrame(frame);
        if (event) yield event;
      }
    }
    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } catch {
    yield { type: "error", code: "network", message: NETWORK_MSG };
  }
}

/** Parse one SSE frame (`event:` + `data:` lines) into a `ChatEvent`. */
export function parseFrame(frame: string): ChatEvent | null {
  let name = "";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!name || dataLines.length === 0) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }

  if (name === "token") return { type: "token", text: String(data.text ?? "") };
  if (name === "result") {
    return {
      type: "result",
      reply: String(data.reply ?? ""),
      fields: (data.fields ?? {}) as Record<string, string | null>,
      missingFields: Array.isArray(data.missingFields)
        ? (data.missingFields as string[])
        : [],
      readyToGenerate: Boolean(data.readyToGenerate),
      degraded: Boolean(data.degraded),
      document: typeof data.document === "string" ? data.document : null,
      suggestion: typeof data.suggestion === "string" ? data.suggestion : null,
    };
  }
  if (name === "error") {
    const code =
      data.code === "unavailable" || data.code === "network"
        ? data.code
        : "provider";
    return { type: "error", code, message: String(data.message ?? PROVIDER_MSG) };
  }
  return null;
}

/**
 * Merge newly-extracted values onto the running set. A blank/null extracted
 * value leaves the current value untouched; otherwise the new value wins (the
 * backend re-derives the whole set each turn, carrying earlier answers forward).
 */
export function mergeFields(
  current: Record<string, string>,
  extracted: Record<string, string | null>,
): Record<string, string> {
  const next = { ...current };
  for (const [key, value] of Object.entries(extracted)) {
    if (typeof value === "string" && value.trim() !== "") next[key] = value.trim();
  }
  return next;
}
