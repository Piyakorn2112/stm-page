/**
 * Mission — graphic LEFT (the three brand soft-bodies pressing into one), text RIGHT
 * and smaller; both stack and centre on mobile. The graphic only animates once it
 * scrolls into view (see SoftRingsField), so it never competes with the hero.
 */
import SoftRingsField from "@/components/graphic/SoftRingsField/SoftRingsField";
import styles from "@/features/home/home.module.css";

export function Mission() {
  return (
    <section id="about" className={"section"}>
      <div className={`container ${styles.missionSplit}`}>
        <div className={styles.missionVisual}>
          <SoftRingsField />
        </div>
        <div className={styles.missionText}>
          <h2 className={styles.missionHeading}>
            <em className={"accentWord"} style={{ color: "var(--orange)" }}>Creativity</em>,{" "}
            <em className={"accentWord"} style={{ color: "var(--blue)" }}>engineering</em>, and{" "}
            <em className={"accentWord"} style={{ color: "var(--indigo)" }}>intelligence</em>;
            pulled into one system.
          </h2>
          <p className={styles.missionLede}>
            Not just a software house. A place where design, engineering, and identity are treated
            as one, held under structure and pressure until they become a single, living
            identity.
          </p>
        </div>
      </div>
    </section>
  );
}
