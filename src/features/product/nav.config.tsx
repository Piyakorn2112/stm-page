/**
 * Product nav behaviour: reuses the home (default) nav look but is ALWAYS visible
 * (`alwaysShown` — there's no hero to scroll past); the brand links home; "Product" is
 * the current page.
 */
import Link from "next/link";
import type { NavConfig } from "@/components/ui/Nav/Nav";
import styles from "@/components/ui/Nav/styles.module.css";

export const productNavConfig: NavConfig = {
  styles,
  hideOverHero: false,
  alwaysShown: true,
  pastClass: "navShown",
  ariaLabel: "Primary",
  anchorPrefix: "/",
  currentRoute: "/product",
  brand: (
    <Link className={styles.navBrand} href="/" aria-label="Srang Tech Mai, home">
      <span className={styles.navMark} />
    </Link>
  ),
};
