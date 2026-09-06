/** Saved-document API client. Every call carries the bearer token. */

import { authHeaders, AuthError, clearToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export interface SavedDocumentSummary {
  id: number;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SavedDocument extends SavedDocumentSummary {
  values: Record<string, string>;
  markdown: string;
}

export interface NewDocument {
  slug: string;
  title: string;
  values: Record<string, string>;
  markdown: string;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...authHeaders() },
    });
  } catch {
    throw new AuthError(0, "Couldn't reach the server.");
  }
  if (res.status === 401) {
    clearToken();
    throw new AuthError(401, "Your session has expired. Please sign in again.");
  }
  return res;
}

export async function listDocuments(): Promise<SavedDocumentSummary[]> {
  const res = await request("/api/documents");
  if (!res.ok) throw new AuthError(res.status, "Couldn't load your documents.");
  return res.json();
}

export async function getDocument(id: number): Promise<SavedDocument> {
  const res = await request(`/api/documents/${id}`);
  if (!res.ok) throw new AuthError(res.status, "Couldn't open that document.");
  return res.json();
}

export async function saveDocument(doc: NewDocument): Promise<SavedDocument> {
  const res = await request("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new AuthError(res.status, "Couldn't save the document.");
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await request(`/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new AuthError(res.status, "Couldn't delete the document.");
  }
}
