import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GradedPad } from './fieldTerrain';
import { createMeshKit } from './meshKit';

/**
 * FIELD DEVELOPMENT — the wider producing oilfield seen around the work lease
 * (“في مرمى البصر”): pump-jack, PCP and ESP well patterns laid out on regular
 * well spacing, satellite tank batteries, a central processing / stabilisation
 * station (columns, spheres, heater, fin-fan coolers, flare), crude storage
 * tanks, an elevated pipe rack and ground flowlines tying everything together.
 *
 * Everything static is merged into ONE mesh per material (a handful of draw
 * calls for hundreds of parts); only the moving parts (pump-jack beams/cranks,
 * PCP drive heads, flare flame, aviation/night lamps) stay separate.
 */

type XZ = { x: number; z: number };

// ---------------------------------------------------------------------------
// Layout (world metres). The work lease is centred near the origin (pad
// X −45..45, Z ±26, lease road heading −X along Z ≈ 7..17).
// ---------------------------------------------------------------------------

/** Regular well pattern helper: rows × cols on a fixed spacing. */
function grid(x0: number, z0: number, cols: number, rows: number, dx: number, dz: number): XZ[] {
  const out: XZ[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * dx, z: z0 + r * dz });
  return out;
}

/** NE beam-pump pattern (pump jacks, all beams on the same E–W azimuth). */
export const FAR_PUMPJACK_WELLS: XZ[] = grid(105, 52, 3, 2, 42, 40);
/** SW progressive-cavity-pump pattern. */
export const PCP_WELLS: XZ[] = grid(-175, -70, 3, 2, 42, -40);
/** NW electric-submersible-pump pattern (along a power line). */
export const ESP_WELLS: XZ[] = grid(-170, 70, 3, 2, 42, 40);

/** Satellite tank batteries, each gathering one well pattern. */
export const SAT_BATTERIES: Array<XZ & { count: number; r: number; h: number }> = [
  { x: 150, z: 8, count: 4, r: 2.4, h: 7 },     // NE pump-jack field
  { x: -140, z: -142, count: 3, r: 2.4, h: 7 }, // SW PCP field
  { x: -130, z: 40, count: 3, r: 2.2, h: 6.5 }, // NW ESP field (just N of the lease road)
];

/** Central processing / stabilisation station. */
export const STATION = { x: 150, z: -118, w: 64, d: 42 };
/** Large crude export storage (floating-roof tanks) next to the station. */
export const CRUDE_STORAGE = { x: 92, z: -160, count: 3, r: 9, h: 11, spacing: 22 };

/** Graded (level) pads for every far facility — fed into the terrain sampler. */
export const FIELD_PADS: GradedPad[] = [
  ...[...FAR_PUMPJACK_WELLS, ...PCP_WELLS, ...ESP_WELLS].map(
    (w): GradedPad => ({ kind: 'circle', x: w.x, z: w.z, radius: 7, blend: 16 }),
  ),
  ...SAT_BATTERIES.map((b): GradedPad => {
    const len = (b.count - 1) * (b.r * 2 + 1.4);
    return { kind: 'rect', minX: b.x - b.r - 8, maxX: b.x + len + b.r + 8, minZ: b.z - 9, maxZ: b.z + 9, blend: 22 };
  }),
  {
    kind: 'rect',
    minX: STATION.x - STATION.w / 2 - 6, maxX: STATION.x + STATION.w / 2 + 14,
    minZ: STATION.z - STATION.d / 2 - 6, maxZ: STATION.z + STATION.d / 2 + 6, blend: 40,
  },
  {
    kind: 'rect',
    minX: CRUDE_STORAGE.x - CRUDE_STORAGE.r - 6,
    maxX: CRUDE_STORAGE.x + (CRUDE_STORAGE.count - 1) * CRUDE_STORAGE.spacing + CRUDE_STORAGE.r + 6,
    minZ: CRUDE_STORAGE.z - CRUDE_STORAGE.r - 6, maxZ: CRUDE_STORAGE.z + CRUDE_STORAGE.r + 6, blend: 36,
  },
];

export interface FieldDevelopmentHandles {
  /** Animate pump jacks, PCP drives, flare and night lamps. `time` in seconds. */
  update(time: number, lightLevel: number): void;
  dispose(): void;
}

export interface FieldDevelopmentOptions {
  groundAt: (x: number, z: number) => number;
  /** Main-lease battery outlet — start of the export pipe rack to the plant. */
  leaseBattery: XZ;
  /** Main-lease battery inlet header (NW trunk line terminates here). */
  leaseInlet: XZ;
  /** Lease flowlines (XZ polylines) from the near pump jacks to the battery headers. */
  leaseFlowlines?: XZ[][];
}

// ---------------------------------------------------------------------------
// Static batcher: build with ordinary meshes inside `root`, then collapse them
// to one merged mesh per material.
// ---------------------------------------------------------------------------
function mergeStatic(root: THREE.Object3D, target: THREE.Object3D): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    // Keep only the attributes every primitive shares.
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    g.clearGroups();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    }
    const list = buckets.get(m.material) ?? [];
    list.push(g);
    buckets.set(m.material, list);
    m.geometry.dispose();
    g = null as unknown as THREE.BufferGeometry;
  });
  const out: THREE.Mesh[] = [];
  buckets.forEach((geos, material) => {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    target.add(mesh);
    out.push(mesh);
  });
  return out;
}

/** Soft round glow texture for night lamps / flare halo (additive sprites). */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function addFieldDevelopment(scene: THREE.Scene, opts: FieldDevelopmentOptions): FieldDevelopmentHandles {
  const { groundAt } = opts;
  const kit = createMeshKit();
  const { mat, box, cyl, strut } = kit;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // Shared materials (cached by the kit → one bucket each when merged).
  const concrete = mat(0x9ca3af, 0.95, 0.05);
  const gravel = mat(0x8a7d68, 1.0, 0.0);
  const berm = mat(0x7a6a4f, 0.98, 0.02);
  const dark = mat(0x1f2937, 0.6, 0.4);
  const steelGrey = mat(0x8b95a1, 0.45, 0.7);
  const tankWhite = mat(0xd9dde2, 0.7, 0.25);
  const tankGrey = mat(0x9aa3ad, 0.75, 0.3);
  const pipeBlack = mat(0x2f3540, 0.7, 0.5);
  const pipeYellow = mat(0xcaa21a, 0.6, 0.35);
  const rackSteel = mat(0x4b5563, 0.65, 0.5);
  const valveRed = mat(0xc81e1e, 0.5, 0.3);
  const guardYellow = mat(0xf2c200, 0.55, 0.3);
  const cabinetGrey = mat(0xb8bec6, 0.55, 0.4);
  const motorBlue = mat(0x2563eb, 0.5, 0.5);
  const wood = mat(0x5c4326, 0.95, 0.0);
  const brick = mat(0xcfc6b8, 0.9, 0.05);
  const columnWhite = mat(0xe5e7eb, 0.55, 0.35);
  const insulation = mat(0xb9c0c8, 0.4, 0.75);
  const pjPaints = [0xb45309, 0x1f6feb, 0x15803d, 0xb91c1c, 0xca8a04].map((c) => mat(c, 0.55, 0.45));
  // Lit windows: emissive driven by the night light level (kept un-merged).
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.2, emissive: 0xffd58a, emissiveIntensity: 0 });

  const stat = new THREE.Group(); // collapsed into merged meshes at the end
  const dyn = new THREE.Group();  // moving parts / lamps (kept live)
  dyn.name = 'FieldDevelopmentDynamic';
  const staticHolder = new THREE.Group();
  staticHolder.name = 'FieldDevelopmentStatic';

  /** A group placed on the ground at (x, z), turned `ry` about Y. */
  const site = (parent: THREE.Object3D, x: number, z: number, ry = 0, y = groundAt(x, z)) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  };

  // --- Night lamps (additive glow sprites, visible through the night fog) ----
  const glowTex = glowTexture();
  type Lamp = { sprite: THREE.Sprite; base: number; blink?: number; always?: boolean };
  const lamps: Lamp[] = [];
  const lampMats = new Map<number, THREE.SpriteMaterial>();
  const lamp = (x: number, y: number, z: number, color = 0xffe2a8, size = 3.2, blink?: number, always = false) => {
    let m = lampMats.get(color);
    if (!m) {
      m = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      lampMats.set(color, m);
    }
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    s.visible = always;
    dyn.add(s);
    lamps.push({ sprite: s, base: size, blink, always });
    return s;
  };

  // =========================================================================
  // WELLS
  // =========================================================================
  type Pump = { beam: THREE.Object3D; crank: THREE.Object3D; rate: number; phase: number };
  const pumps: Pump[] = [];
  const pcpDrives: Array<{ rotor: THREE.Object3D; rate: number }> = [];

  /** Small well pad + wellhead tree at local origin of `g` (returns tree top Y). */
  const wellPad = (g: THREE.Object3D, padW = 9, padD = 7) => {
    box(g, padW, 0.12, padD, gravel, 0, 0.06, 0);
    // Cellar ring + tree: casing head, tubing spool, master valve, flow tee.
    cyl(g, 0.55, 0.3, concrete, 0, 0.15, 0, 'y', 16);
    cyl(g, 0.28, 0.5, steelGrey, 0, 0.55, 0, 'y', 14);
    cyl(g, 0.34, 0.08, steelGrey, 0, 0.82, 0, 'y', 14);
    cyl(g, 0.18, 0.7, steelGrey, 0, 1.2, 0, 'y', 12);
    cyl(g, 0.14, 0.9, steelGrey, 0, 1.45, 0, 'x', 10);           // flow tee / wing
    cyl(g, 0.16, 0.04, valveRed, 0, 1.25, 0.24, 'z', 12);         // master valve wheel
    cyl(g, 0.13, 0.04, valveRed, 0.45, 1.45, 0.18, 'z', 12);      // wing valve wheel
    return 1.65;
  };

  /** Ground pipe on sleepers through a polyline (XZ), following the terrain. */
  const groundPipe = (pts: XZ[], radius = 0.08, material = pipeBlack, lift = 0.3) => {
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.01) continue;
      const n = Math.max(1, Math.ceil(len / 6));
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const p = V(x, groundAt(x, z) + lift, z);
        if (prev) strut(stat, prev, p, radius, material, 8);
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.25), wood); // sleeper
        s.position.set(x, p.y - radius - 0.11, z);
        s.rotation.y = yaw;
        stat.add(s);
        prev = p;
      }
    }
  };

  /** L-shaped flowline: wellhead wing → (corner) → battery header. */
  const flowline = (from: THREE.Vector3, to: XZ, viaXFirst = true) => {
    const corner = viaXFirst ? { x: to.x, z: from.z } : { x: from.x, z: to.z };
    groundPipe([{ x: from.x + 0.5, z: from.z }, corner, to]);
  };

  /** Beam pump (simplified but animated) — beam along local X, well at +X. */
  const farPumpjack = (w: XZ, i: number) => {
    const gy = groundAt(w.x, w.z);
    const paint = pjPaints[i % pjPaints.length];
    // Well sits under the horsehead (+4.6); the unit stands behind it (−X).
    const unitX = w.x - 4.6;
    const g = site(stat, unitX, w.z, 0, gy);
    const wellLocal = new THREE.Group(); wellLocal.position.set(4.6, 0, 0); g.add(wellLocal);
    wellPad(wellLocal, 16, 7);
    box(g, 7.2, 0.45, 2.2, concrete, -0.6, 0.22, 0);
    box(g, 7.2, 0.25, 0.2, dark, -0.6, 0.55, 0.75);
    box(g, 7.2, 0.25, 0.2, dark, -0.6, 0.55, -0.75);
    // Samson post (A-frame) + saddle.
    for (const s of [-1, 1]) strut(g, V(-1.0, 0.6, s * 0.85), V(0, 4.3, 0), 0.12, paint, 8);
    strut(g, V(1.1, 0.6, 0), V(0, 4.3, 0), 0.1, paint, 8);
    box(g, 0.5, 0.3, 0.6, dark, 0, 4.35, 0);
    // Gearbox, motor, belt guard.
    box(g, 1.5, 1.3, 1.6, mat(0x374151, 0.6, 0.5), -3.6, 1.3, 0);
    box(g, 0.9, 0.7, 0.7, motorBlue, -5.6, 0.95, 1.0);
    box(g, 1.8, 0.9, 0.12, guardYellow, -4.6, 1.2, 1.05);
    // Polished rod over the well.
    cyl(g, 0.035, 1.6, mat(0xdfe5ea, 0.15, 0.95), 4.6, 2.4, 0, 'y', 6);
    // Guard fence around the crank sweep.
    for (const [ax, az, bx, bz] of [[-6.4, -1.9, -1.4, -1.9], [-6.4, 1.9, -1.4, 1.9], [-6.4, -1.9, -6.4, 1.9]]) {
      strut(g, V(ax, 1.0, az), V(bx, 1.0, bz), 0.03, guardYellow, 6);
      strut(g, V(ax, 0.5, az), V(bx, 0.5, bz), 0.03, guardYellow, 6);
      strut(g, V(ax, 0, az), V(ax, 1.05, az), 0.035, guardYellow, 6);
      strut(g, V(bx, 0, bz), V(bx, 1.05, bz), 0.035, guardYellow, 6);
    }
    // --- moving parts (live) ---
    const d = site(dyn, unitX, w.z, 0, gy);
    const beam = new THREE.Group(); beam.position.set(0, 4.5, 0); d.add(beam);
    box(beam, 8.6, 0.45, 0.4, paint, 0.2, 0, 0, false);
    const head = box(beam, 0.55, 2.0, 0.6, paint, 4.6, -0.55, 0, false);
    head.rotation.z = 0.08;
    box(beam, 0.7, 0.5, 1.0, dark, -4.0, 0, 0, false); // equalizer
    const crank = new THREE.Group(); crank.position.set(-3.6, 1.7, 0); d.add(crank);
    for (const cz of [-0.95, 0.95]) {
      box(crank, 2.4, 0.32, 0.16, dark, 0, 0, cz, false);
      box(crank, 1.0, 1.05, 0.28, mat(0x1c1917, 0.6, 0.4), -0.95, 0, cz, false);
    }
    pumps.push({ beam, crank, rate: 0.55 + ((i * 37) % 10) * 0.05, phase: i * 1.7 });
    return V(w.x + 0.45, gy + 1.45, w.z); // wing outlet (world)
  };

  /** Progressive-cavity pump: surface drive head on the tree, VSD alongside. */
  const pcpWell = (w: XZ, i: number) => {
    const gy = groundAt(w.x, w.z);
    const g = site(stat, w.x, w.z, 0, gy);
    const top = wellPad(g, 8, 7);
    // Drive-head frame + gearbox + motor + belt guard.
    cyl(g, 0.26, 0.5, steelGrey, 0, top + 0.25, 0, 'y', 12);
    box(g, 0.9, 0.9, 0.9, mat(0x374151, 0.6, 0.5), 0, top + 0.95, 0);
    box(g, 1.1, 0.12, 1.1, dark, 0, top + 1.45, 0);
    box(g, 0.55, 1.2, 0.55, motorBlue, -0.75, top + 2.1, 0);     // vertical motor
    box(g, 1.6, 0.18, 1.1, guardYellow, -0.4, top + 2.85, 0);     // belt guard over sheaves
    // VSD cabinet with sunshade + cable.
    box(g, 1.2, 1.9, 0.6, cabinetGrey, -3.2, 1.07, 2.2);
    box(g, 1.6, 0.06, 1.0, cabinetGrey, -3.2, 2.3, 2.2);
    strut(g, V(-2.6, 0.3, 2.2), V(-0.3, 0.3, 0.4), 0.05, dark, 6);
    // Rotating polished rod + clamp (live) — spins with the downhole rotor.
    const d = site(dyn, w.x, w.z, 0, gy);
    const rotor = new THREE.Group(); rotor.position.set(0, top + 1.5, 0); d.add(rotor);
    cyl(rotor, 0.04, 1.6, mat(0xdfe5ea, 0.15, 0.95), 0, 0.6, 0, 'y', 6, false);
    box(rotor, 0.5, 0.12, 0.14, guardYellow, 0, 1.25, 0, false); // rod clamp (shows rotation)
    pcpDrives.push({ rotor, rate: 2.2 + (i % 3) * 0.6 });
    lamp(w.x - 3.2, gy + 1.9, w.z + 2.55, 0x22ff66, 0.5, undefined, true); // VSD "run" LED
    return V(w.x + 0.45, gy + 1.45, w.z);
  };

  /** Electric-submersible pump well: tree + vented JB + switchboard + transformer. */
  const espWell = (w: XZ) => {
    const gy = groundAt(w.x, w.z);
    const g = site(stat, w.x, w.z, 0, gy);
    wellPad(g, 10, 8);
    cyl(g, 0.12, 0.5, steelGrey, 0, 1.95, 0, 'y', 10); // swab valve / cap
    cyl(g, 0.16, 0.04, valveRed, 0, 1.95, 0.2, 'z', 12);
    // Power cable penetrator → vented junction box.
    box(g, 0.5, 0.8, 0.35, cabinetGrey, -1.8, 0.9, -1.2);
    strut(g, V(-1.8, 0.5, -1.2), V(-0.2, 0.6, -0.1), 0.05, dark, 6);
    // Switchboard / VSD with sunshade.
    box(g, 2.2, 2.1, 0.8, cabinetGrey, -3.6, 1.17, 1.8);
    box(g, 2.8, 0.06, 1.4, cabinetGrey, -3.6, 2.55, 1.8);
    for (const sx of [-1.3, 1.3]) strut(g, V(-3.6 + sx, 0.1, 2.4), V(-3.6 + sx, 2.55, 2.4), 0.04, rackSteel, 6);
    // Step-up transformer on a plinth (cooling fins).
    box(g, 1.6, 0.25, 1.4, concrete, -3.6, 0.25, -2.0);
    box(g, 1.2, 1.4, 1.0, mat(0x6b7f62, 0.7, 0.3), -3.6, 1.07, -2.0);
    for (let f = -2; f <= 2; f++) box(g, 0.04, 1.1, 1.15, mat(0x5b6e53, 0.7, 0.3), -3.6 + f * 0.22, 1.07, -2.0);
    // Service pole with drop from the overhead line.
    cyl(g, 0.14, 9, wood, -5.5, 4.5, 0, 'y', 8);
    box(g, 0.15, 0.15, 2.2, wood, -5.5, 8.6, 0);
    strut(g, V(-5.5, 8.6, 0), V(-3.6, 1.8, -2.0), 0.03, dark, 4);
    lamp(w.x - 3.0, gy + 1.7, w.z + 2.25, 0x22ff66, 0.5, undefined, true);
    return V(w.x + 0.45, gy + 1.45, w.z);
  };

  // =========================================================================
  // FACILITIES
  // =========================================================================

  /** Satellite tank battery: bermed tanks, catwalk, stairs, separator, header. */
  const battery = (b: (typeof SAT_BATTERIES)[number]) => {
    const spacing = b.r * 2 + 1.4;
    const len = (b.count - 1) * spacing;
    const gy = groundAt(b.x + len / 2, b.z);
    const g = site(stat, b.x, b.z, 0, gy);
    // Earthen containment berm (4 walls) + gravel floor.
    const bw = len + b.r * 2 + 4, bd = b.r * 2 + 5, cx = len / 2;
    box(g, bw, 0.1, bd, gravel, cx, 0.05, 0);
    box(g, bw, 0.8, 0.6, berm, cx, 0.4, bd / 2);
    box(g, bw, 0.8, 0.6, berm, cx, 0.4, -bd / 2);
    box(g, 0.6, 0.8, bd, berm, cx - bw / 2, 0.4, 0);
    box(g, 0.6, 0.8, bd, berm, cx + bw / 2, 0.4, 0);
    for (let i = 0; i < b.count; i++) {
      const x = i * spacing;
      cyl(g, b.r, b.h, i % 2 ? tankGrey : tankWhite, x, 0.1 + b.h / 2, 0, 'y', 22);
      cyl(g, b.r + 0.04, 0.2, dark, x, b.h + 0.2, 0, 'y', 22);
      cyl(g, 0.12, 0.8, dark, x + b.r * 0.5, b.h + 0.6, 0, 'y', 8); // thief hatch / vent
      cyl(g, 0.14, 1.2, pipeBlack, x, 0.9, b.r + 0.5, 'y', 8);     // fill riser
    }
    // Roof catwalk spanning the tanks + stair tower at one end.
    box(g, len + 1, 0.12, 0.9, rackSteel, cx, b.h + 0.45, 0);
    kit.railing(g, [V(-0.5, b.h + 0.5, 0.45), V(len + 0.5, b.h + 0.5, 0.45)], guardYellow);
    kit.railing(g, [V(-0.5, b.h + 0.5, -0.45), V(len + 0.5, b.h + 0.5, -0.45)], guardYellow);
    const sx = -b.r - 1.6;
    strut(g, V(sx, 0.1, -1.2), V(sx + 1.4, b.h + 0.45, -1.2), 0.08, rackSteel, 6);
    strut(g, V(sx, 0.1, -0.2), V(sx + 1.4, b.h + 0.45, -0.2), 0.08, rackSteel, 6);
    for (let s = 1; s < 12; s++) {
      const t = s / 12;
      box(g, 0.25, 0.05, 1.0, rackSteel, sx + 1.4 * t, 0.1 + (b.h + 0.35) * t, -0.7);
    }
    // Inlet header along the front + two-phase separator + heater-treater.
    strut(g, V(-b.r, 0.6, b.r + 1.2), V(len + b.r, 0.6, b.r + 1.2), 0.14, pipeBlack, 10);
    cyl(g, 0.8, 4.2, columnWhite, cx, 1.6, b.r + 4.0, 'x', 16);
    for (const sx2 of [-1.4, 1.4]) box(g, 0.25, 0.9, 1.2, dark, cx + sx2, 0.45, b.r + 4.0);
    cyl(g, 1.1, 5.0, mat(0x6b7280, 0.6, 0.5), len + b.r + 3.5, 2.6, b.r + 2.5, 'y', 18);
    cyl(g, 0.14, 3.0, dark, len + b.r + 3.5, 6.6, b.r + 2.5, 'y', 8); // fire-tube stack
    return { header: { x: b.x - b.r, z: b.z + b.r + 1.2 }, outlet: { x: b.x + len + b.r + 3.5, z: b.z } };
  };

  /** Central processing / stabilisation station with flare. */
  let flareFlame: THREE.Mesh | null = null;
  let flareGlow: THREE.Sprite | null = null;
  const station = () => {
    const { x: X, z: Z, w: W, d: D } = STATION;
    const gy = groundAt(X, Z);
    const g = site(stat, X, Z, 0, gy);
    box(g, W, 0.15, D, concrete, 0, 0.07, 0);
    // Perimeter fence (posts + mesh panels).
    const fence = mat(0x9ca3af, 0.6, 0.6);
    for (const [ax, az, bx, bz] of [[-W / 2, -D / 2, W / 2, -D / 2], [W / 2, -D / 2, W / 2, D / 2], [W / 2, D / 2, -W / 2, D / 2], [-W / 2, D / 2, -W / 2, -D / 2]]) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.round(len / 3);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        cyl(g, 0.05, 2.2, fence, ax + (bx - ax) * t, 1.1, az + (bz - az) * t, 'y', 6);
      }
      strut(g, V(ax, 2.1, az), V(bx, 2.1, bz), 0.03, fence, 4);
      strut(g, V(ax, 1.1, az), V(bx, 1.1, bz), 0.03, fence, 4);
    }
    // Stabiliser / fractionation columns with platforms, ladders, top lamps.
    const columns: Array<[number, number, number, number]> = [[-14, -8, 1.7, 30], [-8, -8, 1.3, 22], [-2, -8, 2.0, 34]];
    for (const [cx, cz, r, h] of columns) {
      box(g, r * 2 + 1.2, 1.0, r * 2 + 1.2, concrete, cx, 0.5, cz);                 // plinth
      cyl(g, r * 1.12, 1.6, columnWhite, cx, 1.8, cz, 'y', 20);                       // skirt
      cyl(g, r, h, columnWhite, cx, 2.6 + h / 2, cz, 'y', 20);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), columnWhite);
      cap.position.set(cx, 2.6 + h, cz); g.add(cap);
      for (let py = 8; py < h; py += 7) {
        cyl(g, r + 0.9, 0.12, rackSteel, cx, 2.6 + py, cz, 'y', 20);                // platform
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.85, 0.03, 4, 24), guardYellow);
        ring.rotation.x = Math.PI / 2; ring.position.set(cx, 3.65 + py, cz); g.add(ring);
      }
      strut(g, V(cx + r + 0.25, 2.6, cz), V(cx + r + 0.25, 2.6 + h, cz), 0.04, rackSteel, 4); // ladder
      strut(g, V(cx + r + 0.25, 2.6, cz + 0.5), V(cx + r + 0.25, 2.6 + h, cz + 0.5), 0.04, rackSteel, 4);
      // Overhead vapour line down to the cooler bank.
      kit.pipe(g, [V(cx, 2.6 + h + r * 0.8, cz), V(cx, 2.6 + h + r * 0.8 + 1.2, cz), V(cx + 4, 2.6 + h + 1.2, cz + 12), V(cx + 4, 8.6, cz + 12)], 0.22, insulation);
      lamp(X + cx, gy + 2.6 + h + r + 0.4, Z + cz, 0xff2a2a, 1.4, 1.1, false); // aviation obstruction lamp
    }
    // LPG / product spheres on legs.
    for (const [sx, sz] of [[14, -9], [24, -9]]) {
      const R = 5.2;
      const sp = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), tankWhite);
      sp.position.set(sx, R + 3.2, sz); g.add(sp);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        strut(g, V(sx + Math.cos(a) * R * 0.95, 0.1, sz + Math.sin(a) * R * 0.95), V(sx + Math.cos(a) * R * 0.98, R + 3.2, sz + Math.sin(a) * R * 0.98), 0.18, rackSteel, 8);
      }
      cyl(g, R + 0.6, 0.1, rackSteel, sx, 2 * R + 3.3, sz, 'y', 20); // top platform
      strut(g, V(sx + R * 0.7, 0.1, sz + R * 0.75), V(sx, 2 * R + 3.3, sz + 0.4), 0.06, rackSteel, 4); // stair
    }
    // Fired heater (box) with twin stacks.
    box(g, 9, 7, 5, brick, -14, 3.6, 10);
    box(g, 9.4, 0.4, 5.4, dark, -14, 7.2, 10);
    for (const sx of [-16.5, -11.5]) cyl(g, 0.6, 16, dark, sx, 15.2, 10, 'y', 12);
    // Fin-fan air cooler bank on a structure.
    box(g, 20, 1.1, 6, rackSteel, 4, 8.0, 6);
    for (const lx of [-5, 0, 5]) for (const lz of [-2.5, 2.5]) strut(g, V(4 + lx * 1.8, 0.1, 6 + lz), V(4 + lx * 1.8, 7.5, 6 + lz), 0.12, rackSteel, 6);
    for (let f = 0; f < 6; f++) cyl(g, 1.3, 0.25, dark, -4 + f * 3.3, 8.7, 6, 'y', 16);
    // Process pipe rack through the plant (3 tiers of pipes).
    for (let px = -26; px <= 26; px += 6) {
      for (const pz of [-1.6, 1.6]) strut(g, V(px, 0.1, pz), V(px, 6.2, pz), 0.12, rackSteel, 6);
      for (const py of [3.6, 6.0]) box(g, 0.25, 0.25, 3.6, rackSteel, px, py, 0);
    }
    for (const [pz, py, r, m] of [[-1.1, 3.9, 0.22, pipeBlack], [-0.4, 3.9, 0.3, insulation], [0.4, 3.9, 0.18, pipeYellow], [1.1, 3.9, 0.22, pipeBlack], [-0.8, 6.3, 0.35, insulation], [0.6, 6.3, 0.22, pipeBlack]] as const) {
      strut(g, V(-26, py, pz), V(26, py, pz), r, m, 10);
    }
    // Horizontal separators / slug catcher.
    for (let k = 0; k < 3; k++) {
      cyl(g, 1.3, 9, columnWhite, 22, 2.0, 9 + k * 3.4 - 3.4, 'x', 18);
      for (const sx of [-3, 3]) box(g, 0.3, 1.2, 1.8, concrete, 22 + sx, 0.6, 9 + k * 3.4 - 3.4);
    }
    // Control room / MCC building with lit windows.
    box(g, 13, 4.2, 7, brick, -20, 2.1, -17);
    box(g, 13.6, 0.35, 7.6, dark, -20, 4.35, -17);
    for (let wx = -4; wx <= 4; wx += 2.6) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.06), windowMat);
      win.position.set(X - 20 + wx, gy + 2.5, Z - 17 + 3.53); dyn.add(win);
    }
    // Flood-light masts at the plant corners.
    for (const [lx, lz] of [[-W / 2 + 2, -D / 2 + 2], [W / 2 - 2, -D / 2 + 2], [-W / 2 + 2, D / 2 - 2], [W / 2 - 2, D / 2 - 2], [0, 15]]) {
      cyl(g, 0.16, 14, rackSteel, lx, 7, lz, 'y', 8);
      box(g, 1.6, 0.4, 0.4, dark, lx, 14, lz);
      lamp(X + lx, gy + 14, Z + lz, 0xffe2a8, 5.5);
    }
    // Plant fill lights on the structures (so it glows at night).
    for (const [lx, ly, lz] of [[4, 9.2, 6], [-14, 8, 10], [19, 13.8, -9], [-8, 18, -8], [0, 6.6, 2.2], [-20, 4.8, -13]]) lamp(X + lx, gy + ly, Z + lz, 0xffd28a, 2.6);
    // --- FLARE: knock-out drum, guyed stack, pilot + live flame ---------------
    const fx = W / 2 + 10, fz = 6, FH = 38;
    cyl(g, 1.1, 5, columnWhite, fx - 5, 1.4, fz, 'x', 16);
    strut(g, V(W / 2 - 2, 3.9, 0.4), V(fx - 7.5, 1.4, fz), 0.25, pipeBlack, 8);
    strut(g, V(fx - 2.5, 1.4, fz), V(fx, 1.0, fz), 0.25, pipeBlack, 8);
    box(g, 2.4, 1.0, 2.4, concrete, fx, 0.5, fz);
    cyl(g, 0.5, FH, mat(0x52525b, 0.5, 0.6), fx, FH / 2 + 1, fz, 'y', 12);
    cyl(g, 0.75, 1.2, dark, fx, FH + 1.4, fz, 'y', 12); // flare tip
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      strut(g, V(fx, FH * 0.75, fz), V(fx + Math.cos(a) * 16, 0.2, fz + Math.sin(a) * 16), 0.025, dark, 4);
      strut(g, V(fx, FH * 0.4, fz), V(fx + Math.cos(a) * 16, 0.2, fz + Math.sin(a) * 16), 0.025, dark, 4);
    }
    lamp(X + fx, gy + FH * 0.55, Z + fz, 0xff2a2a, 1.4, 1.3, false);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    flareFlame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 12, 1, true), flameMat);
    flareFlame.position.set(X + fx, gy + FH + 4.4, Z + fz);
    dyn.add(flareFlame);
    flareGlow = lamp(X + fx, gy + FH + 4.0, Z + fz, 0xff9a3a, 14, undefined, true);
    return { inlet: { x: X - W / 2 - 1, z: Z + 0 }, north: { x: X, z: Z + D / 2 + 1 } };
  };

  /** Crude export storage: big floating-roof tanks in a bund. */
  const crudeStorage = () => {
    const c = CRUDE_STORAGE;
    const len = (c.count - 1) * c.spacing;
    const gy = groundAt(c.x + len / 2, c.z);
    const g = site(stat, c.x, c.z, 0, gy);
    const bw = len + c.r * 2 + 8, bd = c.r * 2 + 8;
    box(g, bw, 0.1, bd, gravel, len / 2, 0.05, 0);
    for (const [w, d, x, z] of [[bw, 0.8, len / 2, bd / 2], [bw, 0.8, len / 2, -bd / 2], [0.8, bd, len / 2 - bw / 2, 0], [0.8, bd, len / 2 + bw / 2, 0]]) box(g, w, 1.6, d, concrete, x, 0.8, z);
    for (let i = 0; i < c.count; i++) {
      const x = i * c.spacing;
      cyl(g, c.r, c.h, tankWhite, x, 0.2 + c.h / 2, 0, 'y', 36);
      const girder = new THREE.Mesh(new THREE.TorusGeometry(c.r + 0.25, 0.12, 4, 40), rackSteel);
      girder.rotation.x = Math.PI / 2; girder.position.set(x, c.h - 0.6, 0); g.add(girder);
      cyl(g, c.r - 0.3, 0.3, tankGrey, x, c.h - 1.4, 0, 'y', 36); // floating roof (sits inside the shell)
      // Spiral stair approximated by stringer segments round the shell.
      let prev = V(x + c.r + 0.6, 0.2, 0);
      for (let k = 1; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 0.9;
        const p = V(x + Math.cos(a) * (c.r + 0.6), 0.2 + (c.h - 0.2) * (k / 10), Math.sin(a) * (c.r + 0.6));
        strut(g, prev, p, 0.07, rackSteel, 4);
        prev = p;
      }
      lamp(c.x + x, gy + c.h + 1.2, c.z + c.r * 0.6, 0xffe2a8, 3.0);
    }
    return { x: c.x + len / 2, z: c.z + bd / 2 + 1.5 };
  };

  /** Elevated pipe rack (T-supports every 8 m, 4 lines) along XZ polyline. */
  const pipeRack = (pts: XZ[], height = 5) => {
    const offsets: Array<[number, number, THREE.Material]> = [[-0.9, 0.3, pipeBlack], [-0.3, 0.22, insulation], [0.3, 0.26, pipeBlack], [0.9, 0.16, pipeYellow]];
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(len / 8));
      const dirX = (b.x - a.x) / len, dirZ = (b.z - a.z) / len;
      const sideX = -dirZ, sideZ = dirX;
      const tops: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const gy = groundAt(x, z);
        const top = V(x, gy + height, z);
        tops.push(top);
        strut(stat, V(x, gy - 0.3, z), top, 0.16, rackSteel, 6);
        strut(stat, V(x - sideX * 1.3, gy + height, z - sideZ * 1.3), V(x + sideX * 1.3, gy + height, z + sideZ * 1.3), 0.12, rackSteel, 4);
        box(stat, 0.9, 0.3, 0.9, concrete, x, gy + 0.1, z);
      }
      for (const [off, r, m] of offsets) {
        for (let i = 1; i < tops.length; i++) {
          const p0 = tops[i - 1], p1 = tops[i];
          strut(stat, V(p0.x + sideX * off, p0.y + r + 0.12, p0.z + sideZ * off), V(p1.x + sideX * off, p1.y + r + 0.12, p1.z + sideZ * off), r, m, 8);
        }
      }
    }
  };

  /** Overhead power line on wood poles along XZ polyline (poles every ~30 m). */
  const powerLine = (pts: XZ[]) => {
    const tops: THREE.Vector3[] = [];
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(len / 30));
      for (let i = k === 1 ? 0 : 1; i <= n; i++) {
        const t = i / n;
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const gy = groundAt(x, z);
        cyl(stat, 0.16, 10, wood, x, gy + 5, z, 'y', 6);
        box(stat, 0.16, 0.16, 2.6, wood, x, gy + 9.6, z);
        tops.push(V(x, gy + 9.7, z));
      }
    }
    for (const off of [-1.1, 0, 1.1]) {
      for (let i = 1; i < tops.length; i++) {
        const p0 = tops[i - 1].clone(); p0.z += off;
        const p1 = tops[i].clone(); p1.z += off;
        const mid = p0.clone().lerp(p1, 0.5); mid.y -= 0.8; // sag
        strut(stat, p0, mid, 0.015, dark, 3);
        strut(stat, mid, p1, 0.015, dark, 3);
      }
    }
  };

  // =========================================================================
  // PLACEMENT + GATHERING SYSTEM
  // =========================================================================
  const [neBat, swBat, nwBat] = SAT_BATTERIES.map(battery);
  FAR_PUMPJACK_WELLS.forEach((w, i) => flowline(farPumpjack(w, i), neBat.header, false));
  PCP_WELLS.forEach((w, i) => flowline(pcpWell(w, i), swBat.header, false));
  ESP_WELLS.forEach((w) => flowline(espWell(w), nwBat.header, false));
  const plant = station();
  const crudeOut = crudeStorage();
  // Main lease battery → plant on an elevated rack (crosses open ground).
  pipeRack([opts.leaseBattery, { x: opts.leaseBattery.x + 10, z: opts.leaseBattery.z - 30 }, { x: plant.inlet.x - 6, z: plant.inlet.z }, plant.inlet], 5);
  // Satellite trunk lines on sleepers.
  groundPipe([neBat.outlet, { x: neBat.outlet.x + 6, z: neBat.outlet.z }, { x: neBat.outlet.x + 6, z: plant.north.z }, plant.north], 0.22);
  groundPipe([swBat.outlet, { x: swBat.outlet.x + 6, z: swBat.outlet.z }, { x: swBat.outlet.x + 6, z: -124 }, { x: plant.inlet.x - 2, z: -124 }, { x: plant.inlet.x - 2, z: plant.inlet.z - 3 }], 0.22);
  groundPipe([nwBat.outlet, { x: nwBat.outlet.x + 4, z: nwBat.outlet.z }, { x: -54, z: nwBat.outlet.z }, { x: -54, z: -44 }, { x: opts.leaseInlet.x, z: -44 }, opts.leaseInlet], 0.18);
  // Near-lease pump-jack flowlines into the lease battery headers.
  (opts.leaseFlowlines ?? []).forEach((line) => groundPipe(line, 0.08));
  // Plant ↔ crude storage export lines.
  groundPipe([{ x: plant.inlet.x + 2, z: STATION.z - STATION.d / 2 - 1 }, { x: plant.inlet.x + 2, z: crudeOut.z }, crudeOut], 0.3, pipeYellow);
  // Overhead power feeding the ESP pattern (runs along the wells).
  powerLine([{ x: ESP_WELLS[0].x - 5.5, z: 90 }, { x: ESP_WELLS[2].x - 5.5, z: 90 }, { x: ESP_WELLS[2].x + 24, z: 60 }, { x: -58, z: 30 }]);

  // Collapse all static parts into one mesh per material.
  mergeStatic(stat, staticHolder);
  scene.add(staticHolder, dyn);

  return {
    update(time, lightLevel) {
      for (const p of pumps) {
        const a = time * p.rate + p.phase;
        p.crank.rotation.z = a;
        p.beam.rotation.z = Math.sin(a) * 0.17;
      }
      for (const d of pcpDrives) d.rotor.rotation.y = time * d.rate;
      const night = THREE.MathUtils.clamp(lightLevel, 0, 1);
      windowMat.emissiveIntensity = 1.6 * night;
      for (const l of lamps) {
        if (l.always) continue;
        let on = night > 0.05;
        if (on && l.blink) on = Math.sin(time * Math.PI * 2 * (1 / l.blink)) > 0.2;
        l.sprite.visible = on;
        if (on) l.sprite.scale.setScalar(l.base * (0.6 + 0.4 * night));
      }
      if (flareFlame) {
        const f = 0.85 + Math.sin(time * 11.3) * 0.08 + Math.sin(time * 23.7) * 0.06;
        flareFlame.scale.set(f, 0.8 + f * 0.35 + Math.sin(time * 7.1) * 0.1, f);
        flareFlame.rotation.y = time * 0.7;
      }
      if (flareGlow) flareGlow.scale.setScalar((8 + 8 * night) * (0.9 + Math.sin(time * 9.0) * 0.08));
    },
    dispose() {
      staticHolder.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      dyn.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      scene.remove(staticHolder, dyn);
      glowTex.dispose();
      lampMats.forEach((m) => m.dispose());
      windowMat.dispose();
    },
  };
}
