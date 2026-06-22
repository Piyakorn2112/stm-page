/**
 * ContactPage — minimal placeholder: the shared nav + footer with a single centred
 * mailto in between. Intentionally bare for now; real contact content lands later.
 */
import Nav from "@/components/ui/Nav/Nav";
import Footer from "@/components/ui/Footer/Footer";
import { contactNavConfig } from "./nav.config";
import styles from "./contact.module.css";

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <Nav config={contactNavConfig} />
      <main className={styles.hero}>
        <a className={styles.email} href="mailto:contact@srangtechmai.tech">
          contact@srangtechmai.tech
        </a>
      </main>
      <Footer />
    </div>
  );
}
