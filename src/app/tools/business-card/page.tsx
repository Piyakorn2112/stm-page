import type { Metadata } from "next";
import BusinessCardPage from "@/features/tools/business-card/BusinessCardPage";

export const metadata: Metadata = {
  title: "Business Card - Srang Tech Mai",
  description: "Generate a print-ready STM business card — pick a ring, make it yours, spin it in 3D.",
};

export default function Page() {
  return <BusinessCardPage />;
}
