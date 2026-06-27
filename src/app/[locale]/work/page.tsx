import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import BuildPage from "@/features/build/BuildPage";

export const metadata: Metadata = {
  title: "How We Work - Srang Tech Mai",
  description:
    "How Srang Tech Mai works: not roles or departments, but small high-context teams, multi-disciplinary, high-agency, aligned but never isolated.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BuildPage />;
}
