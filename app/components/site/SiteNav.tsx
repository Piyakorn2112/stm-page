"use client";

/**
 * SiteNav — fixed top navigation that stays hidden over the hero and only
 * appears once you've scrolled past half of it, then sits as a translucent bar
 * over the content. Brand is the STM long wordmark (dark-mode inverted via CSS).
 * On mobile the links collapse behind a hamburger that EXPANDS the bar in height
 * (Apple-style), with a darken+blur scrim over the page behind.
 */

import { useEffect, useState } from "react";
import styles from "./site.module.css";
import NavInner from "./NavInner";
import { type NavItem } from "./navLinks";

export default function SiteNav() {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const s = window.scrollY > window.innerHeight * 0.5;
      setShown(s);
      if (!s) setOpen(false); // nav hides at the top ⇒ close the menu/scrim with it
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
  }, []);

  // close the mobile menu once the layout is back to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const hrefFor = (i: NavItem) => i.route ?? `#${i.anchor}`;

  return (
    <>
      <div
        className={`${styles.navScrim} ${shown && open ? `${styles.navScrimShown} backdrop-blur-[5px]` : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        className={`${styles.nav} ${shown ? styles.navShown : ""} ${open ? styles.navOpen : ""} backdrop-blur-[12px]`}
        aria-label="Primary"
        aria-hidden={!shown}
      >
        <NavInner
          styles={styles}
          brand={
            <a className={styles.navBrand} href="#top" aria-label="Srang Tech Mai — top">
              <span className={styles.navMark} />
            </a>
          }
          hrefFor={hrefFor}
          open={open}
          onToggle={() => setOpen((v) => !v)}
          onNavigate={() => setOpen(false)}
        />
      </nav>
    </>
  );
}
