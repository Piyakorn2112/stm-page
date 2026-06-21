/**
 * /build — "Build With Us". The careers / join page. A full-viewport hero holds an
 * interactive 3D employee badge (CardExperience → CardStage → LanyardCard) hanging
 * on a lanyard you can grab and swing; the nickname input shapes its face. The nav
 * hides over the hero (like the homepage), then the copy follows below.
 */

import type { Metadata } from "next";
import BuildNav from "./BuildNav";
import CardExperience from "./CardExperience";
import WorkContent from "./WorkContent";
import styles from "./build.module.css";

export const metadata: Metadata = {
  title: "How We Work — Srang Tech Mai",
  description:
    "How Srang Tech Mai works: not roles or departments, but small high-context teams — multi-disciplinary, high-agency, aligned but never isolated.",
};

export default function BuildPage() {
  return (
    <div className={styles.page}>
      <BuildNav />
      <CardExperience />
      <WorkContent />
    </div>
  );
}
