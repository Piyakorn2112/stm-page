"use client";

/**
 * NavInner — the shared inner contents of both navs: a top row (brand + mobile hamburger),
 * the link list, and the "Product" MEGA-MENU. On desktop `.navTop` is `display:contents` so the
 * brand sits directly in the nav's flex row; the links centre and the CTA pins right. On mobile
 * `.navTop` is the bar's own row and the links collapse into a drawer the hamburger expands.
 *
 * PRODUCT MEGA-MENU (shared `mega.module.css`, token-based, Inter type):
 *  • Desktop — hovering "Product" expands a blurred sheet below the bar (max-height, same easing
 *    as the mobile drawer); a VERTICAL, left-aligned list of big bold product names + a "View all
 *    products" link, all aligned to the nav's gutter. Open state lives in Nav so the bar's bottom
 *    border can hide while it's expanded (one seamless surface).
 *  • Mobile — tapping "Product" slides the main items left (fading) and reveals the products panel
 *    (each row a small lucide chevron + a back affordance). The drawer height tracks the ACTIVE
 *    panel (dynamic), so the main view isn't padded out by the taller products list.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { NAV_ICON_SIZE, NAV_ICON_STROKE, NAV_ITEMS, PRODUCTS, productAnchor, type NavItem } from "./navLinks";
import mega from "./mega.module.css";

const ALL_PRODUCTS_HREF = "/product"; // the "View all products" overview

export default function NavInner({
  styles,
  brand,
  hrefFor,
  isCurrent,
  open,
  onToggle,
  onNavigate,
  productOpen,
  onMegaEnter,
  onMegaLeave,
  closeMega,
}: {
  styles: Record<string, string>;
  brand: ReactNode;
  hrefFor: (item: NavItem) => string;
  isCurrent?: (item: NavItem) => boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  productOpen: boolean;
  onMegaEnter: () => void;
  onMegaLeave: () => void;
  closeMega: () => void;
}) {
  const [mobileProducts, setMobileProducts] = useState(false); // mobile slide-in panel
  const sliderRef = useRef<HTMLDivElement>(null);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const productsPanelRef = useRef<HTMLDivElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const megaInnerRef = useRef<HTMLDivElement>(null);

  // Desktop mega: animate the MEASURED height (0 ↔ content) so the full ease-standard curve maps
  // onto the visible expand — identical feel to the mobile slider (a max-height overshoot reads linear).
  useEffect(() => {
    if (megaRef.current && megaInnerRef.current) {
      megaRef.current.style.height = productOpen ? `${megaInnerRef.current.offsetHeight}px` : "0px";
    }
  }, [productOpen]);

  // Dynamic mobile drawer height: size the slider to the ACTIVE panel (a DOM write, not setState,
  // so it doesn't trip the set-state-in-effect rule). Desktop panels are display:contents ⇒
  // offsetHeight 0 ⇒ skipped, so the explicit height only affects mobile.
  useEffect(() => {
    const active = mobileProducts ? productsPanelRef.current : mainPanelRef.current;
    if (active && active.offsetHeight > 0 && sliderRef.current) {
      sliderRef.current.style.height = `${active.offsetHeight}px`;
    }
  }, [mobileProducts, open]);

  // toggling the burger always returns to the main view (so reopening starts there)
  const toggle = () => {
    setMobileProducts(false);
    onToggle();
  };
  const navTo = () => {
    closeMega();
    setMobileProducts(false);
    onNavigate();
  };

  return (
    <>
      <div className={styles.navRow}>
        <div className={styles.navTop}>
          {brand}
          <button
            type="button"
            className={styles.navBurger}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={toggle}
          >
            {open ? <X size={22} strokeWidth={2} aria-hidden /> : <Menu size={22} strokeWidth={2} aria-hidden />}
          </button>
        </div>

        <div className={styles.navLinks}>
        <div ref={sliderRef} className={mega.slider} data-products={mobileProducts ? "1" : "0"}>
          <div ref={mainPanelRef} className={mega.panelMain}>
            {NAV_ITEMS.map((item) => {
              const { label, Icon } = item;
              const current = isCurrent?.(item) ?? false;
              // CTA → tight outlined pill with an always-visible icon
              if (item.cta) {
                return (
                  <Link
                    key={label}
                    className={styles.navCta}
                    href={hrefFor(item)}
                    aria-current={current ? "page" : undefined}
                    onClick={navTo}
                  >
                    {Icon ? <Icon size={NAV_ICON_SIZE} strokeWidth={2.5} aria-hidden /> : null}
                    {label}
                  </Link>
                );
              }
              const isMega = !!item.mega;
              const cls = `${styles.navLink} ${current ? styles.navLinkActive : ""}`;
              const inner = (
                <>
                  {Icon ? (
                    <span className={styles.navIcon} aria-hidden>
                      <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
                    </span>
                  ) : null}
                  {label}
                </>
              );
              if (!item.route) {
                return (
                  <a key={label} className={cls} href={hrefFor(item)} onClick={navTo}>
                    {inner}
                  </a>
                );
              }
              return (
                <Link
                  key={label}
                  className={cls}
                  href={hrefFor(item)}
                  aria-current={current ? "page" : undefined}
                  aria-haspopup={isMega ? "true" : undefined}
                  aria-expanded={isMega ? productOpen : undefined}
                  onMouseEnter={isMega ? onMegaEnter : undefined}
                  onMouseLeave={isMega ? onMegaLeave : undefined}
                  onClick={(e) => {
                    if (isMega && open) {
                      // mobile drawer: don't navigate, slide to the products panel
                      e.preventDefault();
                      setMobileProducts(true);
                    } else {
                      navTo();
                    }
                  }}
                >
                  {inner}
                </Link>
              );
            })}
          </div>

          {/* mobile products panel (slid in beside the main panel) */}
          <div ref={productsPanelRef} className={mega.panelProducts} aria-hidden={!mobileProducts}>
            <button type="button" className={mega.back} onClick={() => setMobileProducts(false)}>
              <ChevronLeft size={18} strokeWidth={2} aria-hidden /> Product
            </button>
            {/* big bold solid product names — same treatment as the desktop sheet, plus a chevron */}
            {PRODUCTS.map((p) => (
              <Link key={p.slug} className={mega.mItem} href={productAnchor(p.slug)} onClick={navTo}>
                {p.label}
                <ChevronRight className={mega.mItemChevron} size={18} strokeWidth={2} aria-hidden />
              </Link>
            ))}
            <Link className={mega.mViewAll} href={ALL_PRODUCTS_HREF} onClick={navTo}>
              View all products
            </Link>
          </div>
        </div>
        </div>
      </div>
      {/* end .navRow */}

      {/* desktop mega sheet (hidden on mobile) — IN-FLOW, so the nav grows and its solid (on-open)
          bg expands with it, like the mobile drawer. */}
      <div
        ref={megaRef}
        className={mega.mega}
        data-open={productOpen ? "1" : "0"}
        onMouseEnter={onMegaEnter}
        onMouseLeave={onMegaLeave}
      >
        <div ref={megaInnerRef} className={mega.megaInner}>
          <div className={mega.megaList}>
            {PRODUCTS.map((p) => (
              <Link key={p.slug} className={mega.megaItem} href={productAnchor(p.slug)} onClick={navTo}>
                {p.label}
              </Link>
            ))}
          </div>
          <Link className={mega.viewAll} href={ALL_PRODUCTS_HREF} onClick={navTo}>
            View all products
          </Link>
        </div>
      </div>
    </>
  );
}
