/**
 * Knuckle-boom crane simulation (Fassi F215C-class, as fitted to the CoRod MG
 * unit). Pure TypeScript — no three.js — so it can be unit-tested and reused by
 * other trainers.
 *
 * Coordinate frame: world metres, +Y up. Slew angle 0 points the boom along +X
 * (toward the wellhead); positive slew rotates toward −Z, matching three.js
 * `rotation.y`.
 *
 * Joints (one per lever on the real control bank):
 *  1. slew       — column rotation about Y (rad)
 *  2. main       — inner (main) boom elevation above horizontal (rad)
 *  3. outer      — outer (knuckle) boom angle RELATIVE to the main boom (rad,
 *                  0 = straight in line, negative = folded down/under)
 *  4. extension  — total hydraulic extension of the outer boom (m)
 *
 * Geometry and ratings are representative of the F215C.0.2x class (≈ 21 t·m
 * gross lifting moment, ≈ 10 m hydraulic outreach). They are training values,
 * NOT the manufacturer's load chart — always use the crane's own chart on site.
 */

export interface Vec3 { x: number; y: number; z: number }

export interface CraneSpec {
  model: string;
  /** Slew-axis pivot height above the crane base (column + pedestal), m. */
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
  /** Gross rated lifting moment (load + boom self-weight), kg·m. */
  ratedMomentKgM: number;
  /** Structural maximum hook load regardless of radius, kg. */
  maxLoadKg: number;
  mainBoomMassKg: number;
  outerBoomMassKg: number;
  limits: {
    slew: [number, number];
    main: [number, number];
    outer: [number, number];
  };
  /** Max joint speeds at full lever: rad/s (slew/main/outer), m/s (extension). */
  maxRates: { slew: number; main: number; outer: number; extension: number };
  /** Stabilizer (outrigger) deploy / stow time, s. */
  stabilizerTime: number;
}

const DEG = Math.PI / 180;

export const FASSI_F215C: CraneSpec = {
  model: 'FASSI F215C',
  columnHeight: 1.75,
  pivotOffset: 0.25,
  mainBoomLength: 3.9,
  outerBoomLength: 2.9,
  extensionCount: 3,
  maxExtension: 3.6,
  hookLink: 0.55,
  hookMassKg: 45,
  ratedMomentKgM: 21_000,
  maxLoadKg: 7_000,
  mainBoomMassKg: 650,
  outerBoomMassKg: 520,
  limits: {
    slew: [-200 * DEG, 200 * DEG],
    main: [-12 * DEG, 82 * DEG],
    outer: [-168 * DEG, 18 * DEG],
  },
  maxRates: { slew: 13 * DEG, main: 7 * DEG, outer: 9 * DEG, extension: 0.32 },
  stabilizerTime: 4,
};

/** Transport (stowed) pose: main boom near-vertical, outer boom folded down beside it. */
export const STOWED_POSE = { slew: 0, main: 80 * DEG, outer: -166 * DEG, extension: 0 };

export type CraneJoint = 'slew' | 'main' | 'outer' | 'extension';
export const CRANE_JOINTS: CraneJoint[] = ['slew', 'main', 'outer', 'extension'];

export type CraneInputs = Record<CraneJoint, number>; // each −1..1

export interface CraneLoadDef {
  id: string;
  label: { en: string; ar: string };
  massKg: number;
  /** Box size (x, y, z) m; lift point is at the top centre. */
  size: [number, number, number];
  color: number;
  kind: 'basket' | 'lubricator' | 'injector' | 'block';
  /** Starting XZ position (world); Y comes from the surface. */
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

export type LmiState = 'ok' | 'warn' | 'limit';

export interface CraneEvent { t: number; kind: 'info' | 'warn' | 'error' | 'success'; code: string; detail?: string }

export interface CraneState {
  time: number;
  joints: Record<CraneJoint, number>;
  /** Current joint velocities (after hydraulic lag). */
  rates: Record<CraneJoint, number>;
  /** 0 = stowed, 1 = fully deployed. */
  stabilizers: number;
  stabilizerCommand: 'deploy' | 'stow' | null;
  powerAvailable: boolean;
  estop: boolean;
  /** Hook point (bottom of hook link) — pendulum mass. */
  hook: Vec3;
  hookVelocity: Vec3;
  tip: Vec3;
  knuckle: Vec3;
  pivot: Vec3;
  load: CraneLoad | null;
  /** Horizontal radius from slew axis to hook, m. */
  radius: number;
  momentKgM: number;
  lmiPercent: number;
  lmiState: LmiState;
  /** Joints currently blocked by the LMI or interlocks. */
  blocked: Partial<Record<CraneJoint, 'lmi' | 'stabilizers' | 'power' | 'estop' | 'limit'>>;
  /** Swing angle of the hook/load from vertical, rad. */
  swing: number;
  events: CraneEvent[];
}

export interface CraneWorld {
  /** Crane base (slew axis at the top of the truck deck). */
  base: Vec3;
  /** Height of the supporting surface (ground / truck deck / stand) at x,z. */
  surfaceAt(x: number, z: number): number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);

export interface CraneKinematics { pivot: Vec3; knuckle: Vec3; tip: Vec3; dir: Vec3 }

/** Forward kinematics: slew-axis base → main pivot → knuckle → boom tip. */
export function craneKinematics(spec: CraneSpec, base: Vec3, j: Record<CraneJoint, number>): CraneKinematics {
  const dir = { x: Math.cos(j.slew), y: 0, z: -Math.sin(j.slew) };
  const pivot = add(add(base, { x: 0, y: spec.columnHeight, z: 0 }), scale(dir, spec.pivotOffset));
  const along = (angle: number, length: number): Vec3 => add(scale(dir, Math.cos(angle) * length), { x: 0, y: Math.sin(angle) * length, z: 0 });
  const knuckle = add(pivot, along(j.main, spec.mainBoomLength));
  const tip = add(knuckle, along(j.main + j.outer, spec.outerBoomLength + j.extension));
  return { pivot, knuckle, tip, dir };
}

/** Gross overturning moment about the slew axis (kg·m). */
export function craneMoment(spec: CraneSpec, base: Vec3, j: Record<CraneJoint, number>, hookLoadKg: number, hookRadius?: number): number {
  const k = craneKinematics(spec, base, j);
  const r = (p: Vec3) => Math.hypot(p.x - base.x, p.z - base.z);
  const mainCg = r(scale(add(k.pivot, k.knuckle), 0.5));
  // Outer boom CoG shifts outward as the extensions run out.
  const outerCg = r(add(k.knuckle, scale(sub(k.tip, k.knuckle), 0.55)));
  const hookR = hookRadius ?? r(k.tip);
  return spec.mainBoomMassKg * mainCg + spec.outerBoomMassKg * outerCg + (hookLoadKg + spec.hookMassKg) * hookR;
}

/** Rated hook capacity at a radius (simplified chart), kg. */
export function ratedCapacityAt(spec: CraneSpec, radius: number): number {
  // Boom self-moment at that radius (booms roughly level, fully reaching).
  const selfMoment = (spec.mainBoomMassKg * 0.5 + spec.outerBoomMassKg * 0.78) * Math.max(radius, 1);
  return clamp((spec.ratedMomentKgM - selfMoment) / Math.max(radius, 1) - spec.hookMassKg, 0, spec.maxLoadKg);
}

export function createCraneState(spec: CraneSpec, world: CraneWorld, loadDefs: CraneLoadDef[] = []): CraneState {
  const joints = { ...STOWED_POSE };
  const k = craneKinematics(spec, world.base, joints);
  const hook = add(k.tip, { x: 0, y: -spec.hookLink, z: 0 });
  const def = loadDefs[0];
  const load: CraneLoad | null = def
    ? {
        def,
        position: { x: def.start.x, y: world.surfaceAt(def.start.x, def.start.z), z: def.start.z },
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
    stabilizers: 0,
    stabilizerCommand: null,
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
    swing: 0,
    events: [],
  };
}

/** Rope length from boom tip to the swinging mass (hook, or load lift point). */
const ropeLength = (spec: CraneSpec, load: CraneLoad | null) => spec.hookLink + (load?.attached ? SLING_LENGTH : 0);
export const SLING_LENGTH = 1.4;
/** Hook must be within this distance of a load's lift point to hook on. */
export const HOOK_ON_RANGE = 0.6;

const GRAVITY = 9.81;
const HYDRAULIC_TAU = 0.28; // s — valve/flow response lag
const SWING_DAMPING = 0.35; // 1/s — air drag + rope friction

function pushEvent(s: CraneState, kind: CraneEvent['kind'], code: string, detail?: string) {
  const last = s.events[s.events.length - 1];
  if (last && last.code === code && s.time - last.t < 2) return; // de-duplicate bursts
  s.events.push({ t: s.time, kind, code, detail });
  if (s.events.length > 80) s.events.shift();
}

/**
 * Advance the crane one step. Mutates and returns `s`.
 * - Inputs are proportional lever positions (−1..1).
 * - Interlocks: E-STOP, hydraulic power (MG engine + PTO), stabilizers,
 *   joint limits and the load-moment limiter (blocks only moment-INCREASING motion).
 */
export function stepCrane(spec: CraneSpec, world: CraneWorld, s: CraneState, inputs: CraneInputs, dt: number): CraneState {
  dt = clamp(dt, 0, 0.05);
  s.time += dt;
  s.blocked = {};

  // Stabilizers (outriggers) — need hydraulic power too.
  if (s.stabilizerCommand && s.powerAvailable && !s.estop) {
    const dir = s.stabilizerCommand === 'deploy' ? 1 : -1;
    // Can't stow the legs with the boom out of its rest or a load on the hook.
    const stowedBoom = Math.abs(s.joints.main - STOWED_POSE.main) < 4 * DEG && Math.abs(s.joints.outer - STOWED_POSE.outer) < 6 * DEG && s.joints.extension < 0.05;
    if (dir < 0 && (!stowedBoom || s.load?.attached)) {
      pushEvent(s, 'warn', 'stab-stow-blocked');
      s.stabilizerCommand = null;
    } else {
      s.stabilizers = clamp(s.stabilizers + (dir * dt) / spec.stabilizerTime, 0, 1);
      if (s.stabilizers === 1 && dir > 0) { s.stabilizerCommand = null; pushEvent(s, 'info', 'stab-deployed'); }
      if (s.stabilizers === 0 && dir < 0) { s.stabilizerCommand = null; pushEvent(s, 'info', 'stab-stowed'); }
    }
  }

  const loadKg = s.load?.attached && !s.load.landed ? s.load.def.massKg : 0;
  const hookR = Math.hypot(s.hook.x - world.base.x, s.hook.z - world.base.z);
  const moment = craneMoment(spec, world.base, s.joints, loadKg, hookR);

  for (const j of CRANE_JOINTS) {
    let cmd = clamp(inputs[j] ?? 0, -1, 1);
    if (Math.abs(cmd) < 0.04) cmd = 0; // lever dead band
    if (cmd !== 0) {
      if (s.estop) { s.blocked[j] = 'estop'; cmd = 0; }
      else if (!s.powerAvailable) { s.blocked[j] = 'power'; cmd = 0; }
      else if (s.stabilizers < 1) { s.blocked[j] = 'stabilizers'; cmd = 0; }
    }
    const max = spec.maxRates[j];
    let target = cmd * max;
    // LMI: predict the moment after a small move; block if it rises while at/over the limit.
    if (target !== 0 && s.lmiPercent >= 100) {
      const probe = { ...s.joints, [j]: s.joints[j] + Math.sign(target) * 0.01 };
      const after = craneMoment(spec, world.base, probe, loadKg);
      const before = craneMoment(spec, world.base, s.joints, loadKg);
      if (after > before + 1e-6) { s.blocked[j] = 'lmi'; target = 0; }
    }
    // Hydraulic response lag (proportional valve).
    s.rates[j] += (target - s.rates[j]) * (1 - Math.exp(-dt / HYDRAULIC_TAU));
    // E-STOP dumps the valve bank (immediate stop); the LMI cuts the blocked
    // function instantly rather than letting it coast.
    if (s.estop || s.blocked[j] === 'lmi') s.rates[j] = 0;
    let next = s.joints[j] + s.rates[j] * dt;
    const lim: [number, number] = j === 'extension' ? [0, spec.maxExtension] : spec.limits[j];
    if (next <= lim[0] || next >= lim[1]) {
      if (cmd !== 0) s.blocked[j] = s.blocked[j] ?? 'limit';
      next = clamp(next, lim[0], lim[1]);
      s.rates[j] = 0;
    }
    s.joints[j] = next;
  }

  // Kinematics
  const k = craneKinematics(spec, world.base, s.joints);
  s.pivot = k.pivot; s.knuckle = k.knuckle; s.tip = k.tip;

  // Hook / load pendulum: point mass on an inextensible rope from the tip
  // (position-based: integrate, then project back onto the rope sphere).
  const L = ropeLength(spec, s.load);
  const prev = { ...s.hook };
  const v = s.hookVelocity;
  const damp = Math.exp(-SWING_DAMPING * dt);
  v.x *= damp; v.z *= damp; v.y = v.y * damp - GRAVITY * dt;
  let p = add(s.hook, scale(v, dt));
  const d = sub(p, s.tip);
  const dl = len(d);
  if (dl > L) p = add(s.tip, scale(d, L / dl));
  // Surface contact for the swinging mass (hook alone or the load bottom).
  const load = s.load;
  if (load?.attached) {
    const surface = world.surfaceAt(p.x, p.z);
    const bottomY = p.y - load.def.size[1]; // p is the lift point (top centre)
    if (bottomY <= surface) {
      const impact = -(p.y - prev.y) / Math.max(dt, 1e-4);
      if (!load.landed && impact > 0.6) pushEvent(s, 'error', 'hard-landing', impact.toFixed(2));
      p = { x: prev.x, y: surface + load.def.size[1], z: prev.z }; // friction: rests where it touched
      load.landed = true;
    } else if (load.landed && bottomY > surface + 0.02) {
      load.landed = false;
      pushEvent(s, 'info', 'load-lifted');
    }
  } else {
    const surface = world.surfaceAt(p.x, p.z);
    if (p.y < surface + 0.05) p = { ...p, y: surface + 0.05 };
  }
  s.hookVelocity = scale(sub(p, prev), 1 / Math.max(dt, 1e-4));
  if (load?.attached && load.landed) s.hookVelocity = { x: 0, y: 0, z: 0 };
  s.hook = p;
  if (load?.attached) {
    load.position = { x: p.x, y: p.y - load.def.size[1], z: p.z };
    load.velocity = { ...s.hookVelocity };
  }

  // Swing angle from vertical (only meaningful when the rope is taut).
  const rope = sub(s.tip, s.hook);
  s.swing = Math.acos(clamp(rope.y / Math.max(len(rope), 1e-6), -1, 1));

  // LMI
  s.radius = Math.hypot(s.hook.x - world.base.x, s.hook.z - world.base.z);
  s.momentKgM = moment;
  s.lmiPercent = (moment / spec.ratedMomentKgM) * 100;
  if (loadKg > spec.maxLoadKg) s.lmiPercent = Math.max(s.lmiPercent, 101);
  const prevState = s.lmiState;
  s.lmiState = s.lmiPercent >= 100 ? 'limit' : s.lmiPercent >= 90 ? 'warn' : 'ok';
  if (s.lmiState === 'limit' && prevState !== 'limit') pushEvent(s, 'error', 'lmi-limit', s.lmiPercent.toFixed(0));
  else if (s.lmiState === 'warn' && prevState === 'ok') pushEvent(s, 'warn', 'lmi-warn', s.lmiPercent.toFixed(0));
  return s;
}

/** Hook on to the load if the hook is close to its lift point. Returns true on success. */
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

/** Release the load — only allowed when it is resting on a surface (slack rope). */
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

/** True when the crane is back in its transport pose. */
export function isStowed(s: CraneState): boolean {
  return Math.abs(s.joints.main - STOWED_POSE.main) < 4 * DEG
    && Math.abs(s.joints.outer - STOWED_POSE.outer) < 6 * DEG
    && s.joints.extension < 0.05
    && Math.abs(Math.atan2(Math.sin(s.joints.slew), Math.cos(s.joints.slew))) < 5 * DEG;
}
