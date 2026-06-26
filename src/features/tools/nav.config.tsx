/**
 * Tools nav behaviour: reuses the home (default) nav look but is ALWAYS visible
 * (`alwaysShown` — the tool pages have no hero to scroll past). The brand links home;
 * section links point back to the home page. `/tools*` is intentionally NOT in
 * NAV_ITEMS yet, so no item is marked current.
 */
import Link from "next/link";
import type { NavConfig } from "@/components/ui/Nav/Nav";
import styles from "@/components/ui/Nav/styles.module.css";

export const toolsNavConfig: NavConfig = {
  styles,
  hideOverHero: false,
  alwaysShown: true,
  pastClass: "navShown",
  ariaLabel: "Primary",
  anchorPrefix: "/",
  brand: (
    <Link className={styles.navBrand} href="/" aria-label="Srang Tech Mai, home">
      <span className={styles.navMark} />
    </Link>
  ),
};
