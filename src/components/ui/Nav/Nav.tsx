"use client";

/**
 * Nav — the single primary navigation, shared by every page. Per-page behaviour is
 * supplied by a `NavConfig` (see each feature's `nav.config.tsx`), so the scroll/menu
 * logic lives in ONE place:
 *   • home  — hidden over the hero, revealed once scrolled past half the viewport
 *             (`hideOverHero: true`); the menu closes when the bar hides.
 *   • build — always visible; the bar just firms up once scrolled past the hero
 *             (`hideOverHero: false`).
 * On mobile the links collapse behind a hamburger that EXPANDS the bar in height
 * (Apple-style) with a darken+blur scrim. The look (translucent vs frosted) comes from
 * the CSS module each config passes in.
 */

import { useEffect, useState, type ReactNode } from "react";
import NavInner from "./NavInner";
import { type NavItem } from "./navLinks";

// NOTE: this config crosses the server→client boundary (pages are Server Components),
// so it must stay SERIALISABLE — no functions. The href/current predicates are derived
// from `anchorPrefix`/`currentRoute` INSIDE this client component.
export type NavConfig = {
  /** the page's nav CSS module (its look) */
  styles: Record<string, string>;
  /** brand element (wordmark/link), styled by the page's module */
  brand: ReactNode;
  /** prefix for in-page anchor links: "" (home ⇒ `#about`) or "/" (build ⇒ `/#about`) */
  anchorPrefix: string;
  /** the route to mark as the current page, e.g. "/build" (omit on the home nav) */
  currentRoute?: string;
  /** true ⇒ hidden over the hero, revealed past 50vh (home); false ⇒ always visible (build) */
  hideOverHero: boolean;
  /** class applied once scrolled past the hero (`navShown` home / `navScrolled` build) */
  pastClass: string;
  /** apply `pastClass` immediately (no scroll) — for pages with no hero to reveal past
   *  (e.g. /contact reuses the home look but must show its bar from the top) */
  alwaysShown?: boolean;
  ariaLabel?: string;
};

export default function Nav({ config }: { config: NavConfig }) {
  const { styles, brand, anchorPrefix, currentRoute, hideOverHero, pastClass, alwaysShown, ariaLabel } = config;
  const hrefFor = (i: NavItem) => i.route ?? `${anchorPrefix}#${i.anchor}`;
  const isCurrent = (i: NavItem) => currentRoute !== undefined && i.route === currentRoute;
  const [past, setPast] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = window.scrollY > window.innerHeight * 0.5;
      setPast(p);
      if (hideOverHero && !p) setOpen(false); // bar hides at the top ⇒ close the menu with it
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hideOverHero]);

  // close the mobile menu once the layout is back to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const shown = hideOverHero ? past : true; // whether the bar is interactive

  return (
    <>
      <div
        className={`${styles.navScrim} ${shown && open ? `${styles.navScrimShown} backdrop-blur-[5px]` : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        className={`${styles.nav} ${past || alwaysShown ? styles[pastClass] : ""} ${open ? styles.navOpen : ""} backdrop-blur-[12px]`}
        aria-label={ariaLabel}
        aria-hidden={hideOverHero ? !past : undefined}
      >
        <NavInner
          styles={styles}
          brand={brand}
          hrefFor={hrefFor}
          isCurrent={isCurrent}
          open={open}
          onToggle={() => setOpen((v) => !v)}
          onNavigate={() => setOpen(false)}
        />
      </nav>
    </>
  );
}
