/**
 * HomePage — the home feature composition. Nav + hero (HomeReveal) + the content sections
 * + footer. The route file (app/page.tsx) only renders this.
 */
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import CtaSection from "@/components/ui/CtaSection/CtaSection";
import { homeNavConfig } from "./nav.config";
import HomeReveal from "./HomeReveal";
import { Mission } from "./sections/Mission";
import { Philosophy } from "./sections/Philosophy";
import { TakesForm } from "./sections/TakesForm";
import { Identity } from "./sections/Identity";
import { Products } from "./sections/Products";

export default function HomePage() {
  return (
    <>
      <Nav config={homeNavConfig} />
      <main>
        <HomeReveal>
          <Mission />
          <Philosophy />
          <TakesForm />
          <Identity />
          <Products />
        </HomeReveal>
        <CtaSection
          title="Ready to build something that lasts?"
          body="Tell us what you're working on. We move fast, think through details, and stay until the thing is right."
          alt
        />
      </main>
      <Footer />
    </>
  );
}
