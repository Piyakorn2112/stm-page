/**
 * BuildPage — the "How We Work" feature composition: an always-visible nav, the full-viewport
 * interactive 3D employee badge (EmployeeCard), then the copy. The route file only renders this.
 */
import Nav from "@/components/ui/Nav/Nav";
import CardExperience from "@/components/graphic/EmployeeCard/CardExperience";
import Footer from "@/components/ui/Footer/Footer";
import WorkContent from "./WorkContent";
import { buildNavConfig } from "./nav.config";
import styles from "@/features/build/build.module.css";

export default function BuildPage() {
  return (
    <div className={styles.page}>
      <Nav config={buildNavConfig} />
      <CardExperience />
      <WorkContent />
      <Footer />
    </div>
  );
}
