import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import { toolsNavConfig } from "./nav.config";
import styles from "./tools.module.css";

/** The /tools index — a quiet list of the studio's generative utilities. */
const TOOLS = [
  {
    href: "/tools/business-card",
    name: "Business card",
    desc: "Pick a ring, make it yours, spin it in 3D, and export a print-ready card.",
  },
];

export default function ToolsPage() {
  return (
    <>
      <Nav config={toolsNavConfig} />
      <main className={styles.main}>
        <section className="section">
          <div className="container">
            <span className="eyebrow">Tools</span>
            <h1 className="heading">Generative tools</h1>
            <p className="lede">Small studio utilities built on the STM ring engine.</p>
            <ul className={styles.toolList}>
              {TOOLS.map((t) => (
                <li key={t.href}>
                  <Link className={styles.toolCard} href={t.href}>
                    <span className={styles.toolName}>
                      {t.name}
                      <ArrowUpRight size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <span className={styles.toolDesc}>{t.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
