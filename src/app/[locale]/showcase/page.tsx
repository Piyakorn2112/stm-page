import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import ShowcasePage from "@/features/showcase/ShowcasePage";

export const metadata: Metadata = {
  title: "Showcase - Srang Tech Mai",
  description: "Selected work and generated identities from Srang Tech Mai.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ShowcasePage />;
}
