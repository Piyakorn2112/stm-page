"use client";

/**
 * BuildNav — unlike the homepage SiteNav, this bar is ALWAYS visible on /build. Over
 * the hero it carries the hero's off-white background (so it reads as part of the
 * scene); once you scroll past the hero it switches to the default translucent bar
 * over the white content. Brand links home; it carries the SAME full navigation as
 * the homepage, with the section links pointing back to the home page (`/#anchor`).
 * On mobile the links collapse behind a hamburger that expands the bar in height.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./build.module.css";
import NavInner from "../components/site/NavInner";
import { type NavItem } from "../components/site/navLinks";

export default function BuildNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > window.innerHeight * 0.5);
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

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const hrefFor = (i: NavItem) => i.route ?? `/#${i.anchor}`;
  const isCurrent = (i: NavItem) => i.route === "/build";

  return (
    <>
      <div
        className={`${styles.navScrim} ${open ? `${styles.navScrimShown} backdrop-blur-[5px]` : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        className={`${styles.nav} ${scrolled ? styles.navScrolled : ""} ${open ? styles.navOpen : ""} backdrop-blur-[12px]`}
      >
        <NavInner
          styles={styles}
          brand={
            <Link className={styles.brand} href="/" aria-label="Srang Tech Mai — home">
              <span className={styles.brandMark} />
            </Link>
          }
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
