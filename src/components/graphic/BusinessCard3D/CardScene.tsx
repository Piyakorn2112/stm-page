"use client";

/**
 * CardScene — a freestanding, double-sided matte-paper business card in 3D.
 *
 * Unlike the lanyard badge this has NO rope physics: it's a paper card you grab and
 * spin. A lightweight custom trackball gives it real inertia — drag to spin, release
 * to let momentum carry and decay, and at rest it drifts in a slow idle rotation
 * (suppressed under prefers-reduced-motion). Both faces are textured from the card's
 * own SVG (rasterised to a CanvasTexture); the stock is a high-roughness paper with a
 * faint fibre bump and almost no specular, lit by a soft studio key/fill/rim.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import styles from "./styles.module.css";

// world-space card — 90×54mm proportion, paper-thin, a *small* corner radius
const ASPECT = 90 / 54;
const CARD_W = 3.6;
const CARD_H = CARD_W / ASPECT; // 2.16
const CARD_D = 0.011; // paper-thin (even thinner)
const CARD_R = 0.033; // very small radius (a paper card, barely rounded)
const BEVEL = 0.0022;
const FACE_Z = CARD_D / 2 + 0.0011;

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
    uv[i * 2 + 1] = (pos.getY(i) + CARD_H / 2) / CARD_H; // CanvasTexture flipY handles top-down
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
    bevelSegments: 2,
    curveSegments: 24,
  });
  body.computeBoundingBox();
  const bb = body.boundingBox!;
  body.translate(0, 0, -(bb.min.z + bb.max.z) / 2);
  body.computeVertexNormals();
  return { body, face: faceGeo() };
}

// procedural PAPER NORMAL MAP (the Blender approach: build a fibre height-field, then
// derive per-texel normals from its gradient and pack xyz→rgb). Gives real matte paper
// tooth that reacts directionally to light — unlike a flat grey bump map.
function makePaperNormalMap(): THREE.CanvasTexture {
  const n = 512;
  let s = 9241;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  // 1) height field: fine grain + a faint directional fibre (paper grain direction)
  let h = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) h[i] = rnd();
  // a couple of light box-blurs soften pure noise into a paper tooth
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) sum += h[((y + dy + n) % n) * n + ((x + dx + n) % n)];
        out[y * n + x] = sum / 9;
      }
    }
    h = out;
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) h[y * n + x] += Math.sin(y * 0.6) * 0.05; // faint fibre streaks

  // 2) normals from the height gradient → RGB
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const strength = 2.2;
  for (let y = 0; y < n; y++) {
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
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  t.colorSpace = THREE.NoColorSpace; // normal data is linear, not sRGB
  return t;
}

const BODY_NS = new THREE.Vector2(0.28, 0.28);
const FACE_NS = new THREE.Vector2(0.12, 0.12);

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
          // same texture object, new image → three repaints via needsUpdate (no re-render)
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

const DAMP = 0.94; // momentum retention per 1/60s
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

  // pointer trackball on the canvas element
  useEffect(() => {
    const el = gl.domElement;
    const ROT = 0.01; // rad per px
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
    // momentum
    const sp = omega.current.length();
    if (sp > 1e-4) {
      axis.current.copy(omega.current).normalize();
      dq.current.setFromAxisAngle(axis.current, sp * dt);
      g.quaternion.premultiply(dq.current);
      omega.current.multiplyScalar(Math.pow(DAMP, dt * 60));
    }
    // gentle idle auto-spin about Y (suppressed for reduced motion)
    if (!reduced) {
      dq.current.setFromAxisAngle(Y, 0.22 * dt);
      g.quaternion.premultiply(dq.current);
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={geo.body}>
        <meshStandardMaterial
          color="#f6f5f1"
          roughness={0.9}
          metalness={0}
          normalMap={normal}
          normalScale={BODY_NS}
          envMapIntensity={0.18}
        />
      </mesh>
      {frontTex && (
        <mesh geometry={geo.face} position={[0, 0, FACE_Z]}>
          <meshStandardMaterial map={frontTex} roughness={0.8} metalness={0} normalMap={normal} normalScale={FACE_NS} envMapIntensity={0.1} />
        </mesh>
      )}
      {backTex && (
        <mesh geometry={geo.face} position={[0, 0, -FACE_Z]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial map={backTex} roughness={0.8} metalness={0} normalMap={normal} normalScale={FACE_NS} envMapIntensity={0.1} />
        </mesh>
      )}
    </group>
  );
}

function Lights({ dark }: { dark: boolean }) {
  return (
    <>
      <ambientLight intensity={dark ? 0.95 : 1.1} />
      <hemisphereLight intensity={0.55} color={dark ? "#cfd6ff" : "#ffffff"} groundColor={dark ? "#15171e" : "#e7e7ec"} />
      <spotLight position={[4.5, 6, 6]} angle={0.85} penumbra={1} intensity={dark ? 4.2 : 3.6} decay={0} color="#fff7ee" />
      <directionalLight position={[-5, 1.5, 4]} intensity={dark ? 1.15 : 1.0} color="#eef2ff" />
      <directionalLight position={[0, 2.5, -5]} intensity={dark ? 1.9 : 1.35} color={dark ? "#aab6ff" : "#ffffff"} />
      {/* head-on fill so the face that's toward the camera reads bright */}
      <directionalLight position={[0, 0.5, 8]} intensity={dark ? 0.85 : 0.7} color="#ffffff" />
    </>
  );
}

export default function CardScene({ frontSvg, backSvg }: { frontSvg: string; backSvg: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dark, setDark] = useState(false);
  const [reduced, setReduced] = useState(false);

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

  return (
    <div ref={wrap} className={styles.stage}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 30 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        frameloop={visible ? "always" : "never"}
        style={{ touchAction: "none", cursor: "grab" }}
      >
        <Lights dark={dark} />
        <Card frontSvg={frontSvg} backSvg={backSvg} reduced={reduced} />
      </Canvas>
    </div>
  );
}
