/**
 * ShowcasePage — placeholder for the work/identity gallery (currently empty). A single
 * centred section with the standard editorial primitives + the ambient locale read-link.
 */
import { useTranslations } from "next-intl";
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import { showcaseNavConfig } from "./nav.config";

export default function ShowcasePage() {
  const t = useTranslations("showcase");
  return (
    <>
      <Nav config={showcaseNavConfig} />
      <main>
        <section className="section">
          <div className="container">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1 className="heading">
              {t.rich("heading", { accent: (c) => <em className="accentWord">{c}</em> })}
            </h1>
            <p className="lede">{t("lede")}</p>
            <LocaleReadLink />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
