import {
  FASSI_F215A, CRANE_JOINTS, Collider, CraneInputs, CraneJoint, CraneLoadDef, CraneSpec, CraneState, CraneWorld, Vec3,
  createCraneState, hookOff, hookOn, isStowed, stepCrane,
} from './craneSim';
import { CRANE_TASKS, CraneCheckId, CraneTask } from '../data/craneTasks';

/**
 * Singleton store for the knuckle-crane module. The 3D viewport steps it from
 * its render loop (`step(dt)`); React UI reads throttled snapshots through
 * `subscribe` / `getSnapshot` (useSyncExternalStore).
 */

export interface CraneTaskProgress {
  taskId: string;
  checkIndex: number;
  completed: boolean;
  startedAt: number;
  completedAt: number | null;
  maxLmi: number;
  lmiLimitHits: number;
  hardLandings: number;
  estopUses: number;
  /** Landing accuracy (m from target centre) at release. */
  landingError: number | null;
  /** Max swing angle (deg) while the load was suspended. */
  maxSwingDeg: number;
}

export interface CraneSnapshot {
  version: number;
  active: boolean;
  spec: CraneSpec;
  task: CraneTask;
  state: CraneState;
  inputs: CraneInputs;
  progress: CraneTaskProgress;
  /** Resolved world XZ of the task target. */
  target: { x: number; z: number; radius: number } | null;
  score: number | null;
  /** True once mounted on the truck (base known). */
  mounted: boolean;
}

const zeroInputs = (): CraneInputs => ({ slew: 0, main: 0, outer: 0, extension: 0 });

/**
 * Lever bank order as seen by the operator, LEFT → RIGHT (the real MG station
 * reads pivot, main boom, outer boom, extensions from RIGHT to LEFT).
 */
export const LEVER_ORDER: CraneJoint[] = ['extension', 'outer', 'main', 'slew'];

/**
 * Keyboard map per lever: [lever DOWN key, lever UP key]. Pulling a lever DOWN
 * gives the "+" direction (slew left, booms up, extensions out), as on the MG
 * unit. Keys follow the lever positions: Q/A, W/S, E/D, R/F left → right, the
 * top-row key pushes the lever up, the home-row key pulls it down.
 */
export const CRANE_KEYS: Record<CraneJoint, [string, string]> = {
  extension: ['KeyA', 'KeyQ'],
  outer: ['KeyS', 'KeyW'],
  main: ['KeyD', 'KeyE'],
  slew: ['KeyF', 'KeyR'],
};

class CraneStore {
  readonly spec: CraneSpec = FASSI_F215A;
  private world: CraneWorld = { base: { x: -4.17, y: 1.49, z: 0.94 }, surfaceAt: () => 0 };
  private colliders: Collider[] = [];
  private outriggersRetracted = true;
  private side = -1;
  private task: CraneTask = CRANE_TASKS[1];
  private state: CraneState;
  private progress!: CraneTaskProgress;
  private uiInputs: CraneInputs = zeroInputs();
  private keyInputs: CraneInputs = zeroInputs();
  private inputs: CraneInputs = zeroInputs();
  private keysDown = new Set<string>();
  private listeners = new Set<() => void>();
  private snapshot: CraneSnapshot;
  private version = 0;
  private lastNotify = 0;
  private lastEventCount = 0;
  private mounted = false;
  active = false;

  constructor() {
    this.state = createCraneState(this.spec, this.world, []);
    this.resetProgress();
    this.snapshot = this.buildSnapshot();
  }

  // --- configuration -------------------------------------------------------------
  /** Called by the viewport once the truck model is loaded and the pedestal measured. */
  mount(base: Vec3, surfaceAt: (x: number, z: number) => number) {
    this.world = { base, surfaceAt, colliders: this.colliders };
    // Loads go on the crane's side of the truck (away from the MG console when centred).
    this.side = base.z > 0.3 ? 1 : -1;
    this.mounted = true;
    this.reset();
  }

  /** Solid scene objects (world AABBs). Only those within reach of the crane are kept. */
  setColliders(list: Collider[]) {
    const b = this.world.base;
    const reach = this.spec.pivotOffset + this.spec.mainBoomLength + this.spec.outerBoomLength + this.spec.maxExtension + 2;
    this.colliders = list.filter((c) => {
      const dx = Math.max(c.min.x - b.x, 0, b.x - c.max.x);
      const dz = Math.max(c.min.z - b.z, 0, b.z - c.max.z);
      return Math.hypot(dx, dz) < reach;
    });
    this.world = { ...this.world, colliders: this.colliders };
  }

  /** MG outrigger status (the crane uses the MG unit's outriggers as its stabilizers). */
  setOutriggers(ready: boolean, retracted: boolean) {
    this.state.outriggersReady = ready;
    this.outriggersRetracted = retracted;
  }

  /** Outriggers may only be raised with the crane folded and nothing on the hook. */
  canStowOutriggers(): boolean {
    return isStowed(this.state) && !this.state.load?.attached;
  }

  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    if (!active) { this.uiInputs = zeroInputs(); this.keyInputs = zeroInputs(); this.keysDown.clear(); }
    this.notify(true);
  }

  setTask(id: string) {
    const t = CRANE_TASKS.find((x) => x.id === id);
    if (!t) return;
    this.task = t;
    this.reset();
  }

  /** Reset crane to stowed, stabilizers in, and re-place the task load. */
  reset() {
    const { powerAvailable, outriggersReady } = this.state;
    this.state = createCraneState(this.spec, this.world, this.task.load ? [this.resolveLoad(this.task)] : []);
    this.state.powerAvailable = powerAvailable;
    this.state.outriggersReady = outriggersReady;
    this.lastEventCount = 0;
    this.resetProgress();
    this.notify(true);
  }

  private resolve(p: { along: number; out: number }) {
    return { x: this.world.base.x + p.along, z: this.world.base.z + this.side * p.out };
  }

  private resolveLoad(task: CraneTask): CraneLoadDef {
    const l = task.load!;
    return { ...l, start: this.resolve(l.start) };
  }

  private resetProgress() {
    this.progress = {
      taskId: this.task.id, checkIndex: 0, completed: false, startedAt: this.state.time, completedAt: null,
      maxLmi: 0, lmiLimitHits: 0, hardLandings: 0, estopUses: 0, landingError: null, maxSwingDeg: 0,
    };
  }

  // --- controls --------------------------------------------------------------------
  setLever(joint: CraneJoint, value: number) {
    this.uiInputs[joint] = Math.max(-1, Math.min(1, value));
  }
  setPowerAvailable(on: boolean) { this.state.powerAvailable = on; }
  toggleEstop() {
    this.state.estop = !this.state.estop;
    if (this.state.estop) this.progress.estopUses++;
    this.notify(true);
  }
  /** Log that the trainee tried to raise the outriggers with the crane unfolded/loaded. */
  noteOutriggerStowBlocked() { this.state.events.push({ t: this.state.time, kind: 'warn', code: 'stab-stow-blocked' }); this.notify(true); }
  hookOn() { const ok = hookOn(this.spec, this.state); this.notify(true); return ok; }
  hookOff() {
    const ok = hookOff(this.spec, this.state);
    const target = this.targetWorld();
    if (ok && target && this.state.load) {
      this.progress.landingError = Math.hypot(this.state.load.position.x - target.x, this.state.load.position.z - target.z);
    }
    this.notify(true);
    return ok;
  }

  /** Keyboard handling (called by the panel's window listeners while active). */
  handleKey(code: string, down: boolean): boolean {
    let handled = false;
    for (const j of CRANE_JOINTS) {
      const [plus, minus] = CRANE_KEYS[j];
      if (code === plus || code === minus) handled = true;
    }
    if (!handled) return false;
    if (down) this.keysDown.add(code); else this.keysDown.delete(code);
    return true;
  }

  // --- simulation -----------------------------------------------------------------
  step(dt: number) {
    if (!this.active) return;
    // Keyboard ramps toward full deflection (≈0.35 s) for a proportional feel.
    for (const j of CRANE_JOINTS) {
      const [plus, minus] = CRANE_KEYS[j];
      const want = (this.keysDown.has(plus) ? 1 : 0) - (this.keysDown.has(minus) ? 1 : 0);
      const k = this.keyInputs[j];
      this.keyInputs[j] = want === 0 ? 0 : k + Math.sign(want - k) * Math.min(Math.abs(want - k), dt / 0.35);
    }
    const pad = readGamepad();
    for (const j of CRANE_JOINTS) {
      const v = this.uiInputs[j] + this.keyInputs[j] + (pad?.[j] ?? 0);
      this.inputs[j] = Math.max(-1, Math.min(1, v));
    }
    stepCrane(this.spec, this.world, this.state, this.inputs, dt);
    this.evaluate();
    this.notify(false);
  }

  private targetWorld() {
    const t = this.task.target;
    if (!t) return null;
    return { ...this.resolve(t), radius: t.radius };
  }

  private checkPassed(id: CraneCheckId): boolean {
    const s = this.state;
    const target = this.targetWorld();
    const load = s.load;
    const onTarget = () => !!(load && target && Math.hypot(load.position.x - target.x, load.position.z - target.z) <= target.radius);
    switch (id) {
      case 'power': return s.powerAvailable;
      case 'stab-deployed': return s.outriggersReady;
      case 'unfolded': return s.joints.main < 60 * Math.PI / 180 && s.joints.outer > -120 * Math.PI / 180;
      case 'slewed': return Math.abs(s.joints.slew) > 60 * Math.PI / 180;
      case 'hooked': return !!load?.attached;
      case 'lifted': return !!load?.attached && !load.landed && load.position.y - this.world.surfaceAt(load.position.x, load.position.z) > 0.3;
      case 'over-target': return !!load?.attached && !load.landed && !!target && Math.hypot(load.position.x - target.x, load.position.z - target.z) <= target.radius * 1.5;
      case 'landed-on-target': return !!load?.attached && load.landed && onTarget();
      case 'released': return !!load && !load.attached && onTarget();
      case 'stowed': return isStowed(s);
      case 'stab-stowed': return this.outriggersRetracted;
    }
  }

  private evaluate() {
    const p = this.progress;
    const s = this.state;
    p.maxLmi = Math.max(p.maxLmi, s.lmiPercent);
    if (s.load?.attached && !s.load.landed) p.maxSwingDeg = Math.max(p.maxSwingDeg, (s.swing * 180) / Math.PI);
    for (let i = this.lastEventCount; i < s.events.length; i++) {
      const e = s.events[i];
      if (e.code === 'lmi-limit') p.lmiLimitHits++;
      if (e.code === 'hard-landing') p.hardLandings++;
    }
    this.lastEventCount = s.events.length;
    if (p.completed) return;
    // Advance through the checklist (several checks may pass in one frame).
    while (p.checkIndex < this.task.checks.length && this.checkPassed(this.task.checks[p.checkIndex])) p.checkIndex++;
    if (p.checkIndex >= this.task.checks.length) {
      p.completed = true;
      p.completedAt = s.time;
      this.notify(true);
    }
  }

  /** 0–100 score: penalties for overloads, hard landings, swing, accuracy, E-STOP and time. */
  private score(): number | null {
    const p = this.progress;
    if (!p.completed) return null;
    const secs = (p.completedAt ?? 0) - p.startedAt;
    let score = 100;
    score -= p.lmiLimitHits * 15;
    score -= p.hardLandings * 10;
    score -= Math.max(0, p.maxSwingDeg - 8) * 1.5;
    if (p.landingError !== null && this.task.target) score -= (p.landingError / this.task.target.radius) * 10;
    score -= p.estopUses * 5;
    score -= Math.max(0, secs - 240) / 12;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // --- React subscription ------------------------------------------------------------
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  };

  getSnapshot = (): CraneSnapshot => this.snapshot;

  /** Read the live (mutable) state directly — for the 3D render loop. */
  get live(): { state: CraneState; world: CraneWorld; task: CraneTask; target: ReturnType<CraneStore['targetWorld']>; mounted: boolean; inputs: CraneInputs } {
    return { state: this.state, world: this.world, task: this.task, target: this.targetWorld(), mounted: this.mounted, inputs: this.inputs };
  }

  private buildSnapshot(): CraneSnapshot {
    const s = this.state;
    return {
      version: this.version,
      active: this.active,
      spec: this.spec,
      task: this.task,
      state: {
        ...s,
        joints: { ...s.joints },
        rates: { ...s.rates },
        blocked: { ...s.blocked },
        load: s.load ? { ...s.load, position: { ...s.load.position } } : null,
        events: s.events.slice(-12),
      },
      inputs: { ...this.inputs },
      progress: { ...this.progress },
      target: this.targetWorld(),
      score: this.score(),
      mounted: this.mounted,
    };
  }

  private notify(force: boolean) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - this.lastNotify < 66) return; // ~15 Hz UI refresh
    this.lastNotify = now;
    this.version++;
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }
}

/** Gamepad: left stick X = slew, left Y = main boom, right Y = outer boom, right X = extension. Stick DOWN = "+" (like pulling a lever down). */
function readGamepad(): Partial<CraneInputs> | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  const pad = Array.from(navigator.getGamepads()).find((g) => g && g.connected);
  if (!pad) return null;
  const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
  return {
    slew: -dz(pad.axes[0] ?? 0),
    main: dz(pad.axes[1] ?? 0),
    outer: dz(pad.axes[3] ?? 0),
    extension: dz(pad.axes[2] ?? 0),
  };
}

export const craneStore = new CraneStore();
