/**
 * Home nav behavior: hidden over the hero, revealed once scrolled past it; same-page
 * `#anchor` links; the STM wordmark links to the top of the page.
 */
import type { NavConfig } from "@/components/ui/Nav/Nav";
import styles from "@/components/ui/Nav/styles.module.css";

export const homeNavConfig: NavConfig = {
  styles,
  hideOverHero: true,
  pastClass: "navShown",
  ariaLabel: "Primary",
  anchorPrefix: "",
  brand: (
    <a className={styles.navBrand} href="#top" aria-label="Srang Tech Mai — top">
      <span className={styles.navMark} />
    </a>
  ),
};
