"use client";

/**
 * TeamField — the "Aligned, not isolated" art. Real STM rings (the @stm-ring colour
 * system: a dark base wire + a multi-colour lit charge) form small MULTI-DISCIPLINARY
 * teams — each team is one indigo + one blue + one orange ring (its charge.primary is
 * its "discipline"). The piece says what the section says: teams are independent but
 * NOT isolated.
 *
 *  • TEAM (the resting state, most of the time) — every ring belongs to ONE stable team.
 *    Members orbit their team's centre in a loose, slowly-turning ring; teams keep clear
 *    of one another (centroid separation) so they stay DISTINCT and spread across the
 *    canvas — never a single blob. A low-passed noise drift + a desynced breathe keep the
 *    whole field alive at rest (settled, not frozen).
 *  • SYNC (a brief periodic beat) — instead of dissolving the teams, the SAME discipline
 *    aligns ACROSS teams: threads light up between same-colour rings (brighter the closer
 *    they are) and each ring leans a touch toward its colour's centroid, then relaxes back
 *    into its team. Connection made visible — alignment without merging.
 *
 * Model is intentionally simple + stable (no membership churn): the well-known clustered
 * force-layout recipe — cohesion to a per-team formation + global separation between
 * teams — plus constellation links for the sync. Verified headlessly.
 *
 * Self-contained client canvas (rAF), paused off-screen, static for reduced-motion.
 */

import { useEffect, useRef } from "react";
import { DARK_BASE, exportThumbnailSVG, hexToOklab, makeHover, PALETTE } from "@stm-ring";
import { prefersDark, prefersReducedMotion, watchColorScheme } from "@/utils/media";
import { sizeCanvas } from "@/utils/canvas";

// in dark mode the ring's dark base wire would vanish on the dark page, so swap it for
// a light ramp (same one the rest of the site's rings use in dark mode).
const DARK_WIRE = ["#E7EBFC", "#ABB1D4"];

const MAX_COUNTS = [16, 12, 9]; // indigo / blue / orange — UNEVEN; the full (roomy desktop) set
const NMAX = MAX_COUNTS[0] + MAX_COUNTS[1] + MAX_COUNTS[2];
const RS = 72; // ring draw size (px)

// ── timing (s) — the SYNC threads are ALWAYS showing: ONE discipline lit at a time, held
//    then cross-faded into the next (indigo → blue → orange → …), forever, with no gap. ──
const COLOR_HOLD = 2.4; // seconds a single discipline is solely lit
const COLOR_FADE = 1.0; // seconds cross-fading into the next discipline
const COLOR_SLOT = COLOR_HOLD + COLOR_FADE;

// charge.primary's hue equals its source PALETTE colour's hue exactly, so nearest-hue
// match recovers which of the three brand colours a seed's ring is built around.
const PAL_HUE = PALETTE.map((hex) => {
  const l = hexToOklab(hex);
  return Math.atan2(l.b, l.a);
});
function primaryIndex(seed: number): number {
  const c = makeHover(seed).charge.primary;
  const h = Math.atan2(c.b, c.a);
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < 3; k++) {
    let d = Math.abs(h - PAL_HUE[k]);
    d = Math.min(d, Math.PI * 2 - d);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: number; // discipline / colour 0..2
  seed: number;
  home: number; // permanent home team
  team: number; // team the ring is CURRENTLY part of (= home, or a host while visiting)
  slot: number; // index within the home team (formation angle)
  guest: number; // team being visited, or -1 when home
  guestUntil: number; // abs time (s) the visit ends
  guestAng: number; // angle it sits at around the host
  rot: number; // ring spin
  vr: number;
  bph: number; // breathe phase
  bfr: number; // breathe frequency
};
type Team = {
  cx: number; // anchor (centre the members orbit)
  cy: number;
  dx: number; // low-passed drift velocity of the anchor
  dy: number;
  orbit: number; // current formation rotation
  orbV: number; // formation rotation speed (rad/s)
  size: number; // member count (for slot angles)
};

export default function TeamField({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = prefersReducedMotion();

    let w = 1;
    let h = 1;
    const layout = () => {
      const r = wrap.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      const dpr = sizeCanvas(canvas, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    layout();

    // responsive ring count: the full set on a roomy (desktop) canvas, FEWER on a small
    // (mobile) one — derived from the canvas area so density stays comfortable either way.
    const footprint = (RS * 1.2) ** 2;
    const scale = Math.max(0.5, Math.min(1, (w * h * 0.6) / (footprint * NMAX)));
    const counts = MAX_COUNTS.map((c) => Math.max(2, Math.round(c * scale)));

    // pick counts[c] seeds whose ring primary is each brand colour
    const seedsBy: number[][] = [[], [], []];
    for (let s = 3; seedsBy.some((b, i) => b.length < counts[i]) && s < 12000; s += 1) {
      const idx = primaryIndex(s);
      if (seedsBy[idx].length < counts[idx]) seedsBy[idx].push(s);
    }

    // ── build STABLE teams: complete triads (one of each colour) first, then hand the
    //    leftover rings out round-robin as extra members (teams of 3–4 ⇒ natural size
    //    variation). Membership never changes after this ⇒ no churn, no clumping. ──
    const pool = seedsBy.map((b) => [...b]); // consumable copies
    const triads = Math.min(counts[0], counts[1], counts[2]);
    const teams: Team[] = [];
    const teamSeeds: { seed: number; c: number }[][] = [];
    for (let i = 0; i < triads; i++) {
      teamSeeds.push([
        { seed: pool[0].pop()!, c: 0 },
        { seed: pool[1].pop()!, c: 1 },
        { seed: pool[2].pop()!, c: 2 },
      ]);
    }
    // leftovers → spread across existing teams (or seed new tiny teams if there were none)
    let rr = 0;
    for (let c = 0; c < 3; c++) {
      while (pool[c].length) {
        const seed = pool[c].pop()!;
        if (teamSeeds.length === 0) teamSeeds.push([]);
        teamSeeds[rr % teamSeeds.length].push({ seed, c });
        rr++;
      }
    }

    // anchors on a loose grid sized to the canvas aspect; separation relax spreads them
    const nT = teamSeeds.length;
    const cols = Math.max(1, Math.round(Math.sqrt((nT * w) / h)));
    const rows = Math.max(1, Math.ceil(nT / cols));
    const ps: P[] = [];
    teamSeeds.forEach((members, ti) => {
      const col = ti % cols;
      const row = Math.floor(ti / cols);
      const cx = w * ((col + 0.5) / cols) + (Math.random() - 0.5) * RS * 0.7;
      const cy = h * ((row + 0.5) / rows) + (Math.random() - 0.5) * RS * 0.7;
      teams.push({
        cx,
        cy,
        dx: 0,
        dy: 0,
        orbit: Math.random() * Math.PI * 2,
        orbV: (ORBIT_MIN + Math.random() * ORBIT_VAR) * (Math.random() < 0.5 ? -1 : 1),
        size: members.length,
      });
      members.forEach((m, slot) => {
        ps.push({
          x: cx + (Math.random() - 0.5) * RS,
          y: cy + (Math.random() - 0.5) * RS,
          vx: 0,
          vy: 0,
          c: m.c,
          seed: m.seed,
          home: ti,
          team: ti,
          slot,
          guest: -1,
          guestUntil: 0,
          guestAng: 0,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.01,
          bph: Math.random() * Math.PI * 2,
          bfr: 0.5 + Math.random() * 0.45, // ~3–8s breathe, desynced
        });
      });
    });
    const n = ps.length;

    // cache the real STM ring per seed (luminosity look, multi-colour charge).
    // Blob URLs (not data URLs) — robust for these larger gradient SVGs in WebKit.
    const imgs = new Map<number, HTMLImageElement>();
    let urls: string[] = [];
    const buildImages = () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls = [];
      imgs.clear();
      const dark = prefersDark();
      ps.forEach((p) => {
        let svg = exportThumbnailSVG(p.seed, 112, false, 150, 40);
        if (dark) svg = svg.split(DARK_BASE[0]).join(DARK_WIRE[0]).split(DARK_BASE[1]).join(DARK_WIRE[1]);
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        urls.push(url);
        const im = new Image();
        im.onload = () => imgs.set(p.seed, im);
        im.src = url;
      });
    };
    buildImages();

    // sync-thread colours — brand palette on the light page, but LIGHTENED for the dark
    // page so the lines actually read against the dark background (proper dark-mode handling).
    const mixWhite = (hex: string, a: number) => {
      const v = parseInt(hex.slice(1), 16);
      const r = (v >> 16) & 255;
      const g = (v >> 8) & 255;
      const b = v & 255;
      const m = (x: number) => Math.round(x + (255 - x) * a);
      return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
    };
    const THREAD_LIGHT = PALETTE;
    const THREAD_DARK = PALETTE.map((c) => mixWhite(c, 0.52));
    let threadCol: readonly string[] = prefersDark() ? THREAD_DARK : THREAD_LIGHT;
    const onScheme = () => {
      threadCol = prefersDark() ? THREAD_DARK : THREAD_LIGHT;
      buildImages(); // re-tint the ring wires for the new scheme
    };
    const stopScheme = watchColorScheme(onScheme);

    const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep

    // ── reusable scratch ─────────────────────────────────────────────────────────
    const tcx = new Float64Array(nT); // team centroids (live, from members)
    const tcy = new Float64Array(nT);
    const tcn = new Float64Array(nT);
    const colx = [0, 0, 0]; // colour centroids (for the sync lean)
    const coly = [0, 0, 0];
    const coln = [0, 0, 0];

    const THREAD_MAX = Math.max(220, Math.min(w, h) * 0.62); // link reach for the sync

    const pad = RS * 0.58;
    // per-discipline thread intensity — ALWAYS at least one colour > 0 (no gaps). One
    // discipline holds fully lit, then cross-fades into the next; cycles forever.
    const colLit = [0, 0, 0];
    const cycleColors = (tSec: number) => {
      colLit[0] = colLit[1] = colLit[2] = 0;
      const idx = Math.floor(tSec / COLOR_SLOT);
      const a = ((idx % 3) + 3) % 3;
      const local = tSec - idx * COLOR_SLOT;
      if (local < COLOR_HOLD) {
        colLit[a] = 1;
      } else {
        const f = ease((local - COLOR_HOLD) / COLOR_FADE);
        colLit[a] = 1 - f;
        colLit[(a + 1) % 3] = f; // next discipline fading in ⇒ never a blank frame
      }
    };

    // ── occasional cross-team VISITS — one ring at a time drifts over to a nearby team,
    //    lingers as a guest on its rim, then returns home. Orchestrated (≤ MAX_VISITORS,
    //    timed gaps) so it reads as collaboration, never as chaos. ──
    const MAX_VISITORS = Math.max(1, Math.round(nT / 5));
    const VISIT_DUR = 5.5; // seconds spent as a guest
    const VISIT_GAP = 2.6; // min seconds before the next visit starts
    const VISIT_VAR = 3.0;
    let tAbs = 0; // monotonic seconds (visit scheduling)
    let nextVisit = 2.5 + Math.random() * VISIT_VAR;

    const step = (dt: number) => {
      const ds = Math.min(2, Math.max(0.25, dt * 60)); // frame-rate-independent step
      tAbs += dt;
      cycleColors(tAbs); // always-on: which discipline(s) are lit this frame

      // visits: return finished guests, then maybe send one ring to a NEARBY other team
      let visiting = 0;
      for (const p of ps) {
        if (p.guest >= 0 && tAbs >= p.guestUntil) p.guest = -1; // home again
        if (p.guest >= 0) visiting++;
      }
      if (nT > 1 && tAbs >= nextVisit) {
        nextVisit = tAbs + VISIT_GAP + Math.random() * VISIT_VAR;
        if (visiting < MAX_VISITORS) {
          const cand = ps[(Math.random() * n) | 0];
          if (cand.guest < 0) {
            let best = -1;
            let bd = Infinity;
            for (let t = 0; t < nT; t++) {
              if (t === cand.home) continue;
              const dd = Math.hypot(teams[t].cx - cand.x, teams[t].cy - cand.y);
              if (dd < bd) {
                bd = dd;
                best = t;
              }
            }
            if (best >= 0) {
              cand.guest = best;
              cand.guestUntil = tAbs + VISIT_DUR;
              cand.guestAng = Math.random() * Math.PI * 2;
            }
          }
        }
      }
      // current membership this frame (guest while visiting, else home)
      for (const p of ps) p.team = p.guest >= 0 ? p.guest : p.home;

      // team centroids + colour centroids
      tcx.fill(0);
      tcy.fill(0);
      tcn.fill(0);
      colx[0] = colx[1] = colx[2] = 0;
      coly[0] = coly[1] = coly[2] = 0;
      coln[0] = coln[1] = coln[2] = 0;
      for (const p of ps) {
        tcx[p.team] += p.x;
        tcy[p.team] += p.y;
        tcn[p.team] += 1;
        colx[p.c] += p.x;
        coly[p.c] += p.y;
        coln[p.c] += 1;
      }
      for (let i = 0; i < nT; i++) {
        if (tcn[i]) {
          tcx[i] /= tcn[i];
          tcy[i] /= tcn[i];
        }
      }
      for (let c = 0; c < 3; c++) if (coln[c]) {
        colx[c] /= coln[c];
        coly[c] /= coln[c];
      }

      // anchors: low-passed wander, then advance the formation rotation
      for (const tm of teams) {
        tm.dx = tm.dx * DRIFTDECAY + (Math.random() - 0.5) * DRIFT;
        tm.dy = tm.dy * DRIFTDECAY + (Math.random() - 0.5) * DRIFT;
        tm.cx += tm.dx * ds;
        tm.cy += tm.dy * ds;
        tm.orbit += tm.orbV * dt;
      }

      // team ↔ team separation: keep anchors (and so whole teams) clear and spread
      for (let it = 0; it < 2; it++) {
        for (let i = 0; i < nT; i++) {
          for (let j = i + 1; j < nT; j++) {
            const dx = teams[j].cx - teams[i].cx;
            const dy = teams[j].cy - teams[i].cy;
            const d = Math.hypot(dx, dy) || 0.001;
            if (d < TEAMSEP) {
              const push = (TEAMSEP - d) / 2;
              const ux = dx / d;
              const uy = dy / d;
              teams[i].cx -= ux * push;
              teams[i].cy -= uy * push;
              teams[j].cx += ux * push;
              teams[j].cy += uy * push;
            }
          }
        }
        // keep anchors inside the canvas
        for (const tm of teams) {
          tm.cx = Math.min(w - pad, Math.max(pad, tm.cx));
          tm.cy = Math.min(h - pad, Math.max(pad, tm.cy));
        }
      }

      // per-ring forces: steer to formation slot (+ tiny sync lean), integrate
      for (const p of ps) {
        const tm = teams[p.team];
        const cnt = tm.size || 1;
        // home → its formation slot; guest → just OUTSIDE the host huddle at its visit angle
        const home = p.guest < 0;
        const ang = home ? tm.orbit + (p.slot / cnt) * Math.PI * 2 : tm.orbit + p.guestAng;
        const radius = home ? (cnt <= 1 ? 0 : RFORM) : RFORM * 1.2;
        const targx = tm.cx + Math.cos(ang) * radius;
        const targy = tm.cy + Math.sin(ang) * radius;
        let ax = (targx - p.x) * COH;
        let ay = (targy - p.y) * COH;
        const am = Math.hypot(ax, ay);
        if (am > COHCAP) {
          ax = (ax / am) * COHCAP;
          ay = (ay / am) * COHCAP;
        }
        p.vx += ax * ds;
        p.vy += ay * ds;

        // SYNC: the discipline lit this frame leans toward its centroid (capped tiny ⇒ stays
        // in its team), so that one colour visibly draws together while it's lit, then relaxes.
        const cl = colLit[p.c];
        if (cl > 0.01) {
          const dx = colx[p.c] - p.x;
          const dy = coly[p.c] - p.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const mag = Math.min(LEAN * cl, LEANCAP * cl);
          p.vx += (dx / d) * mag * ds;
          p.vy += (dy / d) * mag * ds;
        }
      }

      // integrate + damping (frame-rate independent)
      const damp = Math.pow(DAMP, ds);
      for (const p of ps) {
        p.x += p.vx * ds;
        p.y += p.vy * ds;
        p.vx *= damp;
        p.vy *= damp;
        p.rot += p.vr * ds;
      }

      // HARD hitbox — position-based min-distance relaxation, so rings never overlap.
      // 8 iterations because the cohesion/lean forces push members together every frame;
      // fewer passes leave them squeezed inside each other (n ≤ 37 ⇒ O(n²·8) is trivial).
      for (let it = 0; it < 8; it++) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = ps[i];
            const b = ps[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.001;
            if (d < MIND) {
              const push = (MIND - d) / 2;
              const ux = dx / d;
              const uy = dy / d;
              a.x -= ux * push;
              a.y -= uy * push;
              b.x += ux * push;
              b.y += uy * push;
            }
          }
        }
      }

      // soft walls
      for (const p of ps) {
        if (p.x < pad) {
          p.x = pad;
          p.vx *= -0.4;
        } else if (p.x > w - pad) {
          p.x = w - pad;
          p.vx *= -0.4;
        }
        if (p.y < pad) {
          p.y = pad;
          p.vy *= -0.4;
        } else if (p.y > h - pad) {
          p.y = h - pad;
          p.vy *= -0.4;
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // SYNC threads — same colour, DIFFERENT teams: alignment made visible. Only the lit
      // discipline(s) draw (one held, sometimes a second fading in), brightness × colLit.
      ctx.lineWidth = 1.9;
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const a = ps[i];
        const cl = colLit[a.c];
        if (cl < 0.01) continue; // this discipline isn't lit right now
        for (let j = i + 1; j < n; j++) {
          const b = ps[j];
          if (a.c !== b.c || a.team === b.team) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > THREAD_MAX) continue;
          // brighter, with a gentler falloff so mid-range links stay legible
          const near = 1 - d / THREAD_MAX;
          const alpha = cl * 0.72 * (0.35 + 0.65 * near);
          if (alpha < 0.015) continue;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = threadCol[a.c];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          // a travelling pulse along the thread (the "signal" of a sync)
          const t = (tAbs * 0.95 + (i * 7 + j * 13) * 0.05) % 1;
          const px = a.x + dx * t;
          const py = a.y + dy * t;
          ctx.globalAlpha = Math.min(1, alpha * 2.2);
          ctx.beginPath();
          ctx.arc(px, py, 2.7, 0, Math.PI * 2);
          ctx.fillStyle = threadCol[a.c];
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // rings, with a tiny desynced breathe so the settled field is alive, not frozen
      const tnow = tAbs;
      for (const p of ps) {
        const img = imgs.get(p.seed);
        const s = RS * (1 + 0.028 * Math.sin(p.bph + tnow * p.bfr));
        if (img) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.drawImage(img, -s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, RS * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE[p.c];
          ctx.fill();
        }
      }
    };

    let raf = 0;
    let running = false;
    let last = performance.now();
    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // settle a static frame so the first paint already reads as spread teams (with threads)
    for (let k = 0; k < 600; k++) step(1 / 60);
    draw();

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(wrap);
    const ro = new ResizeObserver(() => {
      layout();
      draw();
    });
    ro.observe(wrap);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      stopScheme();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true" style={{ width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}

// ── tuning (verified headlessly) ─────────────────────────────────────────────────
const RFORM = RS * 0.82; // member orbit radius within a team (compact huddle)
const TEAMSEP = RS * 3.0; // min distance between team anchors ⇒ teams stay distinct/spread
const MIND = RS * 1.02; // HARD hitbox — centres never closer than this (no overlap)
const COH = 0.085; // steer toward the formation slot
const COHCAP = 0.5; // cap so a far member glides in gently (never yanked across the canvas)
const ORBIT_MIN = 0.06; // rad/s — slow team rotation
const ORBIT_VAR = 0.09;
const DRIFT = 0.12; // low-passed anchor wander (teams roam a little)
const DRIFTDECAY = 0.95;
const LEAN = 0.07; // sync: pull toward the same-colour centroid (softer — it's always-on now)
const LEANCAP = 0.1; // …capped tiny so teams lean, never merge
const DAMP = 0.86;
