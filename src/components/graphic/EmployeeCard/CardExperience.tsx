"use client";

/**
 * CardExperience — the interactive hero of /work. Holds the nickname (drives the
 * card's name + the ring's hash) and a random employee id. The badge fills the
 * full-viewport hero. The name is typed DIRECTLY on the 3D badge: clicking the card's
 * name field focuses a hidden-but-real input (so the mobile keyboard / IME / paste all
 * work), whose value paints onto the card in real time. The copy lives just below the fold.
 */

import { useRef, useState } from "react";
import CardStage from "./CardStage";
import HeroScrollIndicator from "@/components/ui/HeroScrollIndicator/HeroScrollIndicator";
import styles from "@/features/build/build.module.css";

const genId = () => String(Math.floor(100000000 + Math.random() * 900000000)); // 9 digits
// capitalise the first letter of every word as it's typed (rest left as entered)
const titleCase = (s: string) => s.replace(/(^|\s)(\S)/g, (_, sp, c) => sp + c.toUpperCase());

export default function CardExperience() {
  const [nickname, setNickname] = useState("");
  const [focused, setFocused] = useState(false);
  // id only feeds the ssr:false card, so a lazy random init can't mismatch the DOM
  const [id] = useState(genId);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.stage}>
          <CardStage
            name={nickname}
            id={id}
            focused={focused}
            onRequestFocus={() => inputRef.current?.focus()}
            onRequestBlur={() => inputRef.current?.blur()}
          />
        </div>

        <form className={styles.heroForm} onSubmit={(e) => e.preventDefault()}>
          {/* the real text target — visually hidden but focusable; the visible field lives
              on the badge itself (CardExperience focuses this when the card name is clicked) */}
          <input
            ref={inputRef}
            className={styles.nameField}
            type="text"
            value={nickname}
            onChange={(e) => setNickname(titleCase(e.target.value.slice(0, 14)))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Your name on the badge"
            maxLength={14}
            autoComplete="off"
            autoCapitalize="words"
          />
          <p className={styles.nameLine}>Every identity in the system is generated, not assigned.</p>
          <span className={styles.nameHint}>Click the name on the badge to make it yours. Then grab the card and give it a swing.</span>
        </form>

        <div className={styles.heroFade} aria-hidden="true" />
        <HeroScrollIndicator />
      </section>
    </>
  );
}
