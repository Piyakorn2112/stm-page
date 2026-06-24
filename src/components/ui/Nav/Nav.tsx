"use client";

/**
 * Nav — the single primary navigation, shared by every page. Per-page behaviour is
 * supplied by a `NavConfig` (see each feature's `nav.config.tsx`), so the scroll/menu
 * logic lives in ONE place:
 *   • home  — hidden over the hero, revealed once scrolled past half the viewport
 *             (`hideOverHero: true`); the menu closes when the bar hides. On desktop it also
 *             peeks open on hover near the top edge, independent of scroll position.
 *   • build — always visible; the bar just firms up once scrolled past the hero
 *             (`hideOverHero: false`).
 * On mobile the links collapse behind a hamburger that EXPANDS the bar in height
 * (Apple-style) with a darken+blur scrim. The look (translucent vs frosted) comes from
 * the CSS module each config passes in.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import NavInner from "./NavInner";
import { type NavItem } from "./navLinks";

const HOVER_REVEAL_PX = 96; // px from the top — hovering here peeks a hidden-over-hero bar (desktop only)

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
  const [hovered, setHovered] = useState(false); // desktop-only: peeking the bar on hover, before scrolling past the hero
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false); // desktop "Product" mega sheet
  const megaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openMega = () => {
    clearTimeout(megaTimer.current);
    setProductOpen(true);
  };
  const scheduleCloseMega = () => {
    clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setProductOpen(false), 120); // hover-intent grace
  };
  const closeMega = () => {
    clearTimeout(megaTimer.current);
    setProductOpen(false);
  };

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = window.scrollY > window.innerHeight * 0.5;
      setPast(p);
      setProductOpen(false); // scrolling dismisses the mega sheet (Apple-style)
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

  // Desktop-only "peek": hovering the top strip reveals the bar (same curve as the scroll
  // reveal) without touching the scroll-driven `past` state or its menu-close side effect.
  useEffect(() => {
    if (!hideOverHero) return;
    const mq = window.matchMedia("(min-width: 721px)");
    const reset = () => setHovered(false);
    const onMove = (e: MouseEvent) => {
      if (!mq.matches) return;
      clearTimeout(hoverTimer.current);
      if (e.clientY < HOVER_REVEAL_PX) {
        setHovered(true);
      } else {
        hoverTimer.current = setTimeout(() => setHovered(false), 160); // grace, avoids edge flicker
      }
    };
    mq.addEventListener?.("change", reset);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", reset);
    return () => {
      mq.removeEventListener?.("change", reset);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", reset);
      clearTimeout(hoverTimer.current);
    };
  }, [hideOverHero]);

  // close the mobile menu once the layout is back to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const shown = hideOverHero ? past || hovered : true; // whether the bar is interactive

  return (
    <>
      <div
        className={`${styles.navScrim} ${(shown && open) || productOpen ? `${styles.navScrimShown} backdrop-blur-[5px]` : ""}`}
        onClick={() => {
          setOpen(false);
          closeMega();
        }}
        aria-hidden
      />
      <nav
        className={`${styles.nav} ${past || alwaysShown || hovered ? styles[pastClass] : ""} ${open ? styles.navOpen : ""} backdrop-blur-[12px]`}
        data-product-open={productOpen ? "1" : undefined}
        aria-label={ariaLabel}
        aria-hidden={hideOverHero ? !(past || hovered) : undefined}
      >
        <NavInner
          styles={styles}
          brand={brand}
          hrefFor={hrefFor}
          isCurrent={isCurrent}
          open={open}
          onToggle={() => {
            setOpen((v) => !v);
            closeMega(); // never leave the desktop mega (and its scrim) lingering
          }}
          onNavigate={() => {
            setOpen(false);
            closeMega();
          }}
          productOpen={productOpen}
          onMegaEnter={openMega}
          onMegaLeave={scheduleCloseMega}
          closeMega={closeMega}
        />
      </nav>
    </>
  );
}
