"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

/** Wraps a page that needs a signed-in user. Redirects to /login otherwise. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || user) return;
    const next = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    router.replace(`/login?next=${next}`);
  }, [loading, user, router]);

  if (loading) {
    return <p className="container auth-status">Loading…</p>;
  }
  if (!user) {
    return <p className="container auth-status">Redirecting to sign in…</p>;
  }
  return <>{children}</>;
}
