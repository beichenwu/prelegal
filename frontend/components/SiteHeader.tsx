"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__brand">
          Prelegal
        </Link>
        <nav className="site-header__nav">
          <Link href="/#templates">Documents</Link>
          <Link href="/tools/create">Create</Link>
          {loading ? null : user ? (
            <>
              <Link href="/dashboard">My documents</Link>
              <span className="site-header__user">{user.email}</span>
              <button
                type="button"
                className="site-header__link-button"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link
                href={
                  pathname && pathname !== "/"
                    ? `/register?next=${encodeURIComponent(pathname)}`
                    : "/register"
                }
                className="button button--sm"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
