# Localization pipeline (EN → TH)

How translations are produced and quality-gated in this repo. The rules live in
[`thai-localization.md`](./thai-localization.md); the agents live in `.claude/agents/`.

## Principle
**English is the source of truth.** You always write/extract the English catalog first, then translate,
then **always review** before shipping. No Thai string ships without passing the reviewer.

## The agents
- **`thai-localizer`** (`.claude/agents/thai-localizer.md`) — professional EN→TH localizer. Produces the
  Thai catalog from the English one, obeying `thai-localization.md` + the glossary.
- **`thai-localization-reviewer`** (`.claude/agents/thai-localization-reviewer.md`) — senior Thai
  linguist QA. Critiques the result against the §11 checklist and returns concrete fixes.

Both can use the web to verify terminology against authoritative modern Thai usage (apple.com/th, MS
Thai style guide). They are bound to the rules doc.

## Steps
1. **Extract / update `messages/en.json`** — add the English strings (namespaced by feature). This is
   the canonical source; keep keys stable.
2. **Translate** — run the `thai-localizer` agent with the EN catalog (or just the changed keys) and the
   target `messages/th.json`. It writes TH with the identical key structure + a handoff note (new
   glossary terms, non-obvious choices, length risks).
3. **Review** — run the `thai-localization-reviewer` agent with both catalogs. It returns a per-string
   PASS/FLAG report + corrected strings + a length table.
4. **Apply fixes** — apply the reviewer's corrections to `messages/th.json`. Re-run the reviewer until
   the verdict is **SHIP** (all strings pass all 10 checks).
5. **Sync the glossary** — fold any new term decisions back into §10 of `thai-localization.md` so the
   next run stays consistent.
6. **Verify** — `tsc --noEmit`, `eslint`, `next build` (catches i18n/route breakage), and a visual/headless
   spot check of the `th` rendering (line-height, font fallback Inter↔Prompt, no layout drift).

## How to invoke the agents
- In Claude Code: launch them via the Agent tool with `subagent_type: "thai-localizer"` /
  `"thai-localization-reviewer"` (they're auto-discovered from `.claude/agents/` when the project root is
  the working directory), or from the `/agents` menu. If running from a parent directory where they
  aren't auto-discovered, launch a `general-purpose` agent and paste the agent file's instructions +
  point it at `docs/i18n/thai-localization.md`.
- The orchestrator (main session) owns applying fixes and the final build verification.

## When adding a new locale or new strings later
Repeat steps 1→6 for the new/changed keys only. Never hand-edit `th.json` for new copy without running
it through the reviewer — consistency and register are easy to lose.

## Run log
- **Initial run — core slice (nav, footer, home, contact), 66 keys.** `thai-localizer` produced
  `messages/th.json` (full key parity, tags + `{year}`/`{name}` preserved). `thai-localization-reviewer`
  ran the §11 checklist, verified terms against apple.com/th + Thai apps, and FLAGGED 2: `nav.work`
  (วิธีการทำงาน → **การทำงาน**, 3× too wide for a nav slot — the footer's separate "How We Work" keeps
  วิธีการทำงาน) and `contact.form.successTitle` (กำลังส่งข้อความของคุณ → **ส่งข้อความเรียบร้อย** — the
  draft read as a *loading* state, not a *success* confirmation). Both fixed; verdict **SHIP**. Glossary
  (§10 of the rules doc) updated with the run's term decisions.
- **Full-site run + tone retune.** After the owner flagged the first pass as too literal/lofty ("cringe",
  e.g. ปัญญา for *intelligence*), §1 was retuned so **naturalness outranks literal fidelity** (slight drift
  allowed; Apple-TH = baseline to beat). The whole catalog (nav, footer, home, contact, showcase, work,
  product, tools, businessCard — 190 keys) was re-localized and reviewed. Headline fix: *intelligence*
  ปัญญา → **ความชาญฉลาด** (ความฉลาด too light, ปัญญา too lofty). Reviewer also fixed thrives→ใคร…ใช่ (was the
  slang รุ่ง), bleed→**ตัดตก** (real print term, not coined เผื่อตัด), de-loftified บ่มเพาะ/หลอมรวม/วิวัฒน์,
  and deleted the orphan `nav.switchLanguage`. Verdict **SHIP**.
