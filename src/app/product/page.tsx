import type { Metadata } from "next";
import ProductPage from "@/features/product/ProductPage";

export const metadata: Metadata = {
  title: "Product - Srang Tech Mai",
  description: "Srang Tech Mai's product, coming soon.",
};

export default function Page() {
  return <ProductPage />;
}
