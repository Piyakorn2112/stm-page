import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import ToolsPage from "@/features/tools/ToolsPage";

export const metadata: Metadata = {
  title: "Tools - Srang Tech Mai",
  description: "Generative studio tools built on the STM ring engine.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ToolsPage />;
}
