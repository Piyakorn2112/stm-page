/**
 * NavInner — the shared inner contents of both navs. A top row (brand + mobile hamburger)
 * and the link list. On desktop `.navTop` is `display:contents`, so the brand sits directly
 * in the nav's flex row beside the horizontal links; on mobile `.navTop` becomes the bar's
 * own row and the links collapse into a drawer that the hamburger expands (the bar grows in
 * height, Apple-style). Each nav supplies its CSS module (`styles`), its brand element, and
 * how to build each href (homepage `#anchor`, /build `/#anchor`).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { NAV_ICON_SIZE, NAV_ICON_STROKE, NAV_ITEMS, type NavItem } from "./navLinks";

export default function NavInner({
  styles,
  brand,
  hrefFor,
  isCurrent,
  open,
  onToggle,
  onNavigate,
}: {
  styles: Record<string, string>;
  brand: ReactNode;
  hrefFor: (item: NavItem) => string;
  isCurrent?: (item: NavItem) => boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className={styles.navTop}>
        {brand}
        <button
          type="button"
          className={styles.navBurger}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? <X size={22} strokeWidth={2} aria-hidden /> : <Menu size={22} strokeWidth={2} aria-hidden />}
        </button>
      </div>
      <div className={styles.navLinks}>
        {NAV_ITEMS.map((item) => {
          const { label, Icon } = item;
          const current = isCurrent?.(item) ?? false;
          const cls = `${styles.navLink} ${current ? styles.navLinkActive : ""}`;
          const inner = (
            <>
              <span className={styles.navIcon} aria-hidden>
                <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
              </span>
              {label}
            </>
          );
          return item.route ? (
            <Link
              key={label}
              className={cls}
              href={hrefFor(item)}
              aria-current={current ? "page" : undefined}
              onClick={onNavigate}
            >
              {inner}
            </Link>
          ) : (
            <a key={label} className={cls} href={hrefFor(item)} onClick={onNavigate}>
              {inner}
            </a>
          );
        })}
      </div>
    </>
  );
}
