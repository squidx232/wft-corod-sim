import * as THREE from 'three';
import { MeshKit } from './meshKit';

/**
 * Articulated MG-unit console operator (≈1.78 u ≈ 1.78 m tall) in a Weatherford
 * red FR coverall with reflective tape, hard hat, safety glasses and gloves.
 *
 * Local space: feet on Y = 0, facing +X (toward the console and the well),
 * +Z is the operator's RIGHT. Animation is procedural:
 *  - always: breathing, weight shifts, natural head/eye saccades;
 *  - RIH: leans in, left hand pushes the joystick, gaze mostly on the injector/well,
 *    glancing at the gauges; right hand rides the squeeze lever;
 *  - POOH: more upright, pulls the joystick back, gaze mostly on the reel
 *    (watching the rod spool on), glancing at the well and gauges;
 *  - alarm: tense forward posture, rapid gauge ↔ well checks, hand on squeeze;
 *  - idle: relaxed, looks around the lease, occasionally adjusts his hard hat.
 */

export type OperatorActivity = 'idle' | 'rih' | 'pooh';

export interface OperatorAnchors {
  /** Object at the joystick knob (left-hand grip target). */
  joystickHandle: THREE.Object3D;
  /** Object at the squeeze-pressure ball lever (right-hand target). */
  squeezeLever: THREE.Object3D;
  /** Object on the gauge panel (gaze target). */
  gauges: THREE.Object3D;
  /** World-space gaze targets. */
  well: THREE.Vector3;
  reel: THREE.Vector3;
}

export interface OperatorFrame {
  /** Seconds. */
  time: number;
  /** Seconds since the last frame. */
  delta: number;
  activity: OperatorActivity;
  /** 0..1 rod speed relative to full speed. */
  speedRatio: number;
  alarm: boolean;
  engineOn: boolean;
}

export interface OperatorCharacter {
  root: THREE.Group;
  update(frame: OperatorFrame): void;
}

export const DOWN = new THREE.Vector3(0, -1, 0);
export const UPPER_ARM = 0.31;
export const FOREARM = 0.3; // elbow → palm centre

/** Deterministic pseudo-random in [0, 1) from an integer slot. */
export function hash(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Frame-rate independent exponential smoothing factor. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/**
 * Two-bone IK in the chest's space: orients `shoulder` (upper arm hangs along
 * its −Y) and `elbow` (forearm along −Y) so the palm reaches `target`, with
 * the elbow bending toward `pole`. Unreachable targets fully extend the arm.
 */
export function solveArm(shoulder: THREE.Group, elbow: THREE.Group, target: THREE.Vector3, pole: THREE.Vector3) {
  const toTarget = target.clone().sub(shoulder.position);
  const dir = toTarget.clone().normalize();
  const d = THREE.MathUtils.clamp(toTarget.length(), Math.abs(UPPER_ARM - FOREARM) + 1e-3, UPPER_ARM + FOREARM - 1e-3);
  const cosA = THREE.MathUtils.clamp((UPPER_ARM ** 2 + d ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-8) perp = new THREE.Vector3(-1, 0, 0);
  perp.normalize();
  const elbowPos = dir.clone().multiplyScalar(cosA * UPPER_ARM).addScaledVector(perp, sinA * UPPER_ARM);
  shoulder.quaternion.setFromUnitVectors(DOWN, elbowPos.clone().normalize());
  const forearm = dir.clone().multiplyScalar(d).sub(elbowPos).normalize();
  forearm.applyQuaternion(shoulder.quaternion.clone().invert());
  elbow.quaternion.setFromUnitVectors(DOWN, forearm);
}

/**
 * Reusable worker rig builder: constructs the body hierarchy and returns joint groups.
 * `look` controls appearance: coverall colour, hard-hat colour, optional hi-vis vest.
 */
export interface WorkerRigLook {
  coverallColour?: number; // default 0xb3132b (Weatherford red)
  hatColour?: number; // default 0xf4f4f2 (white)
  hiVisVest?: boolean; // default false
}

export interface WorkerRig {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  torso: THREE.Mesh;
  neck: THREE.Group;
  head: THREE.Group;
  legs: Array<{ hip: THREE.Group; knee: THREE.Group }>;
  arms: Array<{ shoulder: THREE.Group; elbow: THREE.Group; pole: THREE.Vector3 }>;
}

export function buildWorkerRig(kit: MeshKit, look: WorkerRigLook = {}): WorkerRig {
  const { mat, box, cyl } = kit;
  const coverallCol = look.coverallColour ?? 0xb3132b;
  const hatCol = look.hatColour ?? 0xf4f4f2;
  const coverall = mat(coverallCol, 0.85, 0.05);
  const coverallDark = mat((coverallCol >> 1) & 0x7f7f7f, 0.85, 0.05);
  const tape = mat(0xdfe3e8, 0.35, 0.6, 0x9aa0a6, 0.25);
  const glove = mat(0x2b2d31, 0.9, 0.05);
  const boot = mat(0x3b2a1a, 0.8, 0.1);
  const sole = mat(0x111111, 0.95, 0.0);
  const skin = mat(0xc99a7a, 0.75, 0.0);
  const belt = mat(0x1f1f1f, 0.7, 0.3);
  const hivis = mat(look.hiVisVest ? 0xccff00 : 0, 0.7, 0.1);

  const capsule = (parent: THREE.Object3D, radius: number, length: number, material: THREE.Material,
    x: number, y: number, z: number, scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), material);
    mesh.position.set(x, y, z);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const band = (parent: THREE.Object3D, radius: number, height: number, y: number, scale?: [number, number, number]) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16, 1, true), tape);
    mesh.position.y = y;
    if (scale) mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };

  const root = new THREE.Group();
  root.name = 'WorkerCharacter';

  // --- Pelvis / legs
  const hips = new THREE.Group();
  hips.position.y = 0.93;
  root.add(hips);
  const pelvis = capsule(hips, 0.13, 0.1, coverall, 0, 0, 0, [0.78, 1, 1]);
  pelvis.rotation.x = Math.PI / 2;
  const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.055, 18), belt);
  beltMesh.position.y = 0.08;
  beltMesh.scale.set(0.8, 1, 1.05);
  hips.add(beltMesh);

  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(0, -0.02, side * 0.1);
    hips.add(hip);
    capsule(hip, 0.075, 0.3, coverall, 0, -0.22, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);
    capsule(knee, 0.062, 0.3, coverall, 0, -0.21, 0);
    band(knee, 0.064, 0.045, -0.2);
    band(knee, 0.064, 0.045, -0.28);
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;
    knee.add(ankle);
    box(ankle, 0.27, 0.1, 0.115, boot, 0.05, 0.03, 0);
    box(ankle, 0.29, 0.025, 0.125, sole, 0.05, -0.03, 0, false);
    return { hip, knee };
  });

  // --- Spine / chest
  const spine = new THREE.Group();
  spine.position.y = 0.05;
  hips.add(spine);
  const torso = capsule(spine, 0.16, 0.3, coverall, 0, 0.25, 0, [0.72, 1, 1.05]);
  band(spine, 0.163, 0.05, 0.16, [0.72, 1, 1.05]);
  box(spine, 0.01, 0.42, 0.025, coverallDark, 0.116, 0.24, 0, false);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), coverallDark);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.49;
  spine.add(collar);

  // Hi-vis vest if requested
  if (look.hiVisVest) {
    const vest = capsule(spine, 0.165, 0.32, hivis, 0, 0.26, 0, [0.75, 1.02, 1.08]);
    vest.position.z -= 0.01; // slight offset to sit on top
  }

  box(spine, 0.03, 0.09, 0.05, belt, 0.12, 0.33, 0.09, false); // radio

  // --- Neck / head
  const neck = new THREE.Group();
  neck.position.y = 0.5;
  spine.add(neck);
  cyl(neck, 0.05, 0.09, skin, 0, 0.04, 0, 'y', 12);
  const head = new THREE.Group();
  head.position.y = 0.08;
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), skin);
  skull.position.y = 0.11;
  skull.scale.set(1.0, 1.15, 0.9);
  skull.castShadow = true;
  head.add(skull);
  box(head, 0.035, 0.04, 0.03, skin, 0.105, 0.1, 0, false);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), skin);
    ear.position.set(0, 0.11, side * 0.095);
    ear.scale.set(0.6, 1, 0.4);
    head.add(ear);
  }
  box(head, 0.02, 0.035, 0.185, mat(0x1b2530, 0.1, 0.6), 0.093, 0.135, 0, false);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(hatCol, 0.35, 0.15));
  shell.position.set(0, 0.175, 0);
  shell.scale.set(1.12, 0.92, 1.0);
  shell.castShadow = true;
  head.add(shell);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.152, 0.014, 22), mat(hatCol, 0.35, 0.15));
  brim.position.set(0.035, 0.178, 0);
  brim.scale.set(1.15, 1, 1);
  head.add(brim);

  // --- Arms
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 0.44, side * 0.2);
    spine.add(shoulder);
    capsule(shoulder, 0.056, 0.2, coverall, 0, -0.15, 0);
    band(shoulder, 0.058, 0.04, -0.2);
    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM;
    shoulder.add(elbow);
    capsule(elbow, 0.048, 0.18, coverall, 0, -0.13, 0);
    band(elbow, 0.05, 0.035, -0.17);
    const hand = new THREE.Group();
    hand.position.y = -FOREARM + 0.04;
    elbow.add(hand);
    box(hand, 0.06, 0.1, 0.085, glove, 0, -0.03, 0);
    capsule(hand, 0.02, 0.05, glove, 0.03, -0.06, side * 0.035); // thumb
    // Index finger for pointing
    capsule(hand, 0.008, 0.055, glove, -0.015, -0.08, side * 0.025);
    return { shoulder, elbow, pole: new THREE.Vector3(-0.35, -1, side * 0.75).normalize() };
  });

  return { root, hips, spine, torso, neck, head, legs, arms };
}

export function createOperatorCharacter(kit: MeshKit, anchors: OperatorAnchors): OperatorCharacter {
  const { mat, signTexture } = kit;
  const rig = buildWorkerRig(kit, {});
  const root = rig.root;
  root.name = 'MGConsoleOperator';
  const { hips, spine, torso, neck, head, legs } = rig;
  const [leftArm, rightArm] = rig.arms;

  // Add Weatherford logos (console operator only)
  const chestLogo = signTexture([{ text: 'Weatherford', color: '#ffffff', size: 92 }], '#b3132b', 512, 160);
  const logoMat = new THREE.MeshStandardMaterial({ map: chestLogo, roughness: 0.85, transparent: false });
  const chestPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.047), logoMat);
  chestPlane.position.set(0.119, 0.36, -0.075);
  chestPlane.rotation.y = Math.PI / 2;
  spine.add(chestPlane);
  const backLogo = signTexture([{ text: 'WEATHERFORD', color: '#ffffff', size: 84 }], '#b3132b', 768, 160);
  const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.063), new THREE.MeshStandardMaterial({ map: backLogo, roughness: 0.85 }));
  backPlane.position.set(-0.119, 0.32, 0);
  backPlane.rotation.y = -Math.PI / 2;
  spine.add(backPlane);

  // --- Animation state ------------------------------------------------------------
  const gaze = new THREE.Vector3();
  const gazeTarget = new THREE.Vector3();
  const leftHand = new THREE.Vector3();
  const rightHand = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let initialised = false;
  let yaw = 0;
  let pitch = 0;
  let lean = 0.04;

  const headWorld = () => head.localToWorld(tmp.set(0, 0.12, 0));

  function chooseGaze(f: OperatorFrame): THREE.Vector3 {
    const gauges = anchors.gauges.getWorldPosition(new THREE.Vector3());
    if (f.alarm) return Math.floor(f.time / 0.8) % 2 ? gauges : anchors.well.clone();
    const slotLength = f.activity === 'idle' ? 3.6 : THREE.MathUtils.lerp(3.2, 1.8, f.speedRatio);
    const slot = Math.floor(f.time / slotLength);
    const r = hash(slot * 3 + (f.activity === 'rih' ? 1 : f.activity === 'pooh' ? 2 : 0));
    if (f.activity === 'rih') return r < 0.65 ? anchors.well.clone() : r < 0.9 ? gauges : anchors.reel.clone();
    if (f.activity === 'pooh') return r < 0.55 ? anchors.reel.clone() : r < 0.8 ? anchors.well.clone() : gauges;
    if (r < 0.3) return gauges;
    if (r < 0.48) return anchors.well.clone();
    if (r < 0.62) return anchors.reel.clone();
    // Look around the lease, within a comfortable arc in front of the operator.
    const a = ((r - 0.62) / 0.38) * 2.6 - 1.3;
    const forward = new THREE.Vector3(Math.cos(a) * 9, -0.6 + hash(slot + 17) * 2.2, Math.sin(a) * 9);
    forward.applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    return headWorld().clone().add(forward);
  }

  function update(f: OperatorFrame) {
    const dt = Math.min(f.delta, 0.1);
    const t = f.time;
    const working = f.activity !== 'idle';

    // Posture: lean into the console when running in, upright when pulling out.
    const targetLean = f.alarm ? 0.17 : f.activity === 'rih' ? 0.12 + 0.04 * f.speedRatio : f.activity === 'pooh' ? 0.06 : 0.03;
    lean += (targetLean - lean) * damp(3, dt);
    const swayAmp = f.alarm ? 0.004 : working ? 0.012 : 0.022;
    const sway = Math.sin(t * 0.45) * swayAmp + Math.sin(t * 1.13) * swayAmp * 0.25;
    hips.position.z = sway;
    hips.rotation.x = -sway * 1.2;
    legs.forEach((leg, i) => {
      leg.hip.rotation.x = sway * 1.2; // keep the feet planted under the shifting hips
      // The unweighted leg relaxes its knee slightly.
      const unweighted = (i === 0 ? -sway : sway) > 0 ? Math.abs(sway) / Math.max(swayAmp, 1e-4) : 0;
      leg.knee.rotation.z = -0.03 - 0.07 * unweighted;
      leg.hip.rotation.z = 0.015 + 0.035 * unweighted;
    });
    const breath = Math.sin(t * (f.alarm ? 2.6 : 1.55));
    torso.scale.set(0.72 * (1 + breath * 0.012), 1 + breath * 0.008, 1.05 * (1 + breath * 0.01));
    spine.rotation.z = -lean + breath * 0.008;
    spine.rotation.y = THREE.MathUtils.clamp(yaw * 0.28, -0.35, 0.35);
    root.updateMatrixWorld(true);

    // Gaze: pick a target per time slot and sweep the head toward it (saccade-like).
    gazeTarget.copy(chooseGaze(f));
    if (!initialised) gaze.copy(gazeTarget);
    gaze.lerp(gazeTarget, damp(f.alarm ? 9 : 4.5, dt));
    // Measure gaze in the (untwisted) hip frame, relative to the neck base, so the
    // chest twist below doesn't feed back into the yaw estimate.
    const local = hips.worldToLocal(gaze.clone()).sub(tmp.set(0, spine.position.y + neck.position.y, 0));
    const targetYaw = THREE.MathUtils.clamp(Math.atan2(-local.z, local.x), -1.25, 1.25);
    const targetPitch = THREE.MathUtils.clamp(Math.atan2(local.y - 0.2, Math.hypot(local.x, local.z)), -0.65, 0.55);
    yaw += (targetYaw - yaw) * damp(f.alarm ? 12 : 7, dt);
    pitch += (targetPitch - pitch) * damp(f.alarm ? 12 : 7, dt);
    neck.rotation.y = yaw - spine.rotation.y;
    head.rotation.z = pitch + lean; // undo the chest lean so the eyes stay on target
    root.updateMatrixWorld(true);

    // Hands: left on the joystick (follows its tilt), right on the squeeze lever
    // while working; relaxed at the sides when idle with an occasional hat adjust.
    const leftGoal = f.engineOn || working
      ? anchors.joystickHandle.getWorldPosition(new THREE.Vector3())
      : root.localToWorld(new THREE.Vector3(0.02, 0.84, -0.27));
    let rightGoal: THREE.Vector3;
    if (working || f.alarm) {
      rightGoal = anchors.squeezeLever.getWorldPosition(new THREE.Vector3());
      // Fine squeeze trims: small nudges on the lever, quicker when tense.
      const trim = Math.sin(t * (f.alarm ? 5.0 : 1.7)) * 0.012 + (hash(Math.floor(t / 2.5)) - 0.5) * 0.02;
      rightGoal.add(new THREE.Vector3(trim, 0.03, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())));
    } else {
      const cycle = t % 14;
      rightGoal = cycle > 10.2 && cycle < 11.6
        ? head.localToWorld(new THREE.Vector3(0.15, 0.2, 0.06)) // adjust hard-hat brim
        : root.localToWorld(new THREE.Vector3(0.03 + Math.sin(t * 0.45) * 0.01, 0.84, 0.27));
    }
    if (!initialised) {
      leftHand.copy(leftGoal);
      rightHand.copy(rightGoal);
      initialised = true;
    }
    leftHand.lerp(leftGoal, damp(working ? 14 : 6, dt));
    rightHand.lerp(rightGoal, damp(f.alarm ? 12 : 5, dt));
    solveArm(leftArm.shoulder, leftArm.elbow, spine.worldToLocal(leftHand.clone()), leftArm.pole);
    solveArm(rightArm.shoulder, rightArm.elbow, spine.worldToLocal(rightHand.clone()), rightArm.pole);
  }

  return { root, update };
}
