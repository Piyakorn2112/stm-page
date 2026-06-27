/**
 * navLinks — single source of truth for the primary navigation, shared by the unified
 * Nav across pages (the home nav uses same-page `#anchor` links, the /work nav uses
 * cross-page `/#anchor` links — see each feature's nav.config). Each item carries a
 * lucide icon; the stroke is kept light to match the nav's regular-weight text.
 */
import { Asterisk, Box, Home, IdCardLanyard, LayoutGrid, type LucideIcon } from "lucide-react";

// `cta` items render as a tight pill button (the primary action) instead of a text link;
// they carry no hover-reveal icon, so `Icon` is optional. `labelKey` is the i18n key under
// the `nav` namespace (the visible label is resolved at render via next-intl).
export type NavItem = { anchor?: string; route?: string; labelKey: string; Icon?: LucideIcon; cta?: boolean; mega?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { route: "/", labelKey: "home", Icon: Home },
  { route: "/product", labelKey: "product", Icon: Box, mega: true },
  { route: "/showcase", labelKey: "showcase", Icon: LayoutGrid },
  { route: "/work", labelKey: "work", Icon: IdCardLanyard },
  { route: "/contact", labelKey: "contact", Icon: Asterisk, cta: true },
];

export const NAV_ICON_SIZE = 16;
export const NAV_ICON_STROKE = 1.75; // lighter than lucide's default 2, to sit with 400-weight text

// Products surfaced by the "Product" mega-menu (desktop hover panel + mobile slide-in panel).
// Each product now lives on its OWN external site; on this site it has a section on the
// /product hub (ProductSections). `url` is that product's external site (used by the hub
// section's outbound "Visit" link) — leave undefined until the site exists.
export type Product = { slug: string; label: string; url?: string };
export const PRODUCTS: Product[] = [
  { slug: "members", label: "Members" /* , url: "https://…" */ },
  { slug: "beacon", label: "Beacon" /* , url: "https://…" */ },
  { slug: "cmission", label: "Cmission" /* , url: "https://…" */ },
  { slug: "latent-write", label: "Latent Write" /* , url: "https://…" */ },
  { slug: "catmium", label: "Catmium" /* , url: "https://…" */ },
];

// Product links route to that product's SECTION on the /product hub (and smooth-scroll to it
// via html { scroll-padding-top }). The hub section carries the outbound link to the product's
// own site — so the main site showcases, then hands off.
export const productAnchor = (slug: string) => `/product#${slug}`;
