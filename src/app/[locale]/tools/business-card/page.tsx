import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import BusinessCardPage from "@/features/tools/business-card/BusinessCardPage";

export const metadata: Metadata = {
  title: "Business Card - Srang Tech Mai",
  description: "Generate a print-ready STM business card — pick a ring, make it yours, spin it in 3D.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BusinessCardPage />;
}
