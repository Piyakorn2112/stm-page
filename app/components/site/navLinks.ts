/**
 * navLinks — single source of truth for the primary navigation, shared by the homepage
 * SiteNav (same-page `#anchor` links) and the /build BuildNav (cross-page `/#anchor`
 * links). Each item carries a lucide icon; the stroke is kept light to match the nav's
 * regular-weight text.
 */
import { Compass, IdCardLanyard, Lightbulb, type LucideIcon } from "lucide-react";

export type NavItem = { anchor?: string; route?: string; label: string; Icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { anchor: "about", label: "About", Icon: Compass },
  { anchor: "philosophy", label: "Philosophy", Icon: Lightbulb },
  { route: "/build", label: "How We Work", Icon: IdCardLanyard },
];

export const NAV_ICON_SIZE = 16;
export const NAV_ICON_STROKE = 1.75; // lighter than lucide's default 2, to sit with 400-weight text
