/**
 * Contact nav behaviour: reuses the home (default) nav look but is ALWAYS visible
 * (`alwaysShown` — there's no hero to scroll past); section links point back to the
 * home page (`/#anchor`); the brand links home; the "Contact Us" CTA is the current page.
 */
import Link from "next/link";
import type { NavConfig } from "@/components/ui/Nav/Nav";
import styles from "@/components/ui/Nav/styles.module.css";

export const contactNavConfig: NavConfig = {
  styles,
  hideOverHero: false,
  alwaysShown: true,
  pastClass: "navShown",
  ariaLabel: "Primary",
  anchorPrefix: "/",
  currentRoute: "/contact",
  brand: (
    <Link className={styles.navBrand} href="/" aria-label="Srang Tech Mai, home">
      <span className={styles.navMark} />
    </Link>
  ),
};
