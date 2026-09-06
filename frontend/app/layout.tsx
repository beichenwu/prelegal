import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Prelegal",
    template: "%s · Prelegal",
  },
  description:
    "Prelegal helps teams draft standard business agreements before they reach the lawyers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <div className="container">
              <p>
                <strong>Preview only.</strong> Generated agreements are drafts
                built from{" "}
                <a href="https://commonpaper.com">Common Paper</a> standards
                (CC&nbsp;BY&nbsp;4.0). They are not legal advice — have a
                qualified lawyer review any document before you sign it.
              </p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
