import HeroScrollIndicator from "@/components/ui/HeroScrollIndicator/HeroScrollIndicator";
import styles from "./contact.module.css";

export default function ContactHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <a className={styles.email} href="mailto:contact@srangtechmai.tech">
          contact@srangtechmai.tech
        </a>
        <a className={styles.phone} href="tel:+66972733779">
          +66 97 273 3779
        </a>
      </div>
      <HeroScrollIndicator />
    </section>
  );
}
