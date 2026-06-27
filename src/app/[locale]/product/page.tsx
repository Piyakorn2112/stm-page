import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import ProductPage from "@/features/product/ProductPage";

export const metadata: Metadata = {
  title: "Product - Srang Tech Mai",
  description: "Srang Tech Mai's product, coming soon.",
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductPage />;
}
