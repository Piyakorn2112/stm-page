import type { Metadata } from "next";
import ContactPage from "@/features/contact/ContactPage";

export const metadata: Metadata = {
  title: "Contact - Srang Tech Mai",
  description: "Get in touch with Srang Tech Mai.",
};

export default function Page() {
  return <ContactPage />;
}
