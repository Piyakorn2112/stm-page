/**
 * Identity — "Systems of people, not roles": copy on the LEFT, the employee ring grid
 * (IdentityGrid) on the RIGHT; the grid moves on top of the copy on mobile.
 */
import IdentityGrid from "@/components/graphic/IdentityGrid/IdentityGrid";
import SectionLink from "@/components/ui/SectionLink/SectionLink";
import { accent } from "@/utils/accent";
import styles from "@/features/home/home.module.css";

export function Identity() {
  return (
    <section id="identity" className={`section sectionAlt`} style={accent("var(--orange)")}>
      <div className={`container ${styles.idSplit}`}>
        <div className={styles.idText}>
          <span className={"eyebrow"}>How we work</span>
          <h2 className={"heading"}>
            Systems of people, not <em className={"accentWord"}>roles</em>.
          </h2>
          <p className={"lede"}>
            We don&rsquo;t organize by rigid roles or departments. Small, high-context teams where
            design, engineering, and thinking live together, each owning outcomes, not handoffs.
          </p>
          <p className={"body"}>
            Every person carries their own generated ring, and works the way the system does:
            multi-disciplinary, high-agency, aligned but never boxed in.
          </p>
          <SectionLink href="/build">How we work</SectionLink>
        </div>
        <div className={styles.idGridWrap}>
          <IdentityGrid />
        </div>
      </div>
    </section>
  );
}
