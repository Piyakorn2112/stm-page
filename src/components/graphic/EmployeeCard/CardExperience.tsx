"use client";

/**
 * CardExperience — the interactive hero of /work. Holds the nickname (drives the
 * card's name + the ring's hash) and a random employee id. The badge fills the
 * full-viewport hero. The name is typed DIRECTLY on the 3D badge: clicking the card's
 * name field focuses a hidden-but-real input (so the mobile keyboard / IME / paste all
 * work), whose value paints onto the card in real time. The copy lives just below the fold.
 */

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import CardStage from "./CardStage";
import { setCardPlaceholder } from "./cardFace";
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
  const t = useTranslations("work.hero");
  // localized badge placeholder (canvas-drawn); set before the lazy 3D card first-paints
  setCardPlaceholder(t("namePlaceholder"));

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
            aria-label={t("nameAria")}
            maxLength={14}
            autoComplete="off"
            autoCapitalize="words"
          />
          <p className={styles.nameLine}>{t("nameLine")}</p>
          <span className={styles.nameHint}>{t("nameHint")}</span>
        </form>

        <div className={styles.heroFade} aria-hidden="true" />
        <HeroScrollIndicator />
      </section>
    </>
  );
}
