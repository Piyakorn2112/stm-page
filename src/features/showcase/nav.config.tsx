/**
 * Showcase nav behaviour: reuses the home (default) nav look but is ALWAYS visible
 * (`alwaysShown` — the page has no hero to scroll past). Section links point back to the
 * home page; the brand links home; the "Showcase" item is the current page.
 */
import Link from "next/link";
import type { NavConfig } from "@/components/ui/Nav/Nav";
import styles from "@/components/ui/Nav/styles.module.css";

export const showcaseNavConfig: NavConfig = {
  styles,
  hideOverHero: false,
  alwaysShown: true,
  pastClass: "navShown",
  ariaLabel: "Primary",
  anchorPrefix: "/",
  currentRoute: "/showcase",
  brand: (
    <Link className={styles.navBrand} href="/" aria-label="Srang Tech Mai, home">
      <span className={styles.navMark} />
    </Link>
  ),
};
