/**
 * Srang Tech Mai — company page.
 *
 * The hero is the generative ring scene (the system, alive). Below it, calm
 * white/near-black sections carry the brand: positioning, the live System forge,
 * the product family, real-world use, philosophy, technology, and a CTA. Brand
 * colour appears only as accents. The ring system is the through-line.
 *
 * HomeReveal renders the hero and the content together (instant scroll); the
 * sections' live/heavy pieces lazy-mount as they scroll in, and the hero pauses
 * when it leaves the viewport.
 */

import SiteNav from "./components/site/SiteNav";
import HomeReveal from "./components/site/HomeReveal";
import {
  Mission,
  Philosophy,
  TakesForm,
  Identity,
  ProductFamily,
  Construction,
  CtaSection,
  SiteFooter,
} from "./components/site/Sections";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <HomeReveal>
          <Mission />
          <Philosophy />
          <TakesForm />
          <Identity />
          <ProductFamily />
          <Construction />
          <CtaSection />
        </HomeReveal>
      </main>
      <SiteFooter />
    </>
  );
}
