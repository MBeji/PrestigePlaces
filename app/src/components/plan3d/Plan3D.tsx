"use client";

/**
 * Rendu Three.js de la vue 3D (chargé par next/dynamic avec ssr: false, voir View3D) : niveaux empilés,
 * décor (dalles, murs, salles, bureaux, zone à libérer translucide), positions en un seul InstancedMesh coloré
 * par instance, étiquettes HTML projetées, orbite souris / doigt, zoom molette / pincement, clavier.
 * Toute la logique de données vient de model3d.ts ; ce composant ne fait que dessiner.
 * Les ressources WebGL (géométries, matériaux, rendu) sont libérées au démontage et à chaque reconstruction.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import * as THREE from "three";
import { directionColor, type DirectionStyle, type FloorPlanData, type PlanView } from "@/components/plan/model";
import {
  ALL_FLOORS, cameraDistance, clampLabel, DEFAULT_ORBIT, DIM_AMOUNT, RADIUS_ALL, RADIUS_FLOOR,
  buildSeatInstances, describeSeat, directionCssVar, floorDecor, floorElevation, gridBounds, isLabelShown, islandNumbers,
  labelAnchors, orbitPosition, orbitTarget, projectToScreen, rotateOrbit, visibleFloorCodes, zoomOrbit,
  type DecorKind, type Focus, type LabelAnchor, type Orbit, type SeatInstance,
} from "./model3d";
import styles from "./Plan3D.module.css";

export interface Plan3DProps {
  floors: FloorPlanData[];
  directions: DirectionStyle[];
  view: PlanView;
  focus: Focus;
  onFocusChange: (focus: Focus) => void;
  scenarioId: string;
}

/** Objets Three.js vivants, hors du cycle de rendu React. */
interface Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  seats: THREE.InstancedMesh | null;
  seatIndex: SeatInstance[];
  anchors: LabelAnchor[];
  labelEls: HTMLElement[];
  orbit: Orbit;
  target: THREE.Vector3;
  frame: number;
  /** Options lues à chaque image (étiquettes, focus). */
  labels: boolean;
  focus: Focus;
  invalidate: () => void;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Thème courant (préférence système + attribut data-theme), pour repeindre la scène au changement. */
function subscribeTheme(onChange: () => void): () => void {
  const mq = window.matchMedia?.(DARK_QUERY);
  mq?.addEventListener?.("change", onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq?.removeEventListener?.("change", onChange);
    mo.disconnect();
  };
}
const themeSnapshot = () => `${document.documentElement.dataset.theme ?? ""}|${window.matchMedia?.(DARK_QUERY).matches ?? false}`;
const themeServerSnapshot = () => "";

function cssVar(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}
/**
 * Mélange de deux couleurs dans l'espace sRGB (comme l'opacité 0,25 du plan 2D et le prototype r128, sans gestion
 * des couleurs). Three.js stocke les couleurs en linéaire : un mélange direct y laisse les positions atténuées trop
 * vives sur le fond sombre.
 */
function mixSrgb(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color): THREE.Color {
  const x = a.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const y = b.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  return out.setRGB(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t, THREE.SRGBColorSpace);
}

function toColor(css: string): THREE.Color {
  const c = new THREE.Color();
  try {
    c.setStyle(css);
  } catch {
    c.set(0x888888);
  }
  return c;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
    if (n instanceof THREE.InstancedMesh) n.dispose();
  });
}

const DECOR: Record<DecorKind, { css: string; fallback: string; h: number; opacity?: number }> = {
  wall: { css: "--wall", fallback: "#b8bec8", h: 0.35, opacity: 0.55 },
  room: { css: "--room", fallback: "#dfe9d9", h: 0.12 },
  office: { css: "--office", fallback: "#f5dcc8", h: 0.12 },
  desk: { css: "--desk", fallback: "#f3e3b3", h: 0.3 },
  training: { css: "--fg-2", fallback: "#5a6170", h: 0.1, opacity: 0.25 },
};

export default function Plan3D({ floors, directions, view, focus, onFocusChange, scenarioId }: Plan3DProps) {
  const [webgl] = useState(supportsWebGL);
  const [failed, setFailed] = useState(false);
  const [exploded, setExploded] = useState(true);
  const [labels, setLabels] = useState(true);
  const [hover, setHover] = useState<SeatInstance | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, themeServerSnapshot);

  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const bounds = useMemo(() => gridBounds(floors), [floors]);
  const islands = useMemo(() => islandNumbers(floors), [floors]);

  // Initialisation : rendu, scène, caméra, lumières, interactions. Nettoyage complet au démontage.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webgl) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
    // Intensités du prototype (r128, éclairage hérité) × π pour l'éclairage physique des versions récentes.
    scene.add(new THREE.AmbientLight(0xffffff, 0.7 * Math.PI));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75 * Math.PI);
    sun.position.set(40, 90, 50);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25 * Math.PI);
    fill.position.set(-50, 30, -40);
    scene.add(fill);
    const root = new THREE.Group();
    scene.add(root);

    const vp = new THREE.Matrix4();
    const engine: Engine = {
      renderer, scene, camera, root, seats: null, seatIndex: [], anchors: [], labelEls: [],
      orbit: { ...DEFAULT_ORBIT }, target: new THREE.Vector3(), frame: 0, labels: true, focus: ALL_FLOORS,
      invalidate: () => {
        if (!engine.frame) engine.frame = requestAnimationFrame(draw);
      },
    };
    engineRef.current = engine;

    function placeLabels() {
      const w = host!.clientWidth, h = host!.clientHeight;
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const state = { labels: engine.labels, focus: engine.focus, radius: engine.orbit.radius };
      engine.anchors.forEach((a, i) => {
        const el = engine.labelEls[i];
        if (!el) return;
        if (!isLabelShown(a, state)) {
          el.style.display = "none";
          return;
        }
        const p = projectToScreen(a, vp.elements, w, h);
        if (!p.visible) {
          el.style.display = "none";
          return;
        }
        el.style.display = "";
        // Bornée au cadre : l'étiquette du niveau le plus haut ne sort plus par le haut de la scène.
        const c = clampLabel(p.left, p.top, el.offsetWidth, el.offsetHeight, w, h);
        el.style.left = `${c.left}px`;
        el.style.top = `${c.top}px`;
      });
    }
    function draw() {
      engine.frame = 0;
      const pos = orbitPosition(engine.target, { ...engine.orbit, radius: cameraDistance(engine.orbit.radius, camera.aspect) });
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(engine.target);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      placeLabels();
    }
    function resize() {
      const w = Math.max(1, host!.clientWidth), h = Math.max(1, host!.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      engine.invalidate();
    }

    // Survol et sélection : lancer de rayon sur le maillage instancié.
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pick(e: PointerEvent | MouseEvent) {
      if (!engine.seats) return;
      const rect = canvas.getBoundingClientRect();
      mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(engine.seats)[0];
      if (!hit || hit.instanceId === undefined) return;
      const s = engine.seatIndex[hit.instanceId];
      if (s) setHover((prev) => (prev?.id === s.id ? prev : s));
    }

    // Orbite : un doigt / la souris tourne, deux doigts pincent pour zoomer.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const dist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinch = dist();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* capture indisponible : sans conséquence */
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        if (e.pointerType === "mouse") pick(e);
        return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const d = dist();
        if (pinch > 0 && d > 0) engine.orbit = zoomOrbit(engine.orbit, pinch / d);
        pinch = d;
      } else {
        engine.orbit = rotateOrbit(engine.orbit, dx, dy);
      }
      engine.invalidate();
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    const onClick = (e: MouseEvent) => {
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) return; // fin d'un glissement
      pick(e);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      engine.orbit = zoomOrbit(engine.orbit, e.deltaY > 0 ? 1.1 : 0.9);
      engine.invalidate();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      if (engine.frame) cancelAnimationFrame(engine.frame);
      engine.frame = 0;
      disposeTree(root);
      root.clear();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      engine.labelEls.forEach((el) => el.remove());
      engineRef.current = null;
    };
  }, [webgl]);

  // Construction de la scène : niveaux visibles, décor, positions, ancres d'étiquettes.
  useEffect(() => {
    const engine = engineRef.current;
    const box = labelsRef.current;
    if (!engine || !box) return;
    const { root } = engine;
    disposeTree(root);
    root.clear();

    const vis = new Set(visibleFloorCodes(floors, focus));
    const lambert = (css: string) => new THREE.MeshLambertMaterial({ color: toColor(css) });
    const dummy = new THREE.Object3D();
    const flat = (cells: { x: number; z: number }[], css: string, y: number, h: number, opacity?: number) => {
      if (!cells.length) return null;
      const mat = lambert(css);
      if (opacity !== undefined) {
        mat.transparent = true;
        mat.opacity = opacity;
        mat.depthWrite = false;
      }
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, h, 1), mat, cells.length);
      cells.forEach((c, i) => {
        dummy.position.set(c.x + 0.5, y + h / 2, c.z + 0.5);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.computeBoundingSphere();
      return m;
    };

    floors.forEach((f, index) => {
      if (!vis.has(f.code)) return;
      const g = new THREE.Group();
      const y0 = floorElevation(index, exploded);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(bounds.nc + 1, 0.5, bounds.nr + 1), lambert(cssVar("--surface", "#ffffff")));
      slab.position.set(bounds.nc / 2, y0 - 0.25, bounds.nr / 2);
      g.add(slab);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(bounds.nc + 1.2, 0.08, bounds.nr + 1.2), lambert(cssVar("--line", "#d7dbe2")));
      edge.position.set(bounds.nc / 2, y0 - 0.5, bounds.nr / 2);
      g.add(edge);
      const decor = floorDecor(f, bounds);
      for (const kind of ["wall", "room", "office", "desk", "training"] as const) {
        const d = DECOR[kind];
        const m = flat(decor[kind], cssVar(d.css, d.fallback), y0, d.h, d.opacity);
        if (m) g.add(m);
      }
      root.add(g);
    });

    // Positions : un seul InstancedMesh, couleur par instance.
    const seats = buildSeatInstances(floors, { view, focus, exploded, bounds, islands });
    engine.seatIndex = seats;
    const geo = new THREE.BoxGeometry(0.78, 1, 0.78);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(seats.length, 1));
    mesh.count = seats.length;
    const dim = toColor(cssVar("--surface-2", "#eceef2"));
    const palette = new Map<string, THREE.Color>();
    const colorOf = (code: string) => {
      let c = palette.get(code);
      if (!c) {
        const fallback = directionColor(code, directions);
        c = toColor(cssVar(directionCssVar(code), fallback.startsWith("#") ? fallback : "#c3c2b7"));
        palette.set(code, c);
      }
      return c;
    };
    const col = new THREE.Color();
    seats.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(1, s.height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (s.dim) mixSrgb(colorOf(s.shown), dim, DIM_AMOUNT, col);
      else col.copy(colorOf(s.shown));
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
    engine.seats = mesh;

    // Étiquettes HTML : reconstruites, puis placées à chaque image.
    engine.anchors = labelAnchors(floors, { view, focus, exploded, bounds, islands });
    engine.labelEls.forEach((el) => el.remove());
    engine.labelEls = engine.anchors.map((a) => {
      const el = document.createElement("div");
      el.className = `${styles.lbl} ${a.kind === "floor" ? styles.lblFloor : a.kind === "zone" ? styles.lblZone : ""}`;
      el.style.display = "none";
      if (a.kind === "island") {
        el.title = a.title;
        a.counts.forEach(({ code, n }, i) => {
          if (i) el.append(" ");
          const sw = document.createElement("span");
          sw.className = styles.sw;
          sw.style.background = `var(${directionCssVar(code)}, ${directionColor(code, directions)})`;
          el.append(sw, String(n));
        });
      } else {
        el.textContent = a.text;
      }
      box.append(el);
      return el;
    });

    const t = orbitTarget(floors, focus, exploded, bounds);
    engine.target.set(t.x, t.y, t.z);
    engine.focus = focus;
    engine.invalidate();
  }, [floors, directions, view, focus, exploded, bounds, islands, theme]);

  // Étiquettes affichées ou masquées : simple replacement, sans reconstruction.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.labels = labels;
    engine.invalidate();
  }, [labels]);

  function chooseFocus(f: Focus) {
    const engine = engineRef.current;
    if (engine) engine.orbit = { ...engine.orbit, radius: f === ALL_FLOORS ? RADIUS_ALL : RADIUS_FLOOR };
    onFocusChange(f);
  }
  function recenter() {
    const engine = engineRef.current;
    if (!engine) return;
    engine.orbit = { ...DEFAULT_ORBIT, radius: focus === ALL_FLOORS ? RADIUS_ALL : RADIUS_FLOOR };
    engine.invalidate();
  }
  function onSceneKey(e: KeyboardEvent<HTMLDivElement>) {
    const engine = engineRef.current;
    if (!engine) return;
    const step = 24;
    const next =
      e.key === "ArrowLeft" ? rotateOrbit(engine.orbit, -step, 0)
      : e.key === "ArrowRight" ? rotateOrbit(engine.orbit, step, 0)
      : e.key === "ArrowUp" ? rotateOrbit(engine.orbit, 0, -step)
      : e.key === "ArrowDown" ? rotateOrbit(engine.orbit, 0, step)
      : e.key === "+" || e.key === "=" ? zoomOrbit(engine.orbit, 0.9)
      : e.key === "-" || e.key === "_" ? zoomOrbit(engine.orbit, 1.1)
      : null;
    if (!next) return;
    e.preventDefault();
    engine.orbit = next;
    engine.invalidate();
  }

  const focusOptions: { code: Focus; label: string }[] = [{ code: ALL_FLOORS, label: "Tous les niveaux" }, ...floors.map((f) => ({ code: f.code, label: f.label }))];
  const unavailable = !webgl || failed;

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Niveau affiché">
          {focusOptions.map((o) => (
            <button key={o.code} type="button" className={styles.tab} aria-pressed={focus === o.code} onClick={() => chooseFocus(o.code)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className={styles.seg} role="group" aria-label="Affichage 3D">
          <button type="button" aria-pressed={exploded} onClick={() => setExploded((v) => !v)} disabled={unavailable}>Vue éclatée</button>
          <button type="button" aria-pressed={labels} onClick={() => setLabels((v) => !v)} disabled={unavailable}>Étiquettes</button>
          <button type="button" onClick={recenter} disabled={unavailable}>Recentrer</button>
        </div>
      </div>
      <div
        ref={hostRef}
        className={styles.scene}
        role="img"
        tabIndex={unavailable ? undefined : 0}
        aria-label={`Vue 3D du site, ${focus === ALL_FLOORS ? "tous les niveaux" : (floors.find((f) => f.code === focus)?.label ?? focus)}. Flèches pour tourner, plus et moins pour zoomer.`}
        onKeyDown={onSceneKey}
      >
        <div ref={labelsRef} className={styles.labels} aria-hidden="true" />
        {unavailable ? <p className={styles.fallback}>Vue 3D indisponible : WebGL n’est pas activé dans ce navigateur. Les tableaux ci-contre restent à jour.</p> : null}
      </div>
      <p className={styles.info} aria-live="polite">
        {hover ? (
          <>
            {describeSeat(hover, directions)}{" "}
            <Link href={`/plans?scenario=${encodeURIComponent(scenarioId)}&niveau=${encodeURIComponent(hover.floor)}&vue=${view}`}>Voir sur le plan</Link>
          </>
        ) : (
          "Survolez ou touchez une position pour voir son détail."
        )}
      </p>
    </div>
  );
}
