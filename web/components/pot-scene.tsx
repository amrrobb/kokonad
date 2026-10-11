"use client";

/**
 * The host's pot, in 3D: a coconut bowl that coins drop into as plays are charged. Host screens only
 * (DESIGN.md §4): this file pulls in three.js and gsap, so it is loaded on demand and never on a phone.
 *
 * It is a picture of one number, `coins`, which the caller reads from the chain and prints beside it.
 * No WebGL, or a person who asked for less motion: the caller's flat bowl is shown instead / the bowl
 * holds still. Nothing is fetched: geometry and colours only, no textures, models or fonts.
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";
import { PotBowl } from "./pot";

/** More coins than this are not drawn; the printed figure carries the real amount. */
const MAX_COINS = 36; // = sum of LAYERS
const R = 1.5; // bowl radius at the rim
const H = 1.05; // bowl depth

/** Coins per layer, bottom up: the bowl widens, so each layer holds more. Their sum is MAX_COINS. */
const LAYERS = [4, 6, 8, 8, 10];

/** Where coin `i` comes to rest: rings that alternate near the middle and near the shell, layer on layer. */
function restingPlace(i: number): { pos: THREE.Vector3; tilt: THREE.Euler } {
  let layer = 0;
  let k = i;
  while (layer < LAYERS.length - 1 && k >= LAYERS[layer]!) k -= LAYERS[layer++]!;
  const cap = LAYERS[layer]!;
  const rnd = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const y = -H + 0.2 + layer * 0.11 + rnd(0) * 0.02;
  const inside = Math.max(0.1, R * Math.sqrt(Math.max(0, 1 - (y / H) ** 2)) - 0.32);
  const radius = inside * (k % 2 === 0 ? 0.9 : 0.36);
  const angle = (k / cap) * Math.PI * 2 + layer * 0.9;
  return {
    pos: new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius),
    tilt: new THREE.Euler((rnd(3) - 0.5) * 0.45, rnd(4) * Math.PI, (rnd(5) - 0.5) * 0.45),
  };
}

interface Stage {
  setCoins: (n: number) => void;
  dispose: () => void;
}

function build(host: HTMLDivElement, still: boolean): Stage | null {
  const canvas = document.createElement("canvas");
  // Ask for the context ourselves: a failed attempt returns null quietly, where three.js would log an error.
  const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
  if (!context) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  canvas.style.cssText = "display:block;width:100%;height:100%";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, 3.0, 4.9);
  camera.lookAt(0, -0.42, 0);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xd9a983, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(2.5, 5, 3.5);
  scene.add(sun);

  const pot = new THREE.Group();
  scene.add(pot);
  const made: Array<THREE.BufferGeometry | THREE.Material> = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => (made.push(x), x);

  // The shell: a quarter-ellipse spun around the axis. Brown outside, coconut-white inside, a pale rim.
  const profile = Array.from({ length: 25 }, (_, k) => {
    const a = (k / 24) * (Math.PI / 2);
    return new THREE.Vector2(Math.sin(a) * R, -Math.cos(a) * H);
  });
  const shell = keep(new THREE.LatheGeometry(profile, 64));
  pot.add(new THREE.Mesh(shell, keep(new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.9 }))));
  const flesh = new THREE.Mesh(shell, keep(new THREE.MeshStandardMaterial({ color: 0xfff3e3, roughness: 0.75, side: THREE.BackSide })));
  flesh.scale.setScalar(0.955);
  pot.add(flesh);
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(R * 0.978, 0.045, 12, 72)), keep(new THREE.MeshStandardMaterial({ color: 0xf3dcc3, roughness: 0.8 })));
  rim.rotation.x = Math.PI / 2;
  pot.add(rim);
  const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(R * 0.95, 48)), keep(new THREE.MeshBasicMaterial({ color: 0x3b1f14, transparent: true, opacity: 0.09 })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H - 0.02;
  scene.add(shadow);

  const coinShape = keep(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 32));
  const gold = keep(new THREE.MeshStandardMaterial({ color: 0xf2b72b, roughness: 0.34, metalness: 0.25, emissive: 0x7a4a00, emissiveIntensity: 0.18 }));
  const coins: THREE.Mesh[] = [];

  let width = 0;
  let height = 0;
  let ratio = 0;
  let dirty = true;
  const fit = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === 0 || h === 0 || (w === width && h === height && dpr === ratio)) return;
    width = w;
    height = h;
    ratio = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const resize = new ResizeObserver(fit);
  resize.observe(host);

  // One clock for the tweens and the picture. Draws only when something moved (or the bowl is turning),
  // and re-checks the pixel ratio each frame: a window dragged to another screen fires no resize.
  const frame = (_time: number, deltaMs: number) => {
    fit();
    if (!still) {
      pot.rotation.y += (deltaMs / 1000) * 0.22;
      dirty = true;
    }
    if (dirty || coins.some((c) => gsap.isTweening(c.position))) {
      dirty = false;
      renderer.render(scene, camera);
    }
  };
  let running = false;
  let seen = true;
  const sync = () => {
    const want = seen && !document.hidden;
    if (want === running) return;
    running = want;
    if (want) gsap.ticker.add(frame);
    else gsap.ticker.remove(frame);
  };
  const watch = new IntersectionObserver(([entry]) => {
    seen = !!entry?.isIntersecting;
    sync();
  });
  watch.observe(host);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    setCoins(n) {
      const want = Math.max(0, Math.min(MAX_COINS, Math.floor(n)));
      while (coins.length > want) {
        const coin = coins.pop()!;
        gsap.killTweensOf([coin.position, coin.scale]);
        pot.remove(coin);
      }
      const from = coins.length;
      for (let i = from; i < want; i++) {
        const { pos, tilt } = restingPlace(i);
        const coin = new THREE.Mesh(coinShape, gold);
        coin.rotation.copy(tilt);
        coin.position.copy(pos);
        pot.add(coin);
        coins.push(coin);
        if (still) continue;
        // Falls in from above the rim, lands with a small bounce; a batch arrives as a patter, not a clap.
        const delay = (i - from) * 0.07;
        gsap.from(coin.position, { y: pos.y + 3.4, duration: 0.75, ease: "bounce.out", delay });
        gsap.from(coin.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.12, delay });
      }
      dirty = true;
      if (still) renderer.render(scene, camera);
    },
    dispose() {
      gsap.ticker.remove(frame);
      document.removeEventListener("visibilitychange", sync);
      watch.disconnect();
      resize.disconnect();
      for (const coin of coins) gsap.killTweensOf([coin.position, coin.scale]);
      for (const x of made) x.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

export default function PotScene({ coins }: { coins: number }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const built = build(host.current, still);
    if (!built) {
      setFlat(true);
      return;
    }
    stage.current = built;
    return () => {
      stage.current = null;
      built.dispose();
    };
  }, []);

  // Declared after the effect that builds the stage, so on mount it runs second and finds it ready.
  useEffect(() => {
    stage.current?.setCoins(coins);
  }, [coins]);

  return (
    <div ref={host} className="grid h-full w-full place-items-center" aria-hidden="true" data-testid="pot-scene" data-coins={Math.min(MAX_COINS, Math.max(0, Math.floor(coins)))} data-mode={flat ? "flat" : "3d"}>
      {flat && <PotBowl coins={coins} width={150} />}
    </div>
  );
}
