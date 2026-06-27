"use client";

/**
 * CardScene — the business card in the SAME studio environment as the /work employee badge
 * (LanyardCard): a soft radial-vignette backdrop wall + a shadow-catcher, a clean key /
 * drifting warm "shaft" gobo / fill / two-tone rim rig, FitCamera + a 90fps throttle, and a
 * light/dark studio theme. The lanyard rope/clip/slot are dropped (a slot would cut the
 * card's full-bleed design); instead the card is a freestanding matte slab you grab to spin
 * (custom trackball inertia + a slow idle drift). Both faces are textured from the card's own
 * SVG (buildFaces). Client-only (heavy WebGL).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import styles from "./styles.module.css";

// world-space card — 90×54mm proportion, paper-thin, a *small* corner radius
const ASPECT = 90 / 54;
const CARD_W = 3.6;
const CARD_H = CARD_W / ASPECT; // 2.16
const CARD_D = 0.013; // paper-thin (a real ~0.35mm business card, not a slab)
const CARD_R = 0.022; // a small cut-paper corner (crisp, not a rounded badge)
const BEVEL = 0.0014;
const FACE_Z = CARD_D / 2 + 0.001;
// how much room around the card the camera frames. The card is LANDSCAPE, so the width is
// fit tightly (the card stays prominent even on tall/portrait viewports) while the height gets
// more air. Without this, a wide card on a tall screen fits-by-width tiny + looks lost.
const FRAME_W = 1.52;
const FRAME_H = 2.1;
const WALL_W = 48;
const WALL_H = 40;

type Theme = { wall: string; wall2: string; key: string; fill: string; ground: string };

/* ── card geometry: bevelled body + UV-mapped flat faces ── */
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
function faceGeo(): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(roundedRectShape(CARD_W, CARD_H, CARD_R), 28);
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + CARD_W / 2) / CARD_W;
    uv[i * 2 + 1] = (pos.getY(i) + CARD_H / 2) / CARD_H;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}
function buildGeo() {
  const shape = roundedRectShape(CARD_W, CARD_H, CARD_R);
  const body = new THREE.ExtrudeGeometry(shape, {
    depth: CARD_D - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 28,
  });
  body.computeBoundingBox();
  const bb = body.boundingBox!;
  body.translate(0, 0, -(bb.min.z + bb.max.z) / 2);
  body.computeVertexNormals();
  return { body, face: faceGeo() };
}

// procedural PAPER NORMAL MAP — fibre tooth that reacts to the raking light.
function makePaperNormalMap(): THREE.CanvasTexture {
  const n = 512;
  let s = 9241;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = rnd();
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) sum += h[((y + dy + n) % n) * n + ((x + dx + n) % n)];
        out[y * n + x] = sum / 9;
      }
    h = out;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] += Math.sin(y * 0.6) * 0.05;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const strength = 2.0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const hl = h[y * n + ((x - 1 + n) % n)];
      const hr = h[y * n + ((x + 1) % n)];
      const hu = h[((y - 1 + n) % n) * n + x];
      const hd = h[((y + 1 + n) % n) * n + x];
      const dx = (hl - hr) * strength;
      const dy = (hu - hd) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      img.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// studio backdrop — a soft radial vignette so the card sits in light, not on a flat slab.
function makeWall(center: string, edge: string): THREE.CanvasTexture {
  const S = 1024;
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

// "window-shaft" gobo — warm sunlight raking through tall gaps; a soft, natural cookie for the
// drifting shaft light (one motivated source). Seeded ⇒ deterministic.
const GOBO_ANGLE = 0.52;
function makeGobo(): THREE.CanvasTexture {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  x.fillStyle = "#070708";
  x.fillRect(0, 0, S, S);
  let seed = 0x77a13b;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const shard = (cx: number, cy: number, w: number, h: number, b: number) => {
    x.save();
    x.translate(cx, cy);
    x.scale(1, h / w);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, w);
    g.addColorStop(0, `rgba(255,255,255,${b})`);
    g.addColorStop(0.62, `rgba(255,255,255,${b})`);
    g.addColorStop(0.86, `rgba(255,255,255,${b * 0.28})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, w, 0, Math.PI * 2);
    x.fill();
    x.restore();
  };
  x.save();
  x.translate(S / 2, S / 2);
  x.rotate(GOBO_ANGLE);
  x.translate(-S / 2, -S / 2);
  for (let lx = -S * 0.3; lx < S * 1.3; ) {
    const laneW = S * (0.04 + rnd() * 0.06);
    const bright = 0.7 + rnd() * 0.3;
    for (let ly = -S * 0.3; ly < S * 1.3; ) {
      if (rnd() > 0.12) {
        const segH = laneW * (5 + rnd() * 9);
        shard(lx + (rnd() - 0.5) * laneW * 0.6, ly + segH / 2, laneW, segH, bright * (0.62 + rnd() * 0.38));
        ly += segH * (0.85 + rnd() * 0.4);
      } else {
        ly += laneW * (1.5 + rnd() * 2);
      }
    }
    lx += laneW + S * (0.07 + rnd() * 0.07);
  }
  x.restore();
  for (let i = 0; i < 4; i++) {
    const sx = rnd() * S;
    const sy = rnd() * S;
    const rr = S * (0.1 + rnd() * 0.12);
    const g = x.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, `rgba(7,7,8,${0.3 + rnd() * 0.3})`);
    g.addColorStop(1, "rgba(7,7,8,0)");
    x.fillStyle = g;
    x.beginPath();
    x.arc(sx, sy, rr, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// rasterise a (self-contained) SVG string to a CanvasTexture; updates in place on change
function useSvgTexture(svg: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    if (!svg) return;
    let alive = true;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      if (!alive) {
        URL.revokeObjectURL(url);
        return;
      }
      const w = img.naturalWidth || 1080;
      const h = img.naturalHeight || 648;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      setTex((prev) => {
        if (prev) {
          prev.image = canvas;
          prev.needsUpdate = true;
          return prev;
        }
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        return t;
      });
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [svg]);
  return tex;
}

// auto-fit the framed card (FRAME × the card) into the viewport
function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vfov = (camera.fov * Math.PI) / 180;
    const halfH = (CARD_H / 2) * FRAME_H;
    const halfW = (CARD_W / 2) * FRAME_W;
    const need = Math.max(halfH, halfW / aspect);
    camera.position.set(0, 0, need / Math.tan(vfov / 2));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// frame-rate cap at maxFps (priority useFrame takes over rendering)
function RenderThrottle({ maxFps }: { maxFps: number }) {
  const acc = useRef(1 / maxFps);
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

// drifting warm "shaft" light carrying the gobo — the one animated light (sways like sun
// through a swaying canopy); additive, casts no shadow.
function ShaftLight({ gobo, color, intensity }: { gobo: THREE.Texture; color: string; intensity: number }) {
  const ref = useRef<THREE.SpotLight>(null);
  useFrame((s) => {
    const k = ref.current;
    if (!k) return;
    const t = s.clock.elapsedTime;
    k.position.set(
      6 + Math.sin(t * 0.16) * 0.8 + Math.sin(t * 0.41 + 1.3) * 0.3,
      8.5 + Math.cos(t * 0.12) * 0.5,
      4.5 + Math.sin(t * 0.23 + 2.1) * 0.3,
    );
  });
  return (
    <spotLight ref={ref} position={[6, 8.5, 4.5]} angle={0.95} penumbra={1} intensity={intensity} decay={0} distance={40} color={color} map={gobo} />
  );
}

const DAMP = 0.94;
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

function Card({ frontSvg, backSvg, reduced }: { frontSvg: string; backSvg: string; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const geo = useMemo(() => buildGeo(), []);
  const normal = useMemo(() => makePaperNormalMap(), []);
  const frontTex = useSvgTexture(frontSvg);
  const backTex = useSvgTexture(backSvg);

  const drag = useRef({ on: false, x: 0, y: 0, t: 0 });
  const omega = useRef(new THREE.Vector3());
  const dq = useRef(new THREE.Quaternion());
  const axis = useRef(new THREE.Vector3());

  useEffect(() => {
    const el = gl.domElement;
    const ROT = 0.01;
    const down = (e: PointerEvent) => {
      drag.current = { on: true, x: e.clientX, y: e.clientY, t: performance.now() };
      omega.current.set(0, 0, 0);
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.on || !group.current) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      const now = performance.now();
      const dt = Math.max(1, now - d.t) / 1000;
      const ay = dx * ROT;
      const ax = dy * ROT;
      dq.current.setFromAxisAngle(Y, ay);
      group.current.quaternion.premultiply(dq.current);
      dq.current.setFromAxisAngle(X, ax);
      group.current.quaternion.premultiply(dq.current);
      const ang = Math.hypot(ax, ay);
      if (ang > 1e-5) {
        axis.current.set(ax, ay, 0).normalize();
        omega.current.lerp(axis.current.multiplyScalar(ang / dt), 0.55);
      }
      drag.current = { on: true, x: e.clientX, y: e.clientY, t: now };
    };
    const up = (e: PointerEvent) => {
      drag.current.on = false;
      const MAX = 9;
      if (omega.current.length() > MAX) omega.current.setLength(MAX);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    if (drag.current.on) return;
    const sp = omega.current.length();
    if (sp > 1e-4) {
      axis.current.copy(omega.current).normalize();
      dq.current.setFromAxisAngle(axis.current, sp * dt);
      g.quaternion.premultiply(dq.current);
      omega.current.multiplyScalar(Math.pow(DAMP, dt * 60));
    }
    if (!reduced) {
      dq.current.setFromAxisAngle(Y, 0.2 * dt);
      g.quaternion.premultiply(dq.current);
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={geo.body} castShadow receiveShadow>
        <meshStandardMaterial color="#f4f3ef" roughness={0.88} metalness={0} normalMap={normal} normalScale={new THREE.Vector2(0.22, 0.22)} envMapIntensity={0.25} />
      </mesh>
      {frontTex && (
        <mesh geometry={geo.face} position={[0, 0, FACE_Z]} castShadow>
          <meshStandardMaterial map={frontTex} roughness={0.82} metalness={0} normalMap={normal} normalScale={new THREE.Vector2(0.1, 0.1)} envMapIntensity={0.08} toneMapped={false} />
        </mesh>
      )}
      {backTex && (
        <mesh geometry={geo.face} position={[0, 0, -FACE_Z]} rotation={[0, Math.PI, 0]} castShadow>
          <meshStandardMaterial map={backTex} roughness={0.82} metalness={0} normalMap={normal} normalScale={new THREE.Vector2(0.1, 0.1)} envMapIntensity={0.08} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

export default function CardScene({ frontSvg, backSvg }: { frontSvg: string; backSvg: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dark, setDark] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ctxKey, setCtxKey] = useState(0);

  useEffect(() => {
    const d = window.matchMedia("(prefers-color-scheme: dark)");
    const r = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sd = () => setDark(d.matches);
    const sr = () => setReduced(r.matches);
    sd();
    sr();
    d.addEventListener("change", sd);
    r.addEventListener("change", sr);
    return () => {
      d.removeEventListener("change", sd);
      r.removeEventListener("change", sr);
    };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // same studio theme as the /work badge — a deep, product-shot backdrop sweep + warm/cool tones
  const theme: Theme = dark
    ? { wall: "#2b2d35", wall2: "#191a20", key: "#fbfcff", fill: "#eef0f4", ground: "#191a20" }
    : { wall: "#dcd6cc", wall2: "#c7c1b6", key: "#fffaf7", fill: "#f4f5f7", ground: "#e8e4dd" };
  const gobo = useMemo(() => makeGobo(), []);
  const wallTex = useMemo(() => makeWall(theme.wall, theme.wall2), [theme.wall, theme.wall2]);

  return (
    <div ref={wrap} className={styles.stage}>
      <Canvas
        key={ctxKey}
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 0, 11], fov: 30 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        frameloop={visible ? "always" : "never"}
        style={{ width: "100%", height: "100%", touchAction: "none", cursor: "grab" }}
        onCreated={({ gl }) => {
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
          <planeGeometry args={[WALL_W, WALL_H]} />
          <meshStandardMaterial map={wallTex} roughness={0.97} metalness={0} />
        </mesh>
        {/* shadow-catcher just behind the card so its drop shadow reads without darkening the wall */}
        <mesh position={[0, 0, -1.2]} receiveShadow>
          <planeGeometry args={[20, 22]} />
          <shadowMaterial opacity={0.26} />
        </mesh>

        <ambientLight intensity={0.36} />
        <hemisphereLight intensity={0.3} color={theme.key} groundColor={theme.ground} />
        {/* KEY — clean studio softbox raking from the upper-side */}
        <spotLight
          position={[7.5, 8, 4.5]}
          angle={0.95}
          penumbra={1}
          intensity={3.2}
          decay={0}
          distance={40}
          color={theme.key}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0002}
          shadow-radius={12}
        />
        {/* drifting warm shafts (the only animated light) */}
        <ShaftLight gobo={gobo} color="#ffe6bf" intensity={dark ? 2.2 : 3.0} />
        {/* soft FILL from the opposite lower-side */}
        <spotLight position={[-6.5, 2.5, 6]} angle={0.95} penumbra={1} intensity={1.7} decay={0} color={theme.fill} />
        {/* two-tone RIM from behind so the edges separate from the wall */}
        <directionalLight position={[5, 6, -5]} intensity={dark ? 1.5 : 1.05} color={dark ? "#dde6ff" : "#e9f0ff"} />
        <directionalLight position={[-5.5, 4, -4.5]} intensity={dark ? 1.05 : 0.7} color={dark ? "#fff0df" : "#fff2e6"} />

        <Card frontSvg={frontSvg} backSvg={backSvg} reduced={reduced} />
      </Canvas>
    </div>
  );
}
