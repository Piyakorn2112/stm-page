/**
 * SectionLink — accent-coloured "learn more" link used inside page sections (gap nudges
 * open on hover). The arrow matches the nav bar's icon size/stroke exactly, so it reads as
 * the same forward affordance wherever it appears.
 *
 * `external` renders a real `<a target="_blank">` with a diagonal ArrowUpRight (the
 * "leaves the site" affordance) — used for the product hub's outbound links to each
 * product's own site.
 */
import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { NAV_ICON_SIZE, NAV_ICON_STROKE } from "@/components/ui/Nav/navLinks";
import styles from "./styles.module.css";

export default function SectionLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const Icon = external ? ArrowUpRight : ArrowRight;
  const icon = <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />;

  if (external) {
    return (
      <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
        {children}
        {icon}
      </a>
    );
  }
  return (
    <Link className={styles.link} href={href}>
      {children}
      {icon}
    </Link>
  );
}
