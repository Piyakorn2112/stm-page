/**
 * navLinks — single source of truth for the primary navigation, shared by the unified
 * Nav across pages (the home nav uses same-page `#anchor` links, the /build nav uses
 * cross-page `/#anchor` links — see each feature's nav.config). Each item carries a
 * lucide icon; the stroke is kept light to match the nav's regular-weight text.
 */
import { Asterisk, Box, Home, IdCardLanyard, type LucideIcon } from "lucide-react";

// `cta` items render as a tight pill button (the primary action) instead of a text link;
// they carry no hover-reveal icon, so `Icon` is optional.
export type NavItem = { anchor?: string; route?: string; label: string; Icon?: LucideIcon; cta?: boolean; mega?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { route: "/", label: "Home", Icon: Home },
  { route: "/product", label: "Product", Icon: Box, mega: true },
  { route: "/build", label: "Work", Icon: IdCardLanyard },
  { route: "/contact", label: "Contact Us", Icon: Asterisk, cta: true },
];

export const NAV_ICON_SIZE = 16;
export const NAV_ICON_STROKE = 1.75; // lighter than lucide's default 2, to sit with 400-weight text

// Products surfaced by the "Product" mega-menu (desktop hover panel + mobile slide-in panel).
// Each has its own placeholder page at /products/<slug>.
export type Product = { slug: string; label: string };
export const PRODUCTS: Product[] = [
  { slug: "members", label: "Members" },
  { slug: "beacon", label: "Beacon" },
  { slug: "cmission", label: "Cmission" },
  { slug: "latent-write", label: "Latent Write" },
  { slug: "catmium", label: "Catmium" },
];
export const productHref = (slug: string) => `/products/${slug}`;
