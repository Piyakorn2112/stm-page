"use client";

/**
 * LanyardCard — an interactive 3D employee badge, modelled on a real Apple-style
 * lanyard (see /card ref): a FLAT BRAIDED strap drops from the neck (two arms over
 * 3 segments each), meets a minimal flat plastic CLIP, and that clip threads a REAL
 * pill SLOT in the top of the card. The card hangs from it; released, it is gently
 * (damped) torqued back to face the viewer.
 *
 * Physics: Rapier bodies + inextensible ROPE joints, with the chain filtered OUT of
 * collisions with itself/the card (interactionGroups = Blender's "Disable Collisions")
 * so the clip can't shove the card. Heavy damping + extra solver iterations + a heavier
 * card + a DAMPED facing torque make it read like weighty rope, not a rubber band.
 *
 * Straps are real ribbon geometry (flat + cast shadows). The card is a thin matte
 * golden-ratio slab with BEVELLED edges + real rounded corners + a real slot; the
 * printed face (cardFace.ts) is toneMapped-off so the ring stays vivid, and repaints
 * on a debounced pipeline so renaming never resets the scene. Client-only.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  interactionGroups,
  Physics,
  RigidBody,
  useRevoluteJoint,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { FACE_W, FACE_H, GOLDEN, paintCardFace, paintNameField, type Layer } from "./cardFace";

const CARD_W = 1.9;
const CARD_H = CARD_W * GOLDEN;
const CARD_D = 0.044;
const CARD_R = 0.085;
const BEVEL = 0.006;
// The bevelled body's flat front cap is at +CARD_D/2; the print must sit just IN
// FRONT of it (a hair proud) or the white cap occludes it.
const FACE_Z = CARD_D / 2 + 0.003;
const SLOT_Y = CARD_H / 2 - 0.24;
const SLOT_W = 0.46;
const SLOT_H = 0.12;
const STRAP = 1.28; // rope segment rest length (3 per arm) — slightly taut
const THICK = 0.22; // flat ribbon width — matches the clip
// name-field hit-target, in card-space (texture v≈0.8 → card y ≈ -0.286·CARD_H). Clicking
// it focuses the hidden input to rename instead of grabbing the card to swing it.
const NAME_HIT_Y = -CARD_H * 0.286;
const NAME_HIT_W = CARD_W * 0.74;
const NAME_HIT_H = 0.52;
// rope ribbon resolution — the Y-strap is near-straight, so 32 samples is smooth; fewer
// curve evals + a smaller per-frame geometry update than the old 48 (perf).
const SAMPLES = 32;
// neck-anchor rest positions; the hinge circle swings the whole rope around these.
const ANCHOR_Y = 5.0;
const ANCHOR_X = 1.0;
// invisible HINGE CIRCLE: the two strap ends ride on a circle (radius R, centre above) that
// gently rotates. Rotating it swings both ends about the centre → coupled sway + roll, like a
// real hanger; the ends rest exactly at (±ANCHOR_X, ANCHOR_Y).
const HINGE_R = 1.45;
const HINGE_SPREAD = Math.asin(ANCHOR_X / HINGE_R); // strap ends sit ±this from the circle's bottom
const HINGE_CY = ANCHOR_Y + HINGE_R * Math.cos(HINGE_SPREAD); // circle centre (the revolute pivot)
const HUB_LOCAL_Y = ANCHOR_Y - HINGE_CY; // strap-end height on the hub, below its centre (≈ -1.05)
const FRAME = 2.0;
const NOHIT = interactionGroups([0], []);

type Theme = { band: string; clip: string; wall: string; wall2: string; key: string; fill: string; ground: string };

// ── card geometry: bevelled body + real slot + UV-mapped flat face ─────────
function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function pillHole(cx: number, cy: number, pw: number, ph: number) {
  const p = new THREE.Path();
  const r = ph / 2;
  const left = cx - pw / 2 + r;
  const right = cx + pw / 2 - r;
  p.moveTo(left, cy + r);
  p.lineTo(right, cy + r);
  p.absarc(right, cy, r, Math.PI / 2, -Math.PI / 2, true);
  p.lineTo(left, cy - r);
  p.absarc(left, cy, r, -Math.PI / 2, -Math.PI * 1.5, true);
  return p;
}
function buildCardGeo() {
  const shape = roundedRectShape(CARD_W, CARD_H, CARD_R);
  shape.holes.push(pillHole(0, SLOT_Y, SLOT_W, SLOT_H));
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: CARD_D - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 32,
  });
  body.computeBoundingBox();
  const bb = body.boundingBox!;
  body.translate(0, 0, -(bb.min.z + bb.max.z) / 2); // centre on z
  body.computeVertexNormals();
  const face = new THREE.ShapeGeometry(shape, 32);
  const pos = face.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + CARD_W / 2) / CARD_W;
    uv[i * 2 + 1] = (pos.getY(i) + CARD_H / 2) / CARD_H;
  }
  face.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return { body, face };
}

// ── real flat ribbon geometry for a strap ──────────────────────────────────
const TILES = 14;
function makeRibbonGeo(n: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * TILES;
    uv[i * 4] = u;
    uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = u;
    uv[i * 4 + 3] = 1;
    if (i < n - 1) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}
const _T = new THREE.Vector3();
const _W = new THREE.Vector3();
const _Z = new THREE.Vector3(0, 0, 1);
function updateRibbon(geo: THREE.BufferGeometry, pts: THREE.Vector3[], halfW: number) {
  const arr = geo.attributes.position.array as Float32Array;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    _T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
    _W.crossVectors(_T, _Z);
    if (_W.lengthSq() < 1e-8) _W.set(1, 0, 0);
    _W.normalize().multiplyScalar(halfW);
    arr[i * 6] = p.x - _W.x;
    arr[i * 6 + 1] = p.y - _W.y;
    arr[i * 6 + 2] = p.z - _W.z;
    arr[i * 6 + 3] = p.x + _W.x;
    arr[i * 6 + 4] = p.y + _W.y;
    arr[i * 6 + 5] = p.z + _W.z;
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  // no computeBoundingSphere(): the bands are flagged frustumCulled={false} (they always
  // span the on-screen rope), so a per-frame bounding-sphere rebuild would be pure waste.
}

function useCardTextures(name: string, id: string, focused: boolean, onFirstPaint?: () => void) {
  const [store] = useState(() => {
    const mk = (bg: string): Layer => {
      const canvas = document.createElement("canvas");
      canvas.width = FACE_W;
      canvas.height = FACE_H;
      const ctx = canvas.getContext("2d"); // pre-fill so there's no blank flash before first paint
      if (ctx) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, FACE_W, FACE_H);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      return { canvas, tex };
    };
    return { face: mk("#ffffff"), emis: mk("#000000") };
  });
  const gen = useRef(0);
  const first = useRef(true);
  const cb = useRef(onFirstPaint);
  const caretOn = useRef(false);
  const nameRef = useRef(name);
  useEffect(() => {
    cb.current = onFirstPaint;
    nameRef.current = name; // keep the blink timer reading the latest name without restarting
  });
  // FULL repaint (ring + everything) — debounced so per-keystroke ring generation stays cheap
  useEffect(() => {
    if (first.current) {
      first.current = false;
      // signal the fade only once the print is actually drawn (avoids the content pop)
      paintCardFace(store.face, store.emis, { name, id, focused, caretOn: caretOn.current }).finally(() => cb.current?.());
      return;
    }
    const myGen = ++gen.current;
    const t = setTimeout(() => {
      if (gen.current === myGen) paintCardFace(store.face, store.emis, { name, id, focused, caretOn: caretOn.current });
    }, 180);
    return () => clearTimeout(t);
  }, [store, name, id, focused]);
  // IMMEDIATE name-band repaint — typing + focus chrome track in real time (the ring above
  // lags 180ms; this cheap band repaint follows every keystroke and focus change)
  useEffect(() => {
    if (first.current) return; // first paint owns the initial draw
    caretOn.current = focused; // caret shows the instant you focus / type
    paintNameField(store.face, { name, focused, caretOn: focused });
  }, [store, name, focused]);
  // blinking caret while focused — slow timer; reads the latest name via ref so keystrokes
  // don't restart it
  useEffect(() => {
    if (!focused) return;
    const iv = setInterval(() => {
      caretOn.current = !caretOn.current;
      paintNameField(store.face, { name: nameRef.current, focused: true, caretOn: caretOn.current });
    }, 530);
    return () => clearInterval(iv);
  }, [store, focused]);
  return store;
}

function makeStrapTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 40;
  const x = c.getContext("2d")!;
  x.fillStyle = color;
  x.fillRect(0, 0, 64, 40);
  x.lineWidth = 2.6;
  x.strokeStyle = "rgba(255,255,255,0.09)";
  for (let i = -40; i < 64; i += 8) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 40, 40);
    x.stroke();
  }
  x.strokeStyle = "rgba(0,0,0,0.26)";
  for (let i = 0; i < 104; i += 8) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i - 40, 40);
    x.stroke();
  }
  x.strokeStyle = "rgba(0,0,0,0.42)";
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(0, 2);
  x.lineTo(64, 2);
  x.moveTo(0, 38);
  x.lineTo(64, 38);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeNoise(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const px = i % S;
    const py = (i / S) | 0;
    const n = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
    const v = 188 + Math.floor((n - Math.floor(n)) * 52);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 5);
  return t;
}

// studio backdrop — a soft radial vignette so the card sits in light, not on a flat slab
function makeWall(center: string, edge: string): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.7);
  g.addColorStop(0, center);
  g.addColorStop(1, edge);
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const GOBO_BLOBS: [number, number, number, number][] = [
  [0.22, 0.3, 0.26, 0.9], [0.7, 0.18, 0.3, 0.75], [0.5, 0.55, 0.34, 1], [0.82, 0.6, 0.22, 0.6],
  [0.3, 0.74, 0.28, 0.8], [0.6, 0.85, 0.2, 0.55], [0.13, 0.6, 0.18, 0.5], [0.88, 0.32, 0.16, 0.45],
  [0.45, 0.12, 0.18, 0.6], [0.15, 0.15, 0.14, 0.4], [0.74, 0.78, 0.24, 0.7], [0.4, 0.4, 0.2, 0.65],
];
function makeGobo(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0b0b0d";
  x.fillRect(0, 0, S, S);
  for (const [bx, by, r, b] of GOBO_BLOBS) {
    const cx = bx * S;
    const cy = by * S;
    const rad = r * S;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(255,255,255,${b})`);
    g.addColorStop(0.6, `rgba(255,255,255,${b * 0.35})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, rad, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vfov = (camera.fov * Math.PI) / 180;
    const halfH = (CARD_H / 2) * FRAME;
    const halfW = (CARD_W / 2) * FRAME;
    const need = Math.max(halfH, halfW / aspect);
    camera.position.set(0, 0, need / Math.tan(vfov / 2));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// Frame-rate cap. A priority useFrame (>0) makes R3F hand rendering to us (auto-render off), so we
// render at most `maxFps` — 120/144Hz displays don't burn GPU past 90, while a 60Hz screen still
// renders its native 60 (we never render faster than the rAF). The `% minDelta` carry keeps the
// AVERAGE on target (90 on a 120Hz panel = 3-of-4 frames, not a 2-of-4 = 60 drop). Keeping
// frameloop="always" means pointer events / dragging behave exactly as before — no interaction risk.
function RenderThrottle({ maxFps }: { maxFps: number }) {
  const acc = useRef(1 / maxFps); // render the first frame immediately
  const minDelta = 1 / maxFps;
  useFrame(({ gl, scene, camera }, delta) => {
    acc.current += delta;
    if (acc.current >= minDelta) {
      acc.current %= minDelta;
      gl.render(scene, camera);
    }
  }, 1);
  return null;
}

function Lanyard({
  theme,
  name,
  id,
  focused,
  onRequestFocus,
  onRequestBlur,
  onFirstPaint,
}: {
  theme: Theme;
  name: string;
  id: string;
  focused: boolean;
  onRequestFocus: () => void;
  onRequestBlur: () => void;
  onFirstPaint?: () => void;
}) {
  const hubPivot = useRef<RapierRigidBody>(null!); // fixed point the hinge rotates around
  const hub = useRef<RapierRigidBody>(null!); // the near-weightless rotating "circle" (revolute about Z)
  const l1 = useRef<RapierRigidBody>(null!);
  const l2 = useRef<RapierRigidBody>(null!);
  const r1 = useRef<RapierRigidBody>(null!);
  const r2 = useRef<RapierRigidBody>(null!);
  const merge = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);
  const bandA = useRef<THREE.Mesh>(null);
  const bandB = useRef<THREE.Mesh>(null);

  const { face, emis } = useCardTextures(name, id, focused, onFirstPaint);
  const strapTex = useMemo(() => makeStrapTexture(theme.band), [theme.band]);
  const noise = useMemo(() => makeNoise(), []);
  const geo = useMemo(() => buildCardGeo(), []);
  const ribbonA = useMemo(() => makeRibbonGeo(SAMPLES), []);
  const ribbonB = useMemo(() => makeRibbonGeo(SAMPLES), []);

  const vec = useRef(new THREE.Vector3()).current;
  const dir = useRef(new THREE.Vector3()).current;
  const hookL = useRef(new THREE.Vector3()).current;
  const mq = useRef(new THREE.Quaternion()).current;
  const eq = useRef(new THREE.Quaternion()).current;
  const windPt = useRef(new THREE.Vector3()).current; // wind application point (card's lower-front edge)
  const hubQ = useRef(new THREE.Quaternion()).current; // hub orientation (for the orbiting strap ends)
  const aTmp = useRef(new THREE.Vector3()).current; // scratch for a strap-end world position
  const curveA = useRef(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])).current;
  const curveB = useRef(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])).current;
  // preallocated ribbon sample points — reused every frame so curve sampling never
  // allocates (CatmullRomCurve3.getPoints() would mint a Vector3 per sample per band per frame)
  const ptsA = useRef(Array.from({ length: SAMPLES }, () => new THREE.Vector3())).current;
  const ptsB = useRef(Array.from({ length: SAMPLES }, () => new THREE.Vector3())).current;
  // swing-velocity estimate while dragging ⇒ released with natural (damped) momentum
  const dragVel = useRef(new THREE.Vector3()).current;
  const dragInst = useRef(new THREE.Vector3()).current;
  const prevTarget = useRef<THREE.Vector3 | null>(null);

  const [dragged, setDragged] = useState<false | THREE.Vector3>(false);
  const [hovered, setHovered] = useState(false);
  const justReleased = useRef(false);
  // hold the card kinematic (locked at its rest pose) for a beat on mount so the rope + the
  // dynamic hub settle AROUND it; releasing it to dynamic from equilibrium avoids the startup
  // jerk that otherwise flung it out of frame.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, []);

  // the hinge: hub pinned to the fixed pivot, free to ROTATE about Z (swings in the view plane)
  useRevoluteJoint(hubPivot, hub, [[0, 0, 0], [0, 0, 0], [0, 0, 1]]);
  // strap arms attach to the two ends of the hinge circle (which orbit as the hub rotates)
  useRopeJoint(hub, l1, [[-ANCHOR_X, HUB_LOCAL_Y, 0], [0, 0, 0], STRAP]);
  useRopeJoint(l1, l2, [[0, 0, 0], [0, 0, 0], STRAP]);
  useRopeJoint(l2, merge, [[0, 0, 0], [0, 0, 0], STRAP]);
  useRopeJoint(hub, r1, [[ANCHOR_X, HUB_LOCAL_Y, 0], [0, 0, 0], STRAP]);
  useRopeJoint(r1, r2, [[0, 0, 0], [0, 0, 0], STRAP]);
  useRopeJoint(r2, merge, [[0, 0, 0], [0, 0, 0], STRAP]);
  useSphericalJoint(merge, card, [[0, 0, 0], [0, SLOT_Y, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => void (document.body.style.cursor = "auto");
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    const ts = state.clock.elapsedTime;
    // ramp the wind in over the first ~5s so the lanyard settles from its mount pose calmly
    // (full-strength wind during the initial settle was flinging the card out of frame), and
    // ease it off (not away) while the card is held.
    const warm = Math.min(1, ts / 5);
    const wScale = (dragged ? 0.4 : 1) * warm * warm;
    // WIND ON THE ROPE: a soft, gusty lateral breeze pushes the strap nodes. The hub is a near-
    // weightless, low-friction REVOLUTE hinge, so this billow (plus the card's own sway) is what
    // physically swings the whole lanyard — emergent, not scripted. Lower nodes get a bit more so
    // it billows from the bottom up.
    if (l1.current && l2.current && r1.current && r2.current && merge.current) {
      const gx = (0.5 * Math.sin(ts * 0.6) + 0.3 * Math.sin(ts * 1.27 + 1.0)) * wScale;
      const gz = 0.35 * Math.sin(ts * 0.43 + 2.0) * wScale;
      const puff = (r: typeof l1, amp: number) => r.current?.applyImpulse({ x: gx * amp, y: 0, z: gz * amp }, true);
      puff(l1, 0.0007);
      puff(l2, 0.0013);
      puff(r1, 0.0007);
      puff(r2, 0.0013);
      puff(merge, 0.0019);
    }
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, l1, l2, r1, r2, merge, hub].forEach((r) => r.current?.wakeUp());
      // HARD max-stretch: clamp the SLOT within arm-reach of BOTH neck anchors (±1, 5)
      // so neither single arm over-stretches — that residual over-stretch (when dragged
      // high + far to a side) was what still snapped a little on release.
      let sx = vec.x - dragged.x;
      let sy = vec.y - dragged.y + SLOT_Y;
      let sz = vec.z - dragged.z;
      const ARM = 3.82;
      for (let it = 0; it < 3; it++) {
        for (let a = -1; a <= 1; a += 2) {
          const ex = sx - a;
          const ey = sy - 5;
          const ez = sz;
          const dd = Math.hypot(ex, ey, ez) || 1;
          if (dd > ARM) {
            const f = ARM / dd;
            sx = a + ex * f;
            sy = 5 + ey * f;
            sz = ez * f;
          }
        }
      }
      const tx = sx;
      const ty = sy - SLOT_Y;
      const tz = sz;
      // low-passed swing velocity from the per-frame target delta (rejects single-frame
      // spikes from the reach clamp), carried as momentum when released
      if (prevTarget.current && delta > 1e-4) {
        const inv = 1 / delta;
        dragInst.set((tx - prevTarget.current.x) * inv, (ty - prevTarget.current.y) * inv, (tz - prevTarget.current.z) * inv);
        dragVel.lerp(dragInst, 0.5); // a touch more responsive ⇒ a quick flick is captured, not averaged away
      }
      (prevTarget.current ??= new THREE.Vector3()).set(tx, ty, tz);
      card.current.setNextKinematicTranslation({ x: tx, y: ty, z: tz });
      justReleased.current = true;
    } else if (card.current) {
      // on release, hand the card a DAMPED + CAPPED fraction of its swing velocity so it
      // lets go with believable momentum (a real swung card keeps moving), without the
      // violent kinematic-accrued fling the hard zero used to suppress.
      if (justReleased.current) {
        justReleased.current = false;
        const REL = 0.6; // fraction of the swing speed carried into the free swing (more inertia)
        const CAP = 6.5; // m/s ceiling ⇒ a hard flick can't launch it past the rope reach
        const m = dragVel.length();
        const f = (m > CAP ? CAP / m : 1) * REL;
        card.current.setLinvel({ x: dragVel.x * f, y: dragVel.y * f, z: dragVel.z * f }, true);
        card.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        dragVel.set(0, 0, 0);
        prevTarget.current = null;
      }
      // WIND at the card's lower-front edge: a gusty impulse applied OFF-CENTRE (below the CoM)
      // and IN FRONT of it, so r×F yields a natural blend of sway, roll and 3D yaw — the card
      // "catches" the breeze and tilts, instead of being spun by a scripted torque.
      const cr = card.current.rotation();
      const ct = card.current.translation();
      mq.set(cr.x, cr.y, cr.z, cr.w);
      const gust = 0.6 * Math.sin(ts * 0.9 + 0.5) + 0.4 * Math.sin(ts * 1.7 + 2.1) + 0.25 * Math.sin(ts * 0.31);
      // a SMALL lateral breeze on the card — kept light so the side-to-side sway stays subtle
      windPt.set(0, -CARD_H * 0.42, CARD_D / 2 + 0.04).applyQuaternion(mq);
      card.current.applyImpulseAtPoint(
        { x: gust * 0.006, y: 0, z: gust * 0.0016 },
        { x: ct.x + windPt.x, y: ct.y + windPt.y, z: ct.z + windPt.z },
        true,
      );
      // dedicated 3D YAW — a gentle oscillating TURN about the card's own vertical so it shows its
      // 3D-ness clearly, WITHOUT adding sideways sway (decoupled from the linear breeze above).
      const yaw = (0.6 * Math.sin(ts * 0.5 + 0.3) + 0.4 * Math.sin(ts * 1.13 + 1.7)) * warm;
      vec.set(0, 1, 0).applyQuaternion(mq); // card's up axis in world ⇒ true yaw regardless of tilt
      card.current.applyTorqueImpulse({ x: vec.x * yaw * 0.01, y: vec.y * yaw * 0.01, z: vec.z * yaw * 0.01 }, true);
      // soft, damped return-to-forward so the wind sway eases back to facing the viewer. The yaw
      // (Y) gain is LOWER than roll/pitch ⇒ the card turns more freely left↔right (more 3D tilt)
      // while still never drifting away.
      const av = card.current.angvel();
      eq.set(cr.x, cr.y, cr.z, cr.w).invert();
      if (eq.w < 0) {
        eq.x = -eq.x;
        eq.y = -eq.y;
        eq.z = -eq.z;
        eq.w = -eq.w;
      }
      const w = Math.min(1, Math.max(-1, eq.w));
      const angle = 2 * Math.acos(w);
      const s = Math.sqrt(1 - w * w);
      if (angle > 1e-3 && s > 1e-4) {
        const k = 0.055; // roll/pitch restoring
        const ky = 0.03; // softer yaw ⇒ freer left↔right turn
        const kd = 0.03;
        card.current.applyTorqueImpulse(
          { x: (eq.x / s) * angle * k - av.x * kd, y: (eq.y / s) * angle * ky - av.y * kd, z: (eq.z / s) * angle * k - av.z * kd },
          true,
        );
      }
    }

    if (!bandA.current || !bandB.current || !card.current) return;
    if (!hub.current || !l1.current || !l2.current || !r1.current || !r2.current) return;

    // the strap tops ride the two ends of the rotating hub circle (orbit as it swings)
    const hp = hub.current.translation();
    const hr = hub.current.rotation();
    hubQ.set(hr.x, hr.y, hr.z, hr.w);

    // strap arms end at the clip top, which rides rigidly in the card slot
    const ct = card.current.translation();
    const cr = card.current.rotation();
    mq.set(cr.x, cr.y, cr.z, cr.w);
    hookL.set(0, SLOT_Y + 0.32, CARD_D / 2 + 0.03).applyQuaternion(mq);
    const hx = ct.x + hookL.x;
    const hy = ct.y + hookL.y;
    const hz = ct.z + hookL.z;

    const set = (p: THREE.Vector3, b: { x: number; y: number; z: number }) => p.set(b.x, b.y, b.z);
    aTmp.set(-ANCHOR_X, HUB_LOCAL_Y, 0).applyQuaternion(hubQ);
    curveA.points[0].set(hp.x + aTmp.x, hp.y + aTmp.y, hp.z + aTmp.z);
    set(curveA.points[1], l1.current.translation());
    set(curveA.points[2], l2.current.translation());
    curveA.points[3].set(hx, hy, hz);
    for (let i = 0; i < SAMPLES; i++) curveA.getPoint(i / (SAMPLES - 1), ptsA[i]);
    updateRibbon(ribbonA, ptsA, THICK / 2);

    aTmp.set(ANCHOR_X, HUB_LOCAL_Y, 0).applyQuaternion(hubQ);
    curveB.points[0].set(hp.x + aTmp.x, hp.y + aTmp.y, hp.z + aTmp.z);
    set(curveB.points[1], r1.current.translation());
    set(curveB.points[2], r2.current.translation());
    curveB.points[3].set(hx, hy, hz);
    for (let i = 0; i < SAMPLES; i++) curveB.getPoint(i / (SAMPLES - 1), ptsB[i]);
    updateRibbon(ribbonB, ptsB, THICK / 2);
  });

  // Tuned toward CRITICAL damping (not over-damped/dead): the joints are kept
  // inextensible by the 24 solver iterations + reach clamp, so damping is free to be
  // lower here, giving a natural swing-and-settle instead of a sluggish stop.
  const node = { angularDamping: 3.0, linearDamping: 2.4, canSleep: false as const, collisionGroups: NOHIT };
  // the card itself is damped LESS than the rope nodes so it actually responds to the breeze
  // (sways + tilts), then eases back via the PD — the rope stays well-damped so it doesn't whip.
  const cardNode = { angularDamping: 1.7, linearDamping: 1.9, canSleep: false as const, collisionGroups: NOHIT };
  const plastic = { color: theme.clip, roughness: 0.42, metalness: 0.08, clearcoat: 0.5, clearcoatRoughness: 0.35 };

  return (
    <>
      <group>
        {/* invisible HINGE: a fixed pivot + a near-weightless, low-friction disc on a revolute
            joint (rotates about Z). The two strap ends attach to it; wind on the rope + the card's
            sway spin it freely ⇒ the whole lanyard swings from a real hinge, not a scripted peg. */}
        <RigidBody ref={hubPivot} type="fixed" position={[0, HINGE_CY, 0]} />
        <RigidBody ref={hub} position={[0, HINGE_CY, 0]} angularDamping={1.0} linearDamping={1} canSleep={false} collisionGroups={NOHIT}>
          <BallCollider args={[0.45]} density={0.4} collisionGroups={NOHIT} />
        </RigidBody>
        <RigidBody ref={l1} position={[-0.66, 3.76, 0]} {...node}>
          <BallCollider args={[0.14]} collisionGroups={NOHIT} />
        </RigidBody>
        <RigidBody ref={l2} position={[-0.33, 2.53, 0]} {...node}>
          <BallCollider args={[0.14]} collisionGroups={NOHIT} />
        </RigidBody>
        <RigidBody ref={r1} position={[0.66, 3.76, 0]} {...node}>
          <BallCollider args={[0.14]} collisionGroups={NOHIT} />
        </RigidBody>
        <RigidBody ref={r2} position={[0.33, 2.53, 0]} {...node}>
          <BallCollider args={[0.14]} collisionGroups={NOHIT} />
        </RigidBody>
        <RigidBody ref={merge} position={[0, SLOT_Y, 0]} {...node}>
          <BallCollider args={[0.1]} collisionGroups={NOHIT} />
        </RigidBody>

        <RigidBody ref={card} position={[0, 0, 0]} {...cardNode} type={dragged || !settled ? "kinematicPosition" : "dynamic"}>
          <CuboidCollider args={[CARD_W / 2, CARD_H / 2, 0.03]} restitution={0} friction={0.95} density={1.2} collisionGroups={NOHIT} />
          <group
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerUp={(e) => {
              (e.target as Element).releasePointerCapture?.(e.pointerId);
              setDragged(false);
            }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              onRequestBlur(); // grabbing the card to swing it leaves the name field
              const t = card.current!.translation();
              setDragged(new THREE.Vector3().copy(e.point).sub(new THREE.Vector3(t.x, t.y, t.z)));
            }}
          >
            <mesh geometry={geo.body} castShadow receiveShadow>
              <meshStandardMaterial color="#ffffff" roughness={0.86} metalness={0} roughnessMap={noise} bumpMap={noise} bumpScale={0.01} envMapIntensity={0.25} />
            </mesh>
            <mesh geometry={geo.face} position={[0, 0, FACE_Z]}>
              <meshStandardMaterial map={face.tex} emissiveMap={emis.tex} emissive="#ffffff" emissiveIntensity={1.2} roughness={1} metalness={0} envMapIntensity={0} toneMapped={false} />
            </mesh>
            {/* name-field hit-target: a transparent plane over the printed name. Clicking it
                focuses the hidden input to rename (stopPropagation ⇒ it doesn't start a drag);
                the rest of the badge stays grabbable. */}
            <mesh
              position={[0, NAME_HIT_Y, FACE_Z + 0.001]}
              onPointerDown={(e) => e.stopPropagation()} // ⇒ clicking the name never starts a card drag
              onPointerUp={(e) => {
                e.stopPropagation();
                // focus on pointer-UP (after the canvas mousedown's focus-steal on down), still
                // inside the user gesture so the mobile keyboard opens
                onRequestFocus();
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "text";
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = hovered ? "grab" : "auto";
              }}
            >
              <planeGeometry args={[NAME_HIT_W, NAME_HIT_H]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* minimal flat plastic clip — loop bar + plate threading the slot */}
            <group position={[0, SLOT_Y, 0]}>
              <mesh position={[0, 0.32, CARD_D / 2 + 0.03]} castShadow>
                <boxGeometry args={[0.28, 0.07, 0.05]} />
                <meshPhysicalMaterial {...plastic} />
              </mesh>
              <mesh position={[0, 0.13, CARD_D / 2 + 0.02]} castShadow>
                <boxGeometry args={[0.22, 0.36, 0.03]} />
                <meshPhysicalMaterial {...plastic} />
              </mesh>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.13, SLOT_H - 0.03, CARD_D + 0.05]} />
                <meshPhysicalMaterial {...plastic} />
              </mesh>
              <mesh position={[0, -0.07, -(CARD_D / 2 + 0.02)]} castShadow>
                <boxGeometry args={[0.22, 0.14, 0.03]} />
                <meshPhysicalMaterial {...plastic} />
              </mesh>
            </group>
          </group>
        </RigidBody>
      </group>

      <mesh ref={bandA} geometry={ribbonA} castShadow frustumCulled={false}>
        <meshStandardMaterial map={strapTex} side={THREE.DoubleSide} roughness={0.76} metalness={0.04} />
      </mesh>
      <mesh ref={bandB} geometry={ribbonB} castShadow frustumCulled={false}>
        <meshStandardMaterial map={strapTex} side={THREE.DoubleSide} roughness={0.76} metalness={0.04} />
      </mesh>
    </>
  );
}

export default function LanyardCard({
  name,
  id,
  focused,
  onRequestFocus,
  onRequestBlur,
}: {
  name: string;
  id: string;
  focused: boolean;
  onRequestFocus: () => void;
  onRequestBlur: () => void;
}) {
  // init from the real scheme on the FIRST render so the theme never swaps post-mount
  // (the swap regenerated the wall texture + all light colours = a whole-scene recolour).
  const [dark, setDark] = useState(
    () => (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) || false,
  );
  const [visible, setVisible] = useState(true);
  const [ctxKey, setCtxKey] = useState(0);
  const [ready, setReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // safety: reveal even if the first paint never signals (e.g. an image error)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const theme: Theme = dark
    ? { band: "#101013", clip: "#2b2d34", wall: "#34363f", wall2: "#212329", key: "#fbfcff", fill: "#eef0f4", ground: "#191a20" }
    : { band: "#141417", clip: "#1b1c20", wall: "#f1eee9", wall2: "#e2ded7", key: "#fffaf7", fill: "#f4f5f7", ground: "#e8e4dd" };
  const gobo = useMemo(() => makeGobo(), []);
  const wallTex = useMemo(() => makeWall(theme.wall, theme.wall2), [theme.wall, theme.wall2]);

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", height: "100%", opacity: ready ? 1 : 0, transition: "opacity 700ms ease" }}
    >
      <Canvas
        key={ctxKey}
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 0, 11], fov: 30 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        frameloop={visible ? "always" : "never"}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        onCreated={({ gl }) => {
          requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              setCtxKey((k) => k + 1);
            },
            { once: true },
          );
        }}
      >
        <FitCamera />
        <RenderThrottle maxFps={90} />

        <mesh position={[0, 0, -5]}>
          <planeGeometry args={[48, 40]} />
          <meshStandardMaterial map={wallTex} roughness={0.97} metalness={0} />
        </mesh>
        {/* shadow-catcher just behind the card so the drop shadow reads without darkening the whole wall */}
        <mesh position={[0, 0, -1.2]} receiveShadow>
          <planeGeometry args={[20, 22]} />
          <shadowMaterial opacity={0.26} />
        </mesh>

        <ambientLight intensity={0.36} />
        <hemisphereLight intensity={0.3} color={theme.key} groundColor={theme.ground} />

        {/* KEY — a soft studio softbox raking from the upper-side (not head-on),
            broad cone + max penumbra + soft shadow so it shapes the card, not blasts it */}
        <spotLight
          position={[7.5, 8, 4.5]}
          angle={0.95}
          penumbra={1}
          intensity={3.2}
          decay={0}
          distance={40}
          color={theme.key}
          map={gobo}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0002}
          shadow-radius={12}
        />
        {/* soft FILL from the opposite lower-side */}
        <spotLight position={[-6.5, 2.5, 6]} angle={0.95} penumbra={1} intensity={1.7} decay={0} color={theme.fill} />
        {/* RIM rig — two BACK lights raking from behind the card so its bevelled edges and
            the strap catch a bright outline and separate cleanly from the wall (the third
            point of classic key/fill/rim product lighting). No shadows ⇒ cheap. A touch of
            cool on one side + warm on the other gives the edge a premium two-tone glint. */}
        <directionalLight position={[5, 6, -5]} intensity={dark ? 1.5 : 1.05} color={dark ? "#dde6ff" : "#e9f0ff"} />
        <directionalLight position={[-5.5, 4, -4.5]} intensity={dark ? 1.05 : 0.7} color={dark ? "#fff0df" : "#fff2e6"} />

        <Physics gravity={[0, -26, 0]} interpolate timeStep={1 / 60} numSolverIterations={24}>
          <Lanyard
            theme={theme}
            name={name}
            id={id}
            focused={focused}
            onRequestFocus={onRequestFocus}
            onRequestBlur={onRequestBlur}
            onFirstPaint={() => {
              // defer past a painted opacity:0 frame so the CSS transition actually engages
              // (on cached reloads the paint resolves instantly and would skip the fade)
              requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
            }}
          />
        </Physics>
      </Canvas>
    </div>
  );
}
