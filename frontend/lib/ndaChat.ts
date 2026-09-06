/**
 * Client for the Mutual NDA AI chat (`POST /api/nda/chat`, Server-Sent Events).
 *
 * The backend does conversation + field extraction; this module streams its
 * events and merges the extracted fields onto the same `NdaFormValues` the
 * guided form edits, so the live preview and download path are unchanged.
 */

import type { NdaFormValues, PartyDetails } from "@/lib/mutualNda";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** A party as returned by the backend — every value may be missing or null. */
export interface ExtractedParty {
  name?: string | null;
  title?: string | null;
  company?: string | null;
  noticeAddress?: string | null;
}

/** Partial NDA fields as returned by the backend — every value may be null. */
export interface ExtractedFields {
  purpose?: string | null;
  effectiveDate?: string | null;
  mndaTermKind?: "years" | "until_terminated" | null;
  mndaTermYears?: number | null;
  confidentialityTermKind?: "years" | "perpetuity" | null;
  confidentialityTermYears?: number | null;
  governingLaw?: string | null;
  jurisdiction?: string | null;
  modifications?: string | null;
  party1?: ExtractedParty | null;
  party2?: ExtractedParty | null;
}

export type ChatEvent =
  | { type: "token"; text: string }
  | {
      type: "result";
      reply: string;
      fields: ExtractedFields;
      missingFields: string[];
      readyToGenerate: boolean;
      degraded: boolean;
    }
  | {
      type: "error";
      code: "unavailable" | "provider" | "network";
      message: string;
    };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const PROVIDER_MSG =
  "The AI service is unavailable right now. Try again in a moment, or switch to the guided form.";
const NETWORK_MSG =
  "Couldn't reach the AI service. Check your connection, or switch to the guided form.";

/** Is the chat configured on the server (i.e. an API key is present)? */
export async function chatEnabled(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/nda/chat`, { signal });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: boolean };
    return Boolean(body.enabled);
  } catch {
    return false;
  }
}

export async function* streamNdaChat(
  messages: ChatMessage[],
  fields: ExtractedFields,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/nda/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, fields }),
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
      fields: (data.fields ?? {}) as ExtractedFields,
      missingFields: Array.isArray(data.missingFields)
        ? (data.missingFields as string[])
        : [],
      readyToGenerate: Boolean(data.readyToGenerate),
      degraded: Boolean(data.degraded),
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

/** Merge extracted fields onto current form values. A blank or null extracted
 * value leaves the current value untouched; otherwise the extracted value wins
 * (the backend re-derives the full field set from the whole conversation each
 * turn, so it already carries earlier answers forward). */
export function applyExtracted(
  values: NdaFormValues,
  extracted: ExtractedFields,
): NdaFormValues {
  const text = (current: string, next?: string | null): string =>
    typeof next === "string" && next.trim() !== "" ? next : current;

  const count = (current: number, next?: number | null): number =>
    typeof next === "number" && Number.isFinite(next) ? next : current;

  const party = (
    current: PartyDetails,
    next?: ExtractedParty | null,
  ): PartyDetails =>
    next
      ? {
          name: text(current.name, next.name),
          title: text(current.title, next.title),
          company: text(current.company, next.company),
          noticeAddress: text(current.noticeAddress, next.noticeAddress),
        }
      : current;

  return {
    purpose: text(values.purpose, extracted.purpose),
    effectiveDate: text(values.effectiveDate, extracted.effectiveDate),
    mndaTermKind: extracted.mndaTermKind ?? values.mndaTermKind,
    mndaTermYears: count(values.mndaTermYears, extracted.mndaTermYears),
    confidentialityTermKind:
      extracted.confidentialityTermKind ?? values.confidentialityTermKind,
    confidentialityTermYears: count(
      values.confidentialityTermYears,
      extracted.confidentialityTermYears,
    ),
    governingLaw: text(values.governingLaw, extracted.governingLaw),
    jurisdiction: text(values.jurisdiction, extracted.jurisdiction),
    modifications: text(values.modifications, extracted.modifications),
    party1: party(values.party1, extracted.party1),
    party2: party(values.party2, extracted.party2),
  };
}
