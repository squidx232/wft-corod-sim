/**
 * Knuckle-boom crane simulation — Fassi F215A.0.24 active / e-active, as fitted
 * to the CoRod MG unit. Pure TypeScript (no three.js) so it can be unit-tested
 * and reused by other trainers.
 *
 * Coordinate frame: world metres, +Y up. Slew 0 points the boom along +X
 * (toward the wellhead); positive slew rotates toward −Z (three.js
 * `rotation.y`), which is "left" for the operator at the MG console.
 *
 * Joints (one per lever):
 *  slew      — column rotation about Y (rad)
 *  main      — inner (main) boom elevation above horizontal (rad)
 *  outer     — outer (knuckle) boom angle RELATIVE to the main boom (rad,
 *              0 = straight in line, negative = folded under)
 *  extension — total hydraulic extension of the outer boom (m)
 *
 * Ratings from the F215A.0.24 data: 178 kNm lifting moment, 9.93 t max
 * capacity, 17.05 m max reach, 2.435 t crane mass, folded 2.475 × 0.87 ×
 * 2.255 m. Boom/extension proportions are chosen to meet those figures; use
 * the crane's own load chart on site.
 *
 * The crane has NO stabilizers of its own — it is part of the MG unit and
 * uses the MG outriggers, which must be extended and lowered before operating.
 */

export interface Vec3 { x: number; y: number; z: number }

export interface CraneSpec {
  model: string;
  /** Main-boom pivot height above the crane base (deck), m. */
  columnHeight: number;
  /** Horizontal offset of the main-boom pivot from the slew axis, m. */
  pivotOffset: number;
  mainBoomLength: number;
  outerBoomLength: number;
  extensionCount: number;
  /** Total hydraulic extension when fully out, m. */
  maxExtension: number;
  /** Hook link length below the boom tip, m. */
  hookLink: number;
  hookMassKg: number;
  /** Net rated lifting moment (load × radius), kg·m. */
  ratedMomentKgM: number;
  /** Maximum capacity regardless of radius, kg. */
  maxLoadKg: number;
  craneMassKg: number;
  /** Folded transport dimensions (length × width × height), m. */
  folded: { length: number; width: number; height: number };
  /** Boom cross-section half-sizes used for drawing and collision, m. */
  mainBoomRadius: number;
  outerBoomRadius: number;
  limits: { slew: [number, number]; main: [number, number]; outer: [number, number] };
  /** Max joint speeds at full lever: rad/s (slew/main/outer), m/s (extension). */
  maxRates: { slew: number; main: number; outer: number; extension: number };
}

const DEG = Math.PI / 180;
const G = 9.81;

export const FASSI_F215A: CraneSpec = {
  model: 'FASSI F215A.0.24',
  columnHeight: 1.85,
  pivotOffset: 0.2,
  mainBoomLength: 2.45,
  outerBoomLength: 2.35,
  extensionCount: 6,
  // 0.2 + 2.45 + 2.35 + 12.05 = 17.05 m maximum reach.
  maxExtension: 12.05,
  hookLink: 0.55,
  hookMassKg: 45,
  ratedMomentKgM: (178 * 1000) / G, // 178 kNm ≈ 18 145 kg·m
  maxLoadKg: 9930,
  craneMassKg: 2435,
  folded: { length: 2.475, width: 0.87, height: 2.255 },
  mainBoomRadius: 0.22,
  outerBoomRadius: 0.17,
  limits: {
    slew: [-200 * DEG, 200 * DEG],
    main: [-10 * DEG, 80 * DEG],
    outer: [-172 * DEG, 20 * DEG],
  },
  maxRates: { slew: 13 * DEG, main: 7 * DEG, outer: 9 * DEG, extension: 0.45 },
};

/** Kept for compatibility with earlier imports. */
export const FASSI_F215C = FASSI_F215A;

/**
 * Transport (folded) pose: main boom lying back over the deck toward the cab,
 * outer boom folded under it — ≈ 2.25 m high above the deck, 2.45 m long.
 */
export const STOWED_POSE = { slew: Math.PI - 0.3, main: 3 * DEG, outer: -172 * DEG, extension: 0 };

export type CraneJoint = 'slew' | 'main' | 'outer' | 'extension';
export const CRANE_JOINTS: CraneJoint[] = ['slew', 'main', 'outer', 'extension'];
export type CraneInputs = Record<CraneJoint, number>; // each −1..1

export interface CraneLoadDef {
  id: string;
  label: { en: string; ar: string };
  massKg: number;
  /** Box size (x, y, z) m; lift point at the top centre. */
  size: [number, number, number];
  color: number;
  kind: 'basket' | 'lubricator' | 'injector' | 'block';
  start: { x: number; z: number };
}

export interface CraneLoad {
  def: CraneLoadDef;
  /** Bottom-centre position (world). */
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  attached: boolean;
  /** Resting on a surface (rope slack). */
  landed: boolean;
}

/** Axis-aligned solid in the scene (truck parts, mast, wellhead, cones…). */
export interface Collider { min: Vec3; max: Vec3; name: string }

export type LmiState = 'ok' | 'warn' | 'limit';
export type BlockReason = 'lmi' | 'outriggers' | 'power' | 'estop' | 'limit' | 'collision';

export interface CraneEvent { t: number; kind: 'info' | 'warn' | 'error' | 'success'; code: string; detail?: string }

export interface CraneState {
  time: number;
  joints: Record<CraneJoint, number>;
  rates: Record<CraneJoint, number>;
  /** MG outriggers extended + lowered (set from the MG unit state). */
  outriggersReady: boolean;
  powerAvailable: boolean;
  estop: boolean;
  hook: Vec3;
  hookVelocity: Vec3;
  tip: Vec3;
  knuckle: Vec3;
  pivot: Vec3;
  load: CraneLoad | null;
  radius: number;
  momentKgM: number;
  lmiPercent: number;
  lmiState: LmiState;
  blocked: Partial<Record<CraneJoint, BlockReason>>;
  /** Name of the object the crane is touching / was stopped by. */
  contact: string | null;
  swing: number;
  events: CraneEvent[];
}

export interface CraneWorld {
  /** Crane base (slew axis at the top of the truck deck). */
  base: Vec3;
  /** Height of the supporting ground / truck deck at x,z. */
  surfaceAt(x: number, z: number): number;
  /** Solid objects the booms, hook and load collide with. */
  colliders?: Collider[];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);

export interface CraneKinematics { pivot: Vec3; knuckle: Vec3; tip: Vec3; dir: Vec3 }

export function craneKinematics(spec: CraneSpec, base: Vec3, j: Record<CraneJoint, number>): CraneKinematics {
  const dir = { x: Math.cos(j.slew), y: 0, z: -Math.sin(j.slew) };
  const pivot = add(add(base, { x: 0, y: spec.columnHeight, z: 0 }), scale(dir, spec.pivotOffset));
  const along = (angle: number, length: number): Vec3 => add(scale(dir, Math.cos(angle) * length), { x: 0, y: Math.sin(angle) * length, z: 0 });
  const knuckle = add(pivot, along(j.main, spec.mainBoomLength));
  const tip = add(knuckle, along(j.main + j.outer, spec.outerBoomLength + j.extension));
  return { pivot, knuckle, tip, dir };
}

/** Net load moment (hook load × radius), kg·m — what the rating refers to. */
export function loadMoment(spec: CraneSpec, base: Vec3, j: Record<CraneJoint, number>, hookLoadKg: number, hookRadius?: number): number {
  const k = craneKinematics(spec, base, j);
  const r = hookRadius ?? Math.hypot(k.tip.x - base.x, k.tip.z - base.z);
  return (hookLoadKg + spec.hookMassKg) * r;
}

/** LMI utilisation (%) — the larger of moment use and capacity use. */
export function lmiPercentFor(spec: CraneSpec, momentKgM: number, hookLoadKg: number): number {
  return Math.max(momentKgM / spec.ratedMomentKgM, (hookLoadKg + spec.hookMassKg) / spec.maxLoadKg) * 100;
}

/** Rated hook capacity at a radius (simplified chart), kg. */
export function ratedCapacityAt(spec: CraneSpec, radius: number): number {
  return clamp(spec.ratedMomentKgM / Math.max(radius, 1) - spec.hookMassKg, 0, spec.maxLoadKg - spec.hookMassKg);
}

// --- Collision -----------------------------------------------------------------------

/** Distance from a point to an AABB (0 inside). */
function pointBoxDistance(p: Vec3, b: Collider): number {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
  return Math.hypot(dx, dy, dz);
}

/** Boom capsules used for collision (ends trimmed at the column so the pedestal/deck mount isn't a hit). */
function boomCapsules(spec: CraneSpec, k: CraneKinematics) {
  const trim = (a: Vec3, b: Vec3, t0: number) => add(a, scale(sub(b, a), t0 / Math.max(len(sub(b, a)), 1e-6)));
  return [
    { a: trim(k.pivot, k.knuckle, 0.55), b: k.knuckle, r: spec.mainBoomRadius },
    { a: k.knuckle, b: k.tip, r: spec.outerBoomRadius },
  ];
}

/**
 * Minimum clearance (m) between the booms and the colliders; negative =
 * penetration depth. Returns the nearest collider name too.
 */
export function boomClearance(spec: CraneSpec, world: CraneWorld, j: Record<CraneJoint, number>): { clearance: number; name: string | null } {
  const cols = world.colliders;
  if (!cols || cols.length === 0) return { clearance: Infinity, name: null };
  const k = craneKinematics(spec, world.base, j);
  let best = Infinity;
  let name: string | null = null;
  for (const c of boomCapsules(spec, k)) {
    const seg = sub(c.b, c.a);
    const L = len(seg);
    const n = Math.max(2, Math.ceil(L / 0.2));
    // Broad phase: segment bounding box grown by radius.
    const lo = { x: Math.min(c.a.x, c.b.x) - c.r - 0.3, y: Math.min(c.a.y, c.b.y) - c.r - 0.3, z: Math.min(c.a.z, c.b.z) - c.r - 0.3 };
    const hi = { x: Math.max(c.a.x, c.b.x) + c.r + 0.3, y: Math.max(c.a.y, c.b.y) + c.r + 0.3, z: Math.max(c.a.z, c.b.z) + c.r + 0.3 };
    for (const box of cols) {
      if (box.max.x < lo.x || box.min.x > hi.x || box.max.y < lo.y || box.min.y > hi.y || box.max.z < lo.z || box.min.z > hi.z) continue;
      for (let i = 0; i <= n; i++) {
        const p = add(c.a, scale(seg, i / n));
        const d = pointBoxDistance(p, box) - c.r;
        if (d < best) { best = d; name = box.name; }
      }
    }
  }
  return { clearance: best, name };
}

/** Collider overlapping an axis-aligned box (for loads/hook), ignoring ones it rests on. */
function overlapping(cols: Collider[] | undefined, min: Vec3, max: Vec3): Collider | null {
  if (!cols) return null;
  for (const b of cols) {
    if (b.max.x <= min.x || b.min.x >= max.x || b.max.z <= min.z || b.min.z >= max.z) continue;
    if (b.max.y <= min.y + 0.03 || b.min.y >= max.y) continue; // resting on top / fully above
    return b;
  }
  return null;
}

/** Highest solid top under a footprint (ground, deck or collider), at or below `belowY`. */
export function supportHeight(world: CraneWorld, x: number, z: number, halfX: number, halfZ: number, belowY: number): { y: number; name: string | null } {
  let y = world.surfaceAt(x, z);
  let name: string | null = null;
  for (const b of world.colliders ?? []) {
    if (b.max.x <= x - halfX || b.min.x >= x + halfX || b.max.z <= z - halfZ || b.min.z >= z + halfZ) continue;
    if (b.max.y > y && b.max.y <= belowY + 0.25) { y = b.max.y; name = b.name; }
  }
  return { y, name };
}

// --- State ---------------------------------------------------------------------------

export function createCraneState(spec: CraneSpec, world: CraneWorld, loadDefs: CraneLoadDef[] = []): CraneState {
  const joints = { ...STOWED_POSE };
  const k = craneKinematics(spec, world.base, joints);
  const hook = add(k.tip, { x: 0, y: -spec.hookLink, z: 0 });
  const def = loadDefs[0];
  const load: CraneLoad | null = def
    ? {
        def,
        position: { x: def.start.x, y: supportHeight(world, def.start.x, def.start.z, def.size[0] / 2, def.size[2] / 2, 50).y, z: def.start.z },
        velocity: { x: 0, y: 0, z: 0 },
        yaw: 0,
        attached: false,
        landed: true,
      }
    : null;
  return {
    time: 0,
    joints,
    rates: { slew: 0, main: 0, outer: 0, extension: 0 },
    outriggersReady: false,
    powerAvailable: false,
    estop: false,
    hook,
    hookVelocity: { x: 0, y: 0, z: 0 },
    tip: k.tip,
    knuckle: k.knuckle,
    pivot: k.pivot,
    load,
    radius: Math.hypot(hook.x - world.base.x, hook.z - world.base.z),
    momentKgM: 0,
    lmiPercent: 0,
    lmiState: 'ok',
    blocked: {},
    contact: null,
    swing: 0,
    events: [],
  };
}

export const SLING_LENGTH = 1.4;
export const HOOK_ON_RANGE = 0.6;
const HOOK_RADIUS = 0.16;
const ropeLength = (spec: CraneSpec, load: CraneLoad | null) => spec.hookLink + (load?.attached ? SLING_LENGTH : 0);
const GRAVITY = 9.81;
const HYDRAULIC_TAU = 0.28;
const SWING_DAMPING = 0.35;

function pushEvent(s: CraneState, kind: CraneEvent['kind'], code: string, detail?: string) {
  const last = s.events[s.events.length - 1];
  if (last && last.code === code && s.time - last.t < 2) return;
  s.events.push({ t: s.time, kind, code, detail });
  if (s.events.length > 80) s.events.shift();
}

/**
 * Advance the crane one step (mutates `s`).
 * Interlocks: E-STOP, hydraulic power (MG engine + PTO), MG outriggers,
 * joint limits, load-moment limiter (blocks moment-increasing motion only) and
 * collision (blocks motion that drives a boom deeper into an object).
 */
export function stepCrane(spec: CraneSpec, world: CraneWorld, s: CraneState, inputs: CraneInputs, dt: number): CraneState {
  dt = clamp(dt, 0, 0.05);
  s.time += dt;
  s.blocked = {};
  s.contact = null;

  const loadKg = s.load?.attached && !s.load.landed ? s.load.def.massKg : 0;
  const hookR = Math.hypot(s.hook.x - world.base.x, s.hook.z - world.base.z);
  const moment = loadMoment(spec, world.base, s.joints, loadKg, hookR);
  const hasColliders = !!world.colliders?.length;
  let clearanceNow = hasColliders ? boomClearance(spec, world, s.joints) : { clearance: Infinity, name: null };

  for (const j of CRANE_JOINTS) {
    let cmd = clamp(inputs[j] ?? 0, -1, 1);
    if (Math.abs(cmd) < 0.04) cmd = 0;
    if (cmd !== 0) {
      if (s.estop) { s.blocked[j] = 'estop'; cmd = 0; }
      else if (!s.powerAvailable) { s.blocked[j] = 'power'; cmd = 0; }
      else if (!s.outriggersReady) { s.blocked[j] = 'outriggers'; cmd = 0; }
    }
    let target = cmd * spec.maxRates[j];
    if (target !== 0 && lmiPercentFor(spec, moment, loadKg) >= 100) {
      const probe = { ...s.joints, [j]: s.joints[j] + Math.sign(target) * 0.01 };
      if (loadMoment(spec, world.base, probe, loadKg) > loadMoment(spec, world.base, s.joints, loadKg) + 1e-6) { s.blocked[j] = 'lmi'; target = 0; }
    }
    s.rates[j] += (target - s.rates[j]) * (1 - Math.exp(-dt / HYDRAULIC_TAU));
    if (s.estop || s.blocked[j] === 'lmi') s.rates[j] = 0;
    let next = s.joints[j] + s.rates[j] * dt;
    const lim: [number, number] = j === 'extension' ? [0, spec.maxExtension] : spec.limits[j];
    if (next <= lim[0] || next >= lim[1]) {
      if (cmd !== 0) s.blocked[j] = s.blocked[j] ?? 'limit';
      next = clamp(next, lim[0], lim[1]);
      s.rates[j] = 0;
    }
    // Collision: refuse motion that pushes a boom into (or deeper into) an object.
    if (hasColliders && next !== s.joints[j]) {
      const probe = { ...s.joints, [j]: next };
      const c = boomClearance(spec, world, probe);
      if (c.clearance < 0.02 && c.clearance < clearanceNow.clearance - 1e-5) {
        s.blocked[j] = 'collision';
        s.contact = c.name;
        s.rates[j] = 0;
        next = s.joints[j];
        pushEvent(s, 'error', 'boom-collision', c.name ?? undefined);
      } else {
        clearanceNow = c;
      }
    }
    s.joints[j] = next;
  }

  const k = craneKinematics(spec, world.base, s.joints);
  s.pivot = k.pivot; s.knuckle = k.knuckle; s.tip = k.tip;

  // Hook / load pendulum (position-based): integrate, project onto the rope sphere.
  const L = ropeLength(spec, s.load);
  const prev = { ...s.hook };
  const v = s.hookVelocity;
  const damp = Math.exp(-SWING_DAMPING * dt);
  v.x *= damp; v.z *= damp; v.y = v.y * damp - GRAVITY * dt;
  let p = add(s.hook, scale(v, dt));
  const d = sub(p, s.tip);
  const dl = len(d);
  if (dl > L) p = add(s.tip, scale(d, L / dl));

  const load = s.load;
  if (load?.attached) {
    const [w, h, dd] = load.def.size;
    // Lateral strike: the swinging load runs into a solid object → stop horizontally.
    const hit = overlapping(world.colliders, { x: p.x - w / 2, y: p.y - h, z: p.z - dd / 2 }, { x: p.x + w / 2, y: p.y, z: p.z + dd / 2 });
    if (hit) {
      const impact = Math.hypot(p.x - prev.x, p.z - prev.z) / Math.max(dt, 1e-4);
      if (impact > 0.25) pushEvent(s, 'error', 'load-strike', hit.name);
      s.contact = hit.name;
      p = { x: prev.x, y: Math.max(p.y, prev.y), z: prev.z };
      v.x = 0; v.z = 0;
    }
    const support = supportHeight(world, p.x, p.z, w / 2, dd / 2, prev.y - h);
    if (p.y - h <= support.y) {
      const impact = -(p.y - prev.y) / Math.max(dt, 1e-4);
      if (!load.landed && impact > 0.6) pushEvent(s, 'error', 'hard-landing', impact.toFixed(2));
      p = { x: prev.x, y: support.y + h, z: prev.z };
      load.landed = true;
    } else if (load.landed && p.y - h > support.y + 0.02) {
      load.landed = false;
      pushEvent(s, 'info', 'load-lifted');
    }
  } else {
    const hit = overlapping(world.colliders, { x: p.x - HOOK_RADIUS, y: p.y - HOOK_RADIUS, z: p.z - HOOK_RADIUS }, { x: p.x + HOOK_RADIUS, y: p.y + HOOK_RADIUS, z: p.z + HOOK_RADIUS });
    if (hit) { p = { x: prev.x, y: Math.max(p.y, prev.y), z: prev.z }; v.x = 0; v.z = 0; s.contact = hit.name; }
    const support = supportHeight(world, p.x, p.z, HOOK_RADIUS, HOOK_RADIUS, prev.y);
    if (p.y < support.y + 0.05) p = { ...p, y: support.y + 0.05 };
  }
  s.hookVelocity = scale(sub(p, prev), 1 / Math.max(dt, 1e-4));
  if (load?.attached && load.landed) s.hookVelocity = { x: 0, y: 0, z: 0 };
  s.hook = p;
  if (load?.attached) {
    load.position = { x: p.x, y: p.y - load.def.size[1], z: p.z };
    load.velocity = { ...s.hookVelocity };
  }

  const rope = sub(s.tip, s.hook);
  s.swing = Math.acos(clamp(rope.y / Math.max(len(rope), 1e-6), -1, 1));

  s.radius = Math.hypot(s.hook.x - world.base.x, s.hook.z - world.base.z);
  s.momentKgM = moment;
  s.lmiPercent = lmiPercentFor(spec, moment, loadKg);
  const prevState = s.lmiState;
  s.lmiState = s.lmiPercent >= 100 ? 'limit' : s.lmiPercent >= 90 ? 'warn' : 'ok';
  if (s.lmiState === 'limit' && prevState !== 'limit') pushEvent(s, 'error', 'lmi-limit', s.lmiPercent.toFixed(0));
  else if (s.lmiState === 'warn' && prevState === 'ok') pushEvent(s, 'warn', 'lmi-warn', s.lmiPercent.toFixed(0));
  return s;
}

export function hookOn(spec: CraneSpec, s: CraneState): boolean {
  const load = s.load;
  if (!load || load.attached) return false;
  const lift = { x: load.position.x, y: load.position.y + load.def.size[1], z: load.position.z };
  const dist = len(sub(s.hook, lift));
  if (dist > HOOK_ON_RANGE) { pushEvent(s, 'warn', 'hook-too-far', dist.toFixed(2)); return false; }
  load.attached = true;
  load.landed = true;
  s.hook = lift;
  s.hookVelocity = { x: 0, y: 0, z: 0 };
  pushEvent(s, 'info', 'hooked-on', `${load.def.id}:${spec.model}`);
  return true;
}

export function hookOff(spec: CraneSpec, s: CraneState): boolean {
  const load = s.load;
  if (!load?.attached) return false;
  if (!load.landed) { pushEvent(s, 'error', 'release-suspended'); return false; }
  load.attached = false;
  s.hook = add(s.tip, { x: 0, y: -spec.hookLink, z: 0 });
  s.hookVelocity = { x: 0, y: 0, z: 0 };
  pushEvent(s, 'info', 'released', load.def.id);
  return true;
}

export function isStowed(s: CraneState): boolean {
  const dSlew = Math.atan2(Math.sin(s.joints.slew - STOWED_POSE.slew), Math.cos(s.joints.slew - STOWED_POSE.slew));
  return Math.abs(s.joints.main - STOWED_POSE.main) < 5 * DEG
    && Math.abs(s.joints.outer - STOWED_POSE.outer) < 6 * DEG
    && s.joints.extension < 0.05
    && Math.abs(dSlew) < 6 * DEG;
}
