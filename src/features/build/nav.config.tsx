/**
 * Build nav behavior: ALWAYS visible (frosted over the hero, firms up once scrolled);
 * section links point back to the home page (`/#anchor`); the current page is "Work";
 * the brand links home.
 */
import Link from "next/link";
import type { NavConfig } from "@/components/ui/Nav/Nav";
import styles from "@/features/build/build.module.css";

export const buildNavConfig: NavConfig = {
  styles,
  hideOverHero: false,
  pastClass: "navScrolled",
  anchorPrefix: "/",
  currentRoute: "/build",
  brand: (
    <Link className={styles.brand} href="/" aria-label="Srang Tech Mai, home">
      <span className={styles.brandMark} />
    </Link>
  ),
};
