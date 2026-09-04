import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mutual NDA creator",
  description:
    "Fill in the key terms and party details to generate a Mutual NDA from the Common Paper standard template, then download or print it.",
};

export default function MutualNdaLayout({ children }: { children: ReactNode }) {
  return children;
}
