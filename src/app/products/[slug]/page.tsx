import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCTS } from "@/components/ui/Nav/navLinks";
import ProductDetailPage from "@/features/product/ProductDetailPage";

// Prerender one static page per product (the site is statically exported).
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  return { title: `${product?.label ?? "Product"} - Srang Tech Mai` };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();
  return <ProductDetailPage name={product.label} />;
}
