import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import ContactPage from "@/features/contact/ContactPage";

export const metadata: Metadata = {
  title: "Contact - Srang Tech Mai",
  description: "Get in touch with Srang Tech Mai.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactPage />;
}
