import type { Metadata } from "next";
import ToolsPage from "@/features/tools/ToolsPage";

export const metadata: Metadata = {
  title: "Tools - Srang Tech Mai",
  description: "Generative studio tools built on the STM ring engine.",
};

export default function Page() {
  return <ToolsPage />;
}
