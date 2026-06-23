/**
 * SectionLink — accent-coloured "learn more" link used inside page sections (gap nudges
 * open on hover). The arrow matches the nav bar's icon size/stroke exactly, so it reads as
 * the same forward affordance wherever it appears.
 */
import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { NAV_ICON_SIZE, NAV_ICON_STROKE } from "@/components/ui/Nav/navLinks";
import styles from "./styles.module.css";

export default function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className={styles.link} href={href}>
      {children}
      <ArrowRight size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} aria-hidden />
    </Link>
  );
}
