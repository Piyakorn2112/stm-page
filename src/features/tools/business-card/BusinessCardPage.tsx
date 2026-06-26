import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import BusinessCardTool from "./BusinessCardTool";
import { toolsNavConfig } from "../nav.config";

export default function BusinessCardPage() {
  return (
    <>
      <Nav config={toolsNavConfig} />
      <main>
        <BusinessCardTool />
      </main>
      <Footer />
    </>
  );
}
