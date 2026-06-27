import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import LocaleReadLink from "@/components/ui/LocaleReadLink/LocaleReadLink";
import { toolsNavConfig } from "./nav.config";
import styles from "./tools.module.css";

/** The /tools index — a quiet list of the studio's generative utilities. */
const TOOLS = [{ id: "businessCard", href: "/tools/business-card" }] as const;

export default function ToolsPage() {
  const t = useTranslations("tools");
  return (
    <>
      <Nav config={toolsNavConfig} />
      <main className={styles.main}>
        <section className="section">
          <div className="container">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1 className="heading">{t("heading")}</h1>
            <p className="lede">{t("lede")}</p>
            <ul className={styles.toolList}>
              {TOOLS.map((tool) => (
                <li key={tool.href}>
                  <Link className={styles.toolCard} href={tool.href}>
                    <span className={styles.toolName}>
                      {t(`items.${tool.id}.name`)}
                      <ArrowUpRight size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <span className={styles.toolDesc}>{t(`items.${tool.id}.desc`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <LocaleReadLink />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
