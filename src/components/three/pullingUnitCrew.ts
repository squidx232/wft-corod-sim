import * as THREE from 'three';
import { createMeshKit } from './meshKit';
import { buildWorkerRig, solveArm, WorkerRig } from './operatorCharacter';
import { EVACUATE } from './floorhandCharacter';
import { PU_CREW_POINTS } from './pullingUnitDetails';

/**
 * Pulling-unit (workover rig) crew working ON the carrier:
 *  - Driller at the rear console working the levers, watching the injector.
 *  - Floorman on the rear work floor: hand signals at the rail, wrench work at the mast foot.
 *  - Roustabout: ground inspections along the carrier, climbs the stairs to help on deck.
 * On evacuation emergencies (same as the WFT floorhand) they climb down the stairs
 * and run to the muster point, then return to their stations once it is clear.
 */
export type CrewActivity = 'rih' | 'pooh' | 'idle';
export interface PullingCrewFrame {
  time: number;
  delta: number;
  activity: CrewActivity;
  speedRatio: number;
  alarm: boolean;
  emergencyId: string | null;
}
export interface PullingCrewOptions {
  groundAt: (x: number, z: number) => number;
  /** World X of the pulling-unit group (mast base). */
  unitX?: number;
  muster?: THREE.Vector3;
  injector?: THREE.Vector3;
}

type Task = 'levers' | 'watch' | 'wrench' | 'inspect' | 'stand';
interface NavNode { pos: THREE.Vector3; face?: THREE.Vector3; deck: boolean }
interface Stop { node: string; task: Task; dur: number }
type Mode = 'work' | 'hold' | 'evac' | 'return';

const SCALE = 1.2;
const STRIDE = 1.3;
const THIGH = 0.44, SHIN = 0.47;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

export function createPullingUnitCrew(scene: THREE.Scene, opts: PullingCrewOptions) {
  const unitX = opts.unitX ?? 16.5;
  const g = opts.groundAt;
  const P = PU_CREW_POINTS;
  const deckY = P.deckY;
  /** Truck-local → world (truck is rotated π inside the pulling-unit group). */
  const tw = (x: number, y: number, z: number) => new THREE.Vector3(unitX - x, y, -z);
  const ground = (x: number, z: number) => new THREE.Vector3(x, g(x, z), z);
  const injector = opts.injector ?? new THREE.Vector3(9, 10, 0);
  const muster = opts.muster ?? new THREE.Vector3(-13.8, 0, 17.1);
  const st = P.stairs;
  const stairTop = tw(st.x, deckY, st.topZ + 0.2);
  const stairBottom = tw(st.x, 0, st.bottomZ - 0.15);
  stairBottom.y = g(stairBottom.x, stairBottom.z);

  const nodes: Record<string, NavNode> = {
    driller: { pos: tw(1.65, deckY, 0.6), face: tw(2.4, 3.0, 0.6), deck: true },
    rail: { pos: tw(2.62, deckY, -0.85), face: injector, deck: true },
    mastFoot: { pos: tw(1.45, deckY, -0.72), face: new THREE.Vector3(unitX - 0.9, deckY + 0.35, 0.9), deck: true },
    deckHelp: { pos: tw(2.45, deckY, -0.25), face: injector, deck: true },
    stairTop: { pos: stairTop, deck: true },
    stairBottom: { pos: stairBottom, deck: false },
    groundRear: { pos: ground(unitX - 1.9, 2.75), face: new THREE.Vector3(unitX - 1.9, 1.0, 1.9), deck: false },
    groundSide: { pos: ground(unitX + 3.1, 2.75), face: new THREE.Vector3(unitX + 3.1, 1.25, 1.6), deck: false },
    laneOut: { pos: ground(unitX - 3.7, 9.5), deck: false },
  };
  const deckNodes = ['driller', 'rail', 'mastFoot', 'deckHelp', 'stairTop'];
  const edges: Record<string, string[]> = {};
  const link = (a: string, b: string) => { (edges[a] ??= []).push(b); (edges[b] ??= []).push(a); };
  deckNodes.forEach((a, i) => deckNodes.slice(i + 1).forEach(b => link(a, b)));
  link('stairTop', 'stairBottom');
  link('stairBottom', 'groundRear'); link('stairBottom', 'laneOut');
  link('groundRear', 'groundSide'); link('groundRear', 'laneOut'); link('groundSide', 'laneOut');

  const routines: Stop[][] = [
    [{ node: 'driller', task: 'levers', dur: Infinity }],
    [{ node: 'rail', task: 'watch', dur: 9 }, { node: 'mastFoot', task: 'wrench', dur: 11 }],
    [{ node: 'groundRear', task: 'inspect', dur: 9 }, { node: 'groundSide', task: 'inspect', dur: 10 },
      { node: 'deckHelp', task: 'watch', dur: 8 }],
  ];
  const looks = [
    { coverallColour: 0xef6c16, hatColour: 0xffffff },
    { coverallColour: 0xef6c16, hatColour: 0xf5c542 },
    { coverallColour: 0xef6c16, hatColour: 0xf5c542 },
  ];
  const names = ['driller', 'floorman', 'roustabout'];

  const root = new THREE.Group();
  root.name = 'PullingUnitCrew';
  const kit = createMeshKit();

  function route(from: string, to: string): string[] {
    if (from === to) return [];
    const prev: Record<string, string> = { [from]: from };
    const q = [from];
    while (q.length) {
      const n = q.shift()!;
      for (const m of edges[n] ?? []) {
        if (prev[m]) continue;
        prev[m] = n;
        if (m === to) { const path = [m]; let c = n; while (c !== from) { path.unshift(c); c = prev[c]; } return path; }
        q.push(m);
      }
    }
    return [to];
  }

  const members = routines.map((routine, i) => {
    const rig = buildWorkerRig(kit, looks[i]);
    rig.root.name = names[i];
    rig.root.scale.setScalar(SCALE);
    if (i === 1) {
      const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.42), kit.mat(0x777d83, 0.4, 0.8));
      wrench.name = 'Wrench';
      rig.arms[1].elbow.add(wrench);
      wrench.position.set(0.3, 0, 0);
    }
    if (i === 0) {
      const radio = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.03), kit.mat(0x111111));
      radio.position.set(0.14, 0.18, -0.12);
      rig.spine.add(radio);
    }
    // Background workers: lighter capsule tessellation.
    rig.root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const old = m.geometry;
      if (old instanceof THREE.CapsuleGeometry) {
        m.geometry = new THREE.CapsuleGeometry(old.parameters.radius, old.parameters.height, 2, 6);
        old.dispose();
      }
    });
    const start = nodes[routine[0].node];
    rig.root.position.copy(start.pos);
    root.add(rig.root);
    const musterSpot = muster.clone().add(new THREE.Vector3(i * 0.95, 0, i * 0.55));
    musterSpot.y = g(musterSpot.x, musterSpot.z);
    return {
      rig, routine, idx: i, stop: 0, stopTime: 0, at: routine[0].node as string,
      path: [] as string[], segFrom: start.pos.clone(), mode: 'work' as Mode,
      gait: 0, walkBlend: 0, crouch: 0, lean: 0, yaw: 0, pitch: 0, musterSpot,
      hands: [new THREE.Vector3(), new THREE.Vector3()], handsInit: false,
    };
  });
  scene.add(root);

  // Scratch objects (update runs every frame).
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _goal = [new THREE.Vector3(), new THREE.Vector3()];
  const nodePos = (m: typeof members[number], name: string) => (name === 'muster' ? m.musterSpot : nodes[name].pos);

  let emergencyKey: string | null = null;
  let emergencyStart = 0;

  function stepLocomotion(m: typeof members[number], dt: number, running: boolean): boolean {
    const r = m.rig.root;
    if (!m.path.length) return false;
    const target = nodePos(m, m.path[0]);
    const dx = target.x - r.position.x, dz = target.z - r.position.z;
    const dist = Math.hypot(dx, dz);
    const heading = Math.atan2(-dz, dx);
    if (dist > 0.05) r.rotation.y += wrap(heading - r.rotation.y) * damp(7, dt);
    const facing = Math.abs(wrap(heading - r.rotation.y));
    const speed = (running ? 1.75 : 1.05) * SCALE * (facing < 0.9 ? 1 : 0.2);
    const step = Math.min(dist, speed * dt);
    if (dist > 1e-4) { r.position.x += (dx / dist) * step; r.position.z += (dz / dist) * step; }
    // Height follows the segment (stairs) or the terrain.
    const total = Math.hypot(target.x - m.segFrom.x, target.z - m.segFrom.z);
    const f = total > 1e-3 ? 1 - Math.hypot(target.x - r.position.x, target.z - r.position.z) / total : 1;
    const fromDeck = m.at !== 'muster' && nodes[m.at].deck;
    const toDeck = m.path[0] !== 'muster' && nodes[m.path[0]].deck;
    r.position.y = fromDeck && toDeck ? deckY
      : fromDeck !== toDeck ? THREE.MathUtils.lerp(m.segFrom.y, target.y, THREE.MathUtils.clamp(f, 0, 1)) // stairs
      : g(r.position.x, r.position.z);
    m.gait += (step / (STRIDE * SCALE)) * Math.PI * 2;
    if (dist - step < 0.03) {
      m.at = m.path.shift()!;
      m.segFrom.copy(nodePos(m, m.at));
      r.position.x = m.segFrom.x; r.position.z = m.segFrom.z; r.position.y = m.segFrom.y;
    }
    return true;
  }

  function goTo(m: typeof members[number], dest: string) {
    // Finish the current segment first so paths never cut across the carrier;
    // the muster point is only reached via the service lane (down the stairs).
    const head = m.path.length ? m.path[0] : null;
    const from = head ?? m.at;
    if (from === dest) { m.path = head ? [head] : []; return; }
    const target = dest === 'muster' ? 'laneOut' : dest;
    const rest = from === 'muster' ? ['laneOut', ...route('laneOut', target)] : route(from, target);
    if (dest === 'muster') rest.push('muster');
    m.path = head ? [head, ...rest] : rest;
  }

  function look(m: typeof members[number], target: THREE.Vector3, dt: number, k = 5) {
    const r = m.rig;
    const l = r.root.worldToLocal(_v.copy(target));
    const yaw = THREE.MathUtils.clamp(Math.atan2(-l.z, l.x), -1.2, 1.2);
    const pitch = THREE.MathUtils.clamp(Math.atan2(l.y - 1.55, Math.hypot(l.x, l.z)), -0.7, 0.55);
    m.yaw += (yaw - m.yaw) * damp(k, dt);
    m.pitch += (pitch - m.pitch) * damp(k, dt);
    r.neck.rotation.y = m.yaw * 0.8;
    r.spine.rotation.y = m.yaw * 0.2;
    r.head.rotation.z = m.pitch;
  }

  function face(m: typeof members[number], target: THREE.Vector3, dt: number) {
    const r = m.rig.root;
    const heading = Math.atan2(-(target.z - r.position.z), target.x - r.position.x);
    r.rotation.y += wrap(heading - r.rotation.y) * damp(4, dt);
  }

  function poseLegs(rig: WorkerRig, m: typeof members[number], stairs: boolean) {
    const swing = Math.sin(m.gait) * 0.45 * m.walkBlend;
    // Crouch: hip forward a, knee back b with the foot kept under the hip.
    const a = 0.6 * m.crouch;
    const b = a > 1e-3 ? a - Math.asin(THREE.MathUtils.clamp(-(THIGH * Math.sin(a)) / SHIN, -1, 1)) : 0;
    const crouchDrop = (THIGH + SHIN) - (THIGH * Math.cos(a) + SHIN * Math.cos(a - b));
    rig.hips.position.y = 0.93 - crouchDrop + Math.abs(Math.sin(m.gait)) * 0.02 * m.walkBlend;
    rig.legs.forEach((leg, j) => {
      const s = j === 0 ? swing : -swing;
      const lift = stairs ? 0.35 * m.walkBlend : 0;
      leg.hip.rotation.z = a + s + Math.max(0, s) * lift;
      leg.knee.rotation.z = -b - Math.max(0, -s) * 0.9 - Math.max(0, s) * lift * 1.4;
    });
  }

  function update(frame: PullingCrewFrame) {
    const dt = Math.min(frame.delta, 0.1);
    const t = frame.time;
    const key = frame.emergencyId ?? (frame.alarm ? 'alarm' : null);
    if (key !== emergencyKey) { emergencyKey = key; emergencyStart = t; }
    const since = t - emergencyStart;
    const evacDelay = frame.emergencyId ? EVACUATE[frame.emergencyId] : undefined;
    const working = frame.activity !== 'idle';

    for (const m of members) {
      const rig = m.rig, r = rig.root;
      const stopDef = m.routine[m.stop];
      // --- Mode transitions -------------------------------------------------------
      if (evacDelay !== undefined && since > evacDelay + m.idx * 0.6) {
        if (m.mode !== 'evac') { m.mode = 'evac'; goTo(m, 'muster'); }
      } else if (key) {
        if (m.mode === 'work') { m.mode = 'hold'; }
      } else if (m.mode === 'evac' || m.mode === 'hold') {
        m.mode = m.mode === 'evac' ? 'return' : 'work';
        if (m.mode === 'return') goTo(m, stopDef.node);
        m.stopTime = t;
      }
      if (m.mode === 'work' && !m.path.length && m.at !== stopDef.node) goTo(m, stopDef.node);
      if (m.mode === 'work' && !m.path.length && t - m.stopTime > stopDef.dur) {
        m.stop = (m.stop + 1) % m.routine.length;
        m.stopTime = t;
        goTo(m, m.routine[m.stop].node);
      }
      if (m.mode === 'hold' && m.path.length > 1) m.path.length = 1; // stop at the next node

      // --- Locomotion ---------------------------------------------------------------
      const onStairs = (m.at === 'stairTop' && m.path[0] === 'stairBottom') || (m.at === 'stairBottom' && m.path[0] === 'stairTop');
      const moving = stepLocomotion(m, dt, m.mode === 'evac');
      if (!moving && m.mode === 'return' && m.at === stopDef.node) { m.mode = 'work'; m.stopTime = t; }
      m.walkBlend += ((moving ? 1 : 0) - m.walkBlend) * damp(moving ? 8 : 5, dt);

      // --- Task pose ----------------------------------------------------------------
      const here = m.at !== 'muster' ? nodes[m.at] : undefined;
      const task: Task = moving ? 'stand' : m.mode === 'work' && m.at === stopDef.node ? stopDef.task : 'stand';
      const atStation = !moving && m.mode === 'work';
      if (!moving) {
        if (m.mode === 'hold' || m.at === 'muster') face(m, injector, dt);
        else if (here?.face) face(m, here.face, dt);
      }
      const crouchTarget = atStation && task === 'inspect' ? 1 : 0;
      m.crouch += (crouchTarget - m.crouch) * damp(3, dt);
      const leanTarget = moving ? (m.mode === 'evac' ? 0.18 : 0.05) : atStation && task === 'wrench' ? 0.4 : atStation && task === 'inspect' ? 0.35 : atStation && task === 'levers' ? 0.08 : 0.02;
      m.lean += (leanTarget - m.lean) * damp(4, dt);
      rig.spine.rotation.z = -m.lean + Math.sin(t * 1.5 + m.idx) * 0.01;
      poseLegs(rig, m, onStairs);
      r.updateMatrixWorld(true);

      // Gaze
      const gauge = tw(2.3, 3.0, 0.6);
      if (m.mode === 'evac') look(m, m.musterSpot, dt, 6);
      else if (moving && m.path.length) look(m, _w.copy(nodePos(m, m.path[0])).setY(r.position.y + 1.6), dt);
      else if (task === 'levers') look(m, (t % 7) > 5.6 ? gauge : injector, dt, 6);
      else if ((task === 'wrench' || task === 'inspect') && here?.face) look(m, here.face, dt);
      else look(m, injector, dt);
      r.updateMatrixWorld(true);

      // Hands (world goals), smoothed then solved with the shared 2-bone IK.
      const [gl, gr] = _goal;
      const toWorld = (out: THREE.Vector3, x: number, y: number, z: number) => r.localToWorld(out.set(x, y, z));
      if (moving) {
        const sw = Math.sin(m.gait) * (m.mode === 'evac' ? 0.24 : 0.14);
        const y = m.mode === 'evac' ? 1.05 : 0.86;
        toWorld(gl, 0.04 + sw, y, -0.27); toWorld(gr, 0.04 - sw, y, 0.27);
      } else if (m.mode === 'hold' && since < 4.5 && m.at !== 'driller') {
        // E-STOP signal: arms out, palms down, toward the injector.
        toWorld(gl, 0.25, 1.4, -0.72); toWorld(gr, 0.25, 1.4, 0.72);
      } else if (task === 'levers' || (m.mode === 'hold' && m.at === 'driller')) {
        const push = working && m.mode === 'work' ? Math.sin(t * 1.3) * 0.05 : 0;
        gl.copy(tw(2.12 - push, P.leverTopY, P.leverZ[1]));
        gr.copy(tw(2.12 + push * 0.6, P.leverTopY, P.leverZ[0]));
      } else if (task === 'wrench' && here?.face) {
        const ratchet = Math.sin(t * 2.4) * 0.07;
        gl.copy(here.face).add(_v.set(0, 0.05, -0.12));
        gr.copy(here.face).add(_v.set(ratchet, ratchet * 0.6, 0.1));
      } else if (task === 'inspect' && here?.face) {
        toWorld(gl, 0.32, 0.62, -0.2);
        gr.copy(here.face).add(_v.set(Math.sin(t * 0.9) * 0.15, Math.sin(t * 1.7) * 0.05, 0));
      } else if (task === 'watch') {
        // Hand on the rail; signals to the driller while the rod is moving.
        toWorld(gl, 0.3, 0.87, -0.3);
        const signal = working && (t + m.idx * 3) % 6 < 1.6;
        if (signal) toWorld(gr, 0.3, 1.78 + Math.sin(t * 6) * 0.05, 0.3);
        else toWorld(gr, 0.04, 0.84, 0.27);
      } else {
        toWorld(gl, 0.04, 0.84, -0.27); toWorld(gr, 0.04, 0.84, 0.27);
      }
      if (!m.handsInit) { m.hands[0].copy(gl); m.hands[1].copy(gr); m.handsInit = true; }
      m.hands[0].lerp(gl, damp(moving ? 14 : 7, dt));
      m.hands[1].lerp(gr, damp(moving ? 14 : 7, dt));
      rig.arms.forEach((arm, j) => solveArm(arm.shoulder, arm.elbow, rig.spine.worldToLocal(_v.copy(m.hands[j])), arm.pole));
    }
  }

  return {
    root,
    update,
    /** Debug/test helper: current behaviour state per crew member. */
    states: () => members.map(m => ({ name: m.rig.root.name, mode: m.mode, at: m.at, moving: m.path.length > 0 })),
    musterSpots: () => members.map(m => m.musterSpot.clone()),
  };
}
