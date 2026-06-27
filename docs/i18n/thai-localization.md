# Thai (th) Localization Rules — Srang Tech Mai

**Status:** canonical reference. Every EN→TH translation in this repo MUST follow this document.
Both the `thai-localizer` agent (translator) and the `thai-localization-reviewer` agent (critic)
are bound to these rules, and so is any human editor. When in doubt, this file wins.

This is **localization**, not translation. We do not render English word-for-word into Thai; we
re-express the *meaning and intent* the way a sharp, modern Thai tech brand would say it — while
keeping the UI from drifting. Read the whole file before writing or reviewing a single string.

---

## 1. The Srang Tech Mai Thai voice

The brand voice in English is **confident, minimal, editorial** — short declarative lines, no
hype, no exclamation. The Thai must feel the same: a contemporary Thai technology brand (think the
register of **Apple Thailand**, line apps, modern Thai SaaS), **not** stiff government/manual Thai
and **not** chatty social-media Thai.

- **Register:** neutral-formal, **Central (Bangkok) Thai**. Polished and respectful, but clean and
  modern. This is the professional default for Thai localization.
- **No spoken politeness particles in UI** — never append ครับ / ค่ะ / นะ to interface strings. They
  read as conversational and instantly cheapen UI text. (They belong only in genuinely conversational
  copy, which we don't have.)
- **Address the reader with คุณ sparingly.** Thai UI usually drops the pronoun entirely. Prefer the
  implied subject: "Make it yours." → "ออกแบบในแบบของคุณ" is fine, but "ปรับแต่งได้ตามใจ" (no pronoun)
  is often cleaner. Never use familiar/hierarchical pronouns (เธอ, มึง, etc.).
- **Confident, not salesy.** Mirror the English economy. If the English is three words, the Thai
  should not become a paragraph. Drop filler (การ/ความ stacking, redundant ที่, อย่างมาก).
- **Verbs over nominalizations** where it reads cleaner: prefer "สร้าง" to "การสร้างสรรค์" unless the
  noun form is genuinely needed.
- **★ NATURALNESS OUTRANKS LITERAL FIDELITY — this is the primary tuning parameter.** Pick the word a
  real Thai speaker would actually use, even if it drifts a little from the English dictionary meaning.
  A translation that is technically "correct" but reads stiff, lofty, abstract, or obviously-translated
  is WRONG here. **Apple Thailand is a baseline to BEAT, not a ceiling** — its copy is often slightly
  stiff / "cringe" to native ears (over-elevated diction, over-literal sentence shapes); go one notch
  more natural and plain-spoken. **You MAY let the meaning drift slightly to land a natural word, as
  long as the CORE message the string communicates survives intact.** Worked example: "intelligence" →
  ปัญญา reads lofty/abstract to a native ear; prefer a more natural, slightly-drifted choice (e.g. toward
  ความเข้าใจ / ความชาญฉลาด, or reframe the triad) — settle the final word in review and record it in §10.
  Heuristic: if a smart Thai colleague would *quote it back differently in normal speech*, it's too stiff.

> Litmus test (BOTH gates must pass): (1) Would a native Thai professional say this UNPROMPTED — or only
> ever as a translation? (2) Does it still carry the English's core point? If a string reads like a
> translated EULA, a machine, or "elevated essay Thai," rewrite it plainer even at the cost of a small
> meaning drift.

---

## 2. Golden rules (non-negotiable)

1. **Localize intent, not words — and naturalness wins ties.** Re-express; never calque English grammar
   into Thai. When the literal word is stiff/lofty, choose the natural word even at the cost of slight
   meaning drift — the core message must survive (see §1 ★).
2. **Keep the UI footprint.** Stay within the **length budget** in §4. A correct translation that
   breaks the layout is a failed translation — tighten it.
3. **Brand & product names stay in Latin script, unchanged.** See §3 + the glossary (§10).
4. **One term, one translation.** Use the glossary (§10) for every recurring term. No synonyms
   drifting across screens.
5. **Thai has no capitalization and no word spaces.** Do not invent them. See §5 + §6.
6. **Put a normal space before and after any embedded Latin run** (word, brand, number+unit) inside
   Thai text. e.g. `ดาวน์โหลดเป็น PDF ได้ทันที`.
7. **Preserve all placeholders, ICU syntax, tags, and HTML/JSX exactly** — `{name}`, `{count, plural,
   …}`, `<b>…</b>`, `&mdash;`, `\n`. Translate only human-readable text.
8. **Numbers: Western Arabic numerals (0–9), not Thai numerals (๐–๙).** Modern tech default. See §7.
9. **No `?` or `!` unless the English carries real interrogative/emphatic force** — Thai uses them far
   less; a headline question in EN is often a statement in TH.
10. **Every recurring/ambiguous decision goes back into this file or the glossary** so the next
    translator is consistent.

---

## 3. What stays in English (Latin script)

Thai tech writing routinely keeps Latin terms; forcing a Thai coinage often reads worse and is
*longer*. Keep in Latin (with spaces around them per §2.6):

- **The brand:** `Srang Tech Mai` — never translate, never transliterate, never reorder. Lowercase
  wordmark `srang tech mai` stays lowercase.
- **Product / feature names** and the site domain (`srangtechmai.tech`).
- **Established tech terms** that Thai professionals normally read in English: `software`, `product`,
  `PDF / PNG / JPG / SVG`, `QR`, `email` (or อีเมล — pick one in glossary), `web`, file formats,
  units (`mm`, `dpi`), code.
- **Acronyms** (`AI`, `API`, `STM`).

**Transliterate** (write in Thai script) only when the transliteration is the *normal* Thai form and
is not longer than helpful — e.g. `เว็บไซต์` (website), `ดาวน์โหลด` (download), `ดีไซน์`/`ออกแบบ`
(design). **Translate** to a true Thai word when a clean, common one exists and is concise — e.g.
`Home → หน้าแรก`, `Contact → ติดต่อ`.

Decision order for any term: **(a) keep English** if that's how Thai pros say it and it's shorter/clearer
→ **(b) transliterate** if that's the established Thai form → **(c) translate** to native Thai if clean
and concise. Record the choice in the glossary.

---

## 4. Length & UI-drift budget

Thai body text averages **~15% longer** than English, but Thai glyphs are denser, so *visual* width is
often similar. Short UI strings are where drift hurts. Rules:

- **Buttons, nav, labels, chips, pills, badges (≤ ~2 words EN):** Thai SHOULD be **≤ the English
  visual width**, and never more than **+30%**. Use the shortest natural Thai; keep a Latin term if it's
  shorter (e.g. keep `Export`→`ส่งออก` is fine and shorter; `Print-ready PDF`→`PDF พร้อมพิมพ์`).
- **Headlines / hero (one line in EN):** must still fit **one line** at the same breakpoint. Aim within
  **+10%** characters. Rework wording rather than overflow.
- **Body / paragraphs:** target **within +15%**; hard cap **+25%**. If longer, the sentence is
  over-translated — cut it down.
- **Always record** the source length and the translated length in the catalog review (the reviewer
  checks this).

Tactics to shrink Thai: drop pronouns, drop redundant การ/ความ, use a crisp verb, keep a short English
loanword, split one long Thai clause into the same count of words as the EN. Never shrink by dropping
meaning the user needs.

---

## 5. Capitalization & punctuation

- **No capitalization in Thai.** Don't try to mimic Title Case or sentence case with styling tricks.
  When an EN string is Title Case (a heading), the Thai is just normal Thai.
- **Sentence-ending period:** Thai traditionally omits the full stop. For UI we **omit `.` at the end
  of short strings, headings, labels, and buttons.** For multi-sentence body copy, separate sentences
  with a **space** (Thai convention) rather than a period; a trailing period is still omitted.
- **`?` / `!`:** avoid (see §2.9). Convert rhetorical EN questions to Thai statements.
- **Ellipsis `…`:** keep where the EN uses it (e.g. "Select a topic…" → "เลือกหัวข้อ…").
- **Quotes:** use `“ ”` or the Thai-typical `«»`? → use the same `“ ”` as the EN source for
  consistency; do not introduce guillemets.
- **Colons:** fine, with a space after, when mirroring EN structured text.
- **Em dash `—`:** keep where the EN uses it (it carries the editorial voice); surround with spaces as
  in EN.

---

## 6. Script & typography mechanics (and the CSS they require)

Thai has **no spaces between words**; spaces separate **phrases/clauses** (small space) and
**sentences** (larger space). Critical consequences the translator AND the front-end must honor:

- **Do NOT insert spaces between Thai words.** Write Thai as continuous script; add a space only at a
  genuine phrase/clause/sentence boundary, and around embedded Latin (§2.6).
- **Line breaking** can't rely on spaces. The app sets `lang="th"` so the browser's Thai line-breaker
  engages. For headlines/labels where we need control, insert a **ZWSP `​`** at acceptable break
  points (and/or `<wbr>`); use **` ` (NBSP)** to keep a unit glued (e.g. `90 mm`,
  number+unit, a Latin term that must not split).
- **Maiyamok `ๆ` (U+0E46)** must **never** start a line — keep it glued to the preceding word with a
  preceding ` `-style no-break if it ever lands at a wrap point.
- **Typography (set in CSS for `:lang(th)` / the `th` layout):**
  - **Increase line-height** (Thai stacks vowels + tone marks above/below the baseline): use ~**1.6–1.75**
    for body where Latin uses ~1.5; bump headings proportionally.
  - Prefer **`word-break: normal`** + rely on the Thai breaker; for narrow columns you may use
    **`text-wrap: pretty`** and, where supported, **`text-justify: inter-character`** (only if we ever
    justify — we default to left-aligned).
  - Keep generous vertical padding on buttons/inputs so tall Thai stacks don't clip.
- **Font stack (the brand requirement):** `th` uses **`"Inter", "Prompt", sans-serif`**. Inter is
  listed FIRST and covers Latin glyphs but has **no Thai glyphs**, so Latin words render in Inter and
  Thai characters fall through to **Prompt** — i.e. English words inside Thai automatically use Inter,
  Thai uses Prompt, exactly as intended. (Do not put Prompt first or English would render in Prompt.)

---

## 7. Numbers, dates, currency, units

- **Numerals:** Western Arabic `0–9` everywhere (modern tech default). Do **not** use Thai numerals.
- **Dates:** default to the **Gregorian (Christian Era / ค.ศ.)** calendar for a modern product brand,
  format `D MMM YYYY` in Thai month names (e.g. `25 มิ.ย. 2026`). Use Buddhist Era (พ.ศ.) only if a
  string is explicitly a Thai legal/official context (we have none now). Keep any `{date}` placeholder
  intact and let formatting be handled by the i18n date formatter where possible.
- **Currency:** Thai Baht `฿` or `บาท`; symbol before the amount: `฿1,200`. Thousands separator `,`,
  decimal `.`.
- **Units:** metric, with a **space**: `54 mm`, `300 dpi`. Keep unit tokens in Latin.
- **Phone:** keep the source grouping; Thai domestic format is fine as given.
- **Percent / ratios:** `15%`, `90 × 54 mm` — keep symbols and the `×` glyph.

---

## 8. Per–string-type guidance

| Type | Rule | Example (EN → TH) |
|---|---|---|
| **Nav item** | shortest native Thai; no period | Home → หน้าแรก · Contact → ติดต่อ · How We Work → วิธีการทำงาน |
| **Button / CTA** | imperative verb, tight, no period | Send message → ส่งข้อความ · Export → ส่งออก · Contact Us → ติดต่อเรา |
| **Heading / hero** | declarative, one line, voice-matched | "Make it yours." → "ออกแบบในแบบของคุณ" |
| **Sub/lede** | concise, may keep one EN term | "We build software, products, and ventures." → "เราสร้างซอฟต์แวร์ ผลิตภัณฑ์ และธุรกิจใหม่ ๆ" |
| **Field label** | noun, no period | Email → อีเมล · Company → บริษัท · Role → ตำแหน่ง |
| **Placeholder** | concise hint, may use … | "you@company.com" → keep as-is · "Your name" → "ชื่อของคุณ" |
| **Helper / caption** | plain, informative | keep `mm`/`dpi`/format tokens in Latin |
| **Error / status** | calm, no blame, no `!` | "Export failed — please try again." → "ส่งออกไม่สำเร็จ ลองอีกครั้ง" |

---

## 9. Anti-patterns (machine-translation tells to reject)

- ❌ Word-by-word calque of English clause order.
- ❌ Spaces between every Thai word (a classic MT/OCR artifact).
- ❌ Over-nominalization: การ…ความ… stacked needlessly.
- ❌ Trailing `ครับ/ค่ะ/นะ` on UI strings.
- ❌ Periods/`!` ending Thai headings or buttons.
- ❌ Thai numerals (๑๒๓), or Buddhist-era dates in a product context.
- ❌ Translating brand/product names or file-format acronyms into Thai.
- ❌ Over-formal "manual Thai" (ท่าน, โปรดกรุณา, ดำเนินการ…) for a hip brand — too stiff.
- ❌ Missing/edited placeholders, tags, or ICU plural syntax.
- ❌ Inconsistent term for the same English source across screens.

---

## 10. Glossary (canonical terms — extend as you go)

Keep this table the single source of truth. Add a row whenever a new recurring term is decided.

| English | Thai (use exactly) | Note |
|---|---|---|
| Srang Tech Mai | Srang Tech Mai | brand — never translate/transliterate |
| srang tech mai (wordmark) | srang tech mai | keep lowercase Latin |
| srangtechmai.tech | srangtechmai.tech | domain, unchanged |
| Home | หน้าแรก | nav |
| Product | ผลิตภัณฑ์ | nav; "Products" → ผลิตภัณฑ์ (no plural marker) |
| How We Work | วิธีการทำงาน | nav |
| Contact / Contact Us | ติดต่อ / ติดต่อเรา | nav / CTA |
| Build With Us | ร่วมงานกับเรา | careers |
| Business card | นามบัตร | tool |
| Make it yours | ออกแบบในแบบของคุณ | hero |
| Export | ส่งออก | button |
| Download | ดาวน์โหลด | button/verb |
| Print-ready PDF | PDF พร้อมพิมพ์ | keep "PDF" Latin |
| Print sheet | ชีตสำหรับพิมพ์ | export option |
| Send message | ส่งข้อความ | form CTA |
| Name | ชื่อ | label |
| Email | อีเมล | label |
| Company | บริษัท | label |
| Role / Title | ตำแหน่ง | label |
| Phone | โทรศัพท์ | label |
| Message | ข้อความ | label |
| software | software / ซอฟต์แวร์ | prefer Latin in headlines, ซอฟต์แวร์ in body — be consistent per surface |
| product (generic noun) | ผลิตภัณฑ์ | |
| venture(s) | ธุรกิจใหม่ | "new venture" sense |
| Work (nav item) | การทำงาน | **nav only** — tight form; the footer's "How We Work" stays วิธีการทำงาน |
| Creativity | ความคิดสร้างสรรค์ | brand triad |
| Engineering | วิศวกรรม | brand triad |
| Intelligence | ความชาญฉลาด | brand triad — substantive "intelligence" in brand register (cf. BMW i, Thai tech copy); NOT ความฉลาด (reads "smart/clever", too light) and NOT ปัญญา (lofty/abstract, "cringe") |
| thrive(s) / who thrives | ใคร…ใช่ (…ที่นี่) | natural "right fit" reframe; avoid slang รุ่ง |
| bleed (print) | ตัดตก (ระยะตัดตก) | print-industry standard; NOT the coined เผื่อตัด |
| crop marks | เครื่องหมายตัด / มาร์ก | use มาร์ก for tight pill labels |
| loyalty (platform/system) | สะสมแต้ม | what Thai businesses say; NOT ความภักดี |
| evolve (body copy) | พัฒนาต่อ | replaces the stiff วิวัฒน์ |
| reality | ของจริง | NOT ความจริง |
| Showcase | ผลงาน | nav/page |
| signal layer | ชั้นสัญญาณ | product (Beacon) |
| mission | ภารกิจ | product (Cmission) |
| Structure for what’s next | โครงสร้างสำหรับสิ่งที่จะมาถึง | tagline — identical in tagline, philosophy heading, footer rights |
| ring (brand metaphor) | วงแหวน | keep in Thai, not Latin "ring" |
| identity / identity systems | ตัวตน / ระบบตัวตน | |
| Product Systems | ระบบผลิตภัณฑ์ | pillar |
| Interaction Systems | ระบบปฏิสัมพันธ์ | pillar |
| interface | อินเทอร์เฟซ | established transliteration |
| evolve | วิวัฒน์ | "keep evolving" sense |
| Philosophy | แนวคิด | footer / eyebrow (cleaner than ปรัชญา for a brand) |
| About | เกี่ยวกับเรา | footer |
| Get in touch | ติดต่อเรา | footer (same target as Contact Us) |
| Switch language | เปลี่ยนภาษา | locale switcher aria |
| optional | (ไม่บังคับ) | parenthetical field marker |
| Message on its way (success) | ส่งข้อความเรียบร้อย | success state — NEVER กำลังส่ง (that's a loading state) |
| Product inquiry | สอบถามผลิตภัณฑ์ | contact topic |
| Partnership | เป็นพันธมิตร | contact topic |
| Press (media) | สื่อมวลชน | contact topic |

---

## 11. Reviewer QA checklist

The `thai-localization-reviewer` runs this on every string and reports pass/flag with a fix:

1. **Meaning** preserved, intent + voice matched (not literal)?
2. **Naturalness (HEAVILY WEIGHTED — can fail a string alone)** — reads like native modern Thai a real
   person would say, not MT and not stiff/lofty "translationese"? Actively hunt over-elevated or
   over-literal diction (ปัญญา-type lofty choices) and propose a more natural, slightly-drifted word.
3. **Register** — neutral-formal, no particles, no over-stiff manual Thai?
4. **Length budget** (§4) met for the string type? (record EN vs TH length)
5. **Latin handling** (§3) — brand/products/acronyms kept; spaces around Latin (§2.6)?
6. **Glossary** consistency (§10) — same term everywhere?
7. **Script mechanics** — no inter-word spaces; phrase spacing correct; numerals Arabic?
8. **Placeholders / ICU / tags** intact and correctly positioned for Thai word order?
9. **Punctuation** — no stray `.`/`?`/`!`; `…` and `—` preserved where in source?
10. **Anti-patterns** (§9) — none present?

A string passes only if all 10 pass. Otherwise the reviewer returns a concrete corrected string + the
rule number it violated.

---

## 12. Sources

- Microsoft **Thai Localization Style Guide** (official): https://download.microsoft.com/download/3/f/2/3f236167-639e-46f2-8201-554c36bcbf31/tha-tha-StyleGuide.pdf and the style-guide hub https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides
- W3C **Thai Layout Gap Analysis** / SEA layout requirements: https://www.w3.org/TR/thai-gap/ · https://www.w3.org/International/sealreq/thai/
- W3C i18n **Approaches to line breaking**: https://w3c.github.io/i18n-drafts/articles/typography/linebreak.en
- **Apple Thailand** (https://www.apple.com/th/) — tone/register exemplar for a modern consumer-tech brand in Thai.
- 1stopAsia, **Thai UI Localization**: https://www.1stopasia.com/blog/thai-ui-localization/
- SEAtongue, **Thai Localization Guide**: https://seatongue.com/resources/language-center/thai-localization-guide/
- On English loanwords in Thai (Royal Institute integration methods): https://so03.tci-thaijo.org/index.php/JLC/article/view/279660
