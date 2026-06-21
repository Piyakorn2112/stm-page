"use client";

/**
 * CardExperience — the interactive hero of /build. Holds the nickname (drives the
 * card's name + the ring's hash) and a random employee id. The badge fills the
 * full-viewport hero; the nickname input sits at the bottom of the hero; the copy
 * lives just below the fold. The face repaint is deferred so typing stays smooth.
 */

import { useDeferredValue, useState } from "react";
import CardStage from "./CardStage";
import styles from "./build.module.css";

const genId = () => String(Math.floor(100000000 + Math.random() * 900000000)); // 9 digits

export default function CardExperience() {
  const [nickname, setNickname] = useState("");
  // id only feeds the ssr:false card, so a lazy random init can't mismatch the DOM
  const [id] = useState(genId);
  const deferredName = useDeferredValue(nickname);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.stage}>
          <CardStage name={deferredName} id={id} />
        </div>

        <form className={styles.heroForm} onSubmit={(e) => e.preventDefault()}>
          <input
            className={styles.nameInput}
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 18))}
            placeholder="What should we call you?"
            aria-label="What should we call you?"
            maxLength={18}
            autoComplete="off"
          />
          <p className={styles.nameLine}>Every identity in the system is generated, not assigned.</p>
          <span className={styles.nameHint}>Your name shapes the badge — grab it and give it a swing.</span>
        </form>

        <div className={styles.heroFade} aria-hidden="true" />
      </section>
    </>
  );
}
