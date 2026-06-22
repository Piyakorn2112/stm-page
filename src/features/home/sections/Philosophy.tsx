/**
 * Philosophy — a full-bleed ring-environment (ArcField) behind the copy: the ring
 * breathes in the open space and product icons continuously bubble out of it. The text
 * carries a reserve hitbox (data-arc-reserve) so icons never slide under it.
 */
import ArcField from "@/components/graphic/ArcField/ArcField";
import styles from "@/features/home/home.module.css";

export function Philosophy() {
  return (
    <section id="philosophy" className={`section sectionAlt ${styles.philFull}`}>
      <ArcField className={styles.philArcBg} />
      <div className={"container"}>
        <div className={`${styles.philText}`} data-arc-reserve>
          <span className={"eyebrow"}>Philosophy</span>
          <h2 className={styles.missionHeading}>
            Structure for what&rsquo;s <em className={"accentWord"}>next</em>.
          </h2>
          <p className={styles.missionLede}>
            The ring is the environment in which new ideas land and take shape &mdash;
            foundations strong enough to support many products, many people, and many futures,
            without losing identity along the way.
          </p>
        </div>
      </div>
    </section>
  );
}
