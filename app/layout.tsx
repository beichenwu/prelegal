import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Prelegal",
    template: "%s · Prelegal",
  },
  description:
    "Prelegal helps teams handle contracts before they reach the lawyers — starting with a Mutual NDA creator.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container site-header__inner">
            <Link href="/" className="site-header__brand">
              Prelegal
            </Link>
            <nav className="site-header__nav">
              <Link href="/">Home</Link>
              <Link href="/tools/mutual-nda">Mutual NDA creator</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            <p>
              Prototype. Generated agreements are drafts based on the{" "}
              <a href="https://commonpaper.com/standards/mutual-nda/1.0">
                Common Paper Mutual NDA (v1.0)
              </a>
              , used under CC&nbsp;BY&nbsp;4.0. Not legal advice.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
