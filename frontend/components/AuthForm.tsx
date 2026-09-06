"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthError } from "@/lib/auth";
import styles from "./AuthForm.module.css";

type Mode = "login" | "register";

const COPY: Record<Mode, { title: string; cta: string; alt: string; altHref: string; altText: string }> = {
  login: {
    title: "Sign in",
    cta: "Sign in",
    alt: "New to Prelegal?",
    altHref: "/register",
    altText: "Create an account",
  },
  register: {
    title: "Create your account",
    cta: "Create account",
    alt: "Already have an account?",
    altHref: "/login",
    altText: "Sign in",
  },
};

function nextParam(): string {
  if (typeof window === "undefined") return "/tools/create";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/tools/create";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      router.replace(nextParam());
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <main className={`container ${styles.wrap}`}>
      <h1 className={styles.title}>{copy.title}</h1>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Password{mode === "register" ? " (8+ characters)" : ""}</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" className="button" disabled={busy}>
          {busy ? "…" : copy.cta}
        </button>
      </form>
      <p className={styles.alt}>
        {copy.alt} <Link href={copy.altHref}>{copy.altText}</Link>
      </p>
    </main>
  );
}
