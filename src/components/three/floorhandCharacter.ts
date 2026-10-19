import * as THREE from 'three';
import { MeshKit } from './meshKit';
import { buildWorkerRig, damp, hash, solveArm, UPPER_ARM, FOREARM, DOWN } from './operatorCharacter';

/**
 * Articulated floorhand (≈1.78 u tall) standing near the wellhead in lime/yellow
 * hi-vis vest over Weatherford red coverall, with a blue hard hat.
 *
 * Local space: feet on Y = 0, facing +X, +Z is RIGHT.
 * Behaviour: procedural, frame-rate independent, deterministic.
 * - Turns body to attend to operator or wellhead; feet stay planted (< 4cm drift except during deliberate turns)
 * - RIH/POOH: watches injector/wellhead; periodically turns to operator and gives ASME B30 hand signals
 * - Idle: hands on hips or sides, looks around, checks wellhead, occasional radio
 * - Alarm: EMERGENCY STOP (arms out, palms down) or H2S evacuation stance
 * - Index finger modelled for pointing
 */

const UP = new THREE.Vector3(0, 1, 0);

export type FloorhandActivity = 'idle' | 'rih' | 'pooh';

export interface FloorhandAnchors {
  /** World-space position where the operator's head is (to face when signalling). */
  operator: THREE.Vector3;
  /** World-space position of the injector (watch when RIH). */
  injector: THREE.Vector3;
  /** World-space position of the wellhead (look down at it occasionally). */
  wellhead: THREE.Vector3;
  /** Engine / power-pack area on the MG unit (engine, overheat, outrigger hazards). */
  engine?: THREE.Vector3;
  /** BOP stack (hydraulic / air leak hazards). */
  bop?: THREE.Vector3;
}

/** Where the floorhand points for each emergency (what he's warning the operator about). */
function hazardPoint(id: string | null, a: FloorhandAnchors): THREE.Vector3 {
  switch (id) {
    case 'emg-engine':
    case 'emg-overheat':
    case 'emg-outrigger':
      return a.engine ?? a.operator;
    case 'emg-blowout':
      return a.wellhead;
    case 'emg-hydraulic':
    case 'emg-bopair':
      return a.bop ?? a.wellhead;
    case 'emg-lightning':
    case 'emg-wind':
      // Point up at the injector/mast — the elevated load at risk.
      return a.injector.clone().add(new THREE.Vector3(0, 4, 0));
    default:
      // Rod slip / free-fall / charge / chain / overpull: at the injector.
      return a.injector;
  }
}

export interface FloorhandFrame {
  time: number; // seconds
  delta: number; // seconds since last frame
  activity: FloorhandActivity;
  speedRatio: number; // 0..1, higher = more frequent checks/signals
  /** Alarm horn / slip alarm sounding. */
  alarm: boolean;
  /** Active emergency scenario id (injected or drill), e.g. 'emg-h2s'. Any non-null id triggers a reaction. */
  emergencyId: string | null;
}

export interface FloorhandCharacter {
  root: THREE.Group;
  update(frame: FloorhandFrame): void;
}

export function createFloorhandCharacter(kit: MeshKit, anchors: FloorhandAnchors): FloorhandCharacter {
  // Build the base rig: Weatherford red coverall, blue hard hat, hi-vis vest
  const rig = buildWorkerRig(kit, {
    coverallColour: 0xb3132b, // Weatherford red
    hatColour: 0x1e3a8a, // Blue
    hiVisVest: true, // Lime/yellow vest
  });

  const root = rig.root;
  root.name = 'FloorhandCharacter';
  const { hips, spine, torso, neck, head, legs } = rig;
  const [leftArm, rightArm] = rig.arms;

  // Animation state
  const gaze = new THREE.Vector3();
  const gazeTarget = new THREE.Vector3();
  const leftHand = new THREE.Vector3();
  const rightHand = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let initialised = false;
  let yaw = 0;
  let pitch = 0;
  let bodYaw = 0; // body rotation around Y
  let signalPhase = 0; // 0..1 for animated signal phases
  let signalCycle = 0; // timer for signal cycles
  let lastSignalTime = 0;
  let workSignalActive = false;
  // Emergency reaction state: when it started and for which emergency.
  let emergencyKey: string | null = null;
  let emergencyStart = 0;
  let pointing = false; // a LOWER/HOIST signal is in progress (persists across frames)

  /** Hips yaw (relative to the root) that faces a world point; rig faces local +X. */
  const yawToward = (p: THREE.Vector3) => {
    const l = root.worldToLocal(p.clone());
    return Math.atan2(-l.z, l.x);
  };
  /** Ease the body yaw toward `target`, taking the shortest way round. */
  const turnBody = (target: number, rate: number, dt: number) => {
    const diff = Math.atan2(Math.sin(target - bodYaw), Math.cos(target - bodYaw));
    bodYaw += diff * damp(rate, dt);
  };

  const headWorld = () => head.localToWorld(tmp.set(0, 0.12, 0));

  function chooseGaze(f: FloorhandFrame): THREE.Vector3 {
    if (f.alarm && pointing) return hazardPoint(f.emergencyId, anchors).clone();
    if (f.alarm) {
      // In alarm, face the operator
      return anchors.operator.clone();
    }
    
    const slotLength = f.activity === 'idle' ? 4 : THREE.MathUtils.lerp(3.5, 2.0, f.speedRatio);
    const slot = Math.floor(f.time / slotLength);
    const r = hash(slot * 7 + (f.activity === 'rih' ? 1 : f.activity === 'pooh' ? 2 : 0));

    if (f.activity === 'rih') {
      // Watch the injector mostly, glance at operator and wellhead
      if (r < 0.7) return anchors.injector.clone();
      if (r < 0.85) return anchors.operator.clone();
      return anchors.wellhead.clone();
    }
    if (f.activity === 'pooh') {
      // Watch the wellhead/reel mostly
      if (r < 0.65) return anchors.wellhead.clone();
      if (r < 0.8) return anchors.operator.clone();
      return anchors.injector.clone();
    }
    
    // Idle: look around
    if (r < 0.3) return anchors.wellhead.clone();
    if (r < 0.5) return anchors.operator.clone();
    if (r < 0.7) return anchors.injector.clone();
    // Look around the lease
    const a = ((r - 0.7) / 0.3) * 2.0 - 1.0;
    const forward = new THREE.Vector3(Math.cos(a) * 8, -0.5 + hash(slot + 19) * 1.5, Math.sin(a) * 8);
    forward.applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    return headWorld().clone().add(forward);
  }

  /**
   * Hand targets for standard crane/hoist hand signals (ASME B30 style), in the
   * BODY frame: origin at the feet, +X forward, +Y up, left hand on −Z. The
   * frame follows the hips' yaw so signals are given toward the operator.
   */
  function getSignalTargets(t: number, signal: 'lower' | 'hoist' | 'estop' | 'h2s'): { left: THREE.Vector3; right: THREE.Vector3 } {
    const c = Math.cos(t * 9), sn = Math.sin(t * 9); // small "circling" motion
    if (signal === 'estop') {
      // EMERGENCY STOP: both arms straight out to the sides, palms down, swinging.
      const swing = Math.sin(t * 6) * 0.14;
      return { left: new THREE.Vector3(0.08 + swing, 1.4, -0.76), right: new THREE.Vector3(0.08 + swing, 1.4, 0.76) };
    }
    if (signal === 'lower') {
      // LOWER: right arm extended downward, index finger down, small circles.
      return { left: new THREE.Vector3(0.02, 0.84, -0.27), right: new THREE.Vector3(0.18 + c * 0.04, 0.9, 0.32 + sn * 0.04) };
    }
    if (signal === 'hoist') {
      // HOIST: right forearm vertical, index finger up, small circles above the shoulder.
      return { left: new THREE.Vector3(0.02, 0.84, -0.27), right: new THREE.Vector3(0.16 + c * 0.04, 1.78, 0.24 + sn * 0.04) };
    }
    // H2S: left hand over nose/mouth, right arm pointing out (toward the muster/upwind side).
    return { left: new THREE.Vector3(0.2, 1.6, -0.04), right: new THREE.Vector3(0.22, 1.42, 0.72) };
  }

  /** Body frame (feet origin, hips yaw) → world. */
  const bodyToWorld = (v: THREE.Vector3) => root.localToWorld(v.clone().applyAxisAngle(UP, bodYaw));

  function update(frame: FloorhandFrame) {
    const f: FloorhandFrame = { ...frame, alarm: frame.alarm || !!frame.emergencyId };
    const dt = Math.min(f.delta, 0.1);
    const t = f.time;

    root.updateMatrixWorld(true);

    // Determine if giving a signal and which type
    let isSignalling = false;
    let signalType: 'lower' | 'hoist' | 'estop' | 'h2s' = 'lower';

    // Any active emergency (alarm horn OR an injected/drill scenario) is an alarm for the crew.
    const key = f.emergencyId ?? (f.alarm ? 'alarm' : null);
    if (key !== emergencyKey) {
      emergencyKey = key;
      emergencyStart = t;
    }
    const sinceStart = t - emergencyStart;
    pointing = false;

    if (f.alarm) {
      isSignalling = true;
      // Reaction sequence: E-STOP to the operator for 5 s, then alternate
      // pointing at the hazard (radio to the head) with repeated E-STOP signals.
      pointing = f.emergencyId !== 'emg-h2s' && sinceStart > 5 && (sinceStart - 5) % 7 < 3.5;
      if (f.emergencyId === 'emg-h2s') {
        signalType = 'h2s';
        // Face away from well (upwind evacuation stance)
        turnBody(yawToward(anchors.wellhead) + Math.PI, 8, dt);
      } else if (pointing) {
        signalType = 'estop';
        turnBody(yawToward(hazardPoint(f.emergencyId, anchors)), 6, dt);
      } else {
        signalType = 'estop';
        // Face the operator
        turnBody(yawToward(anchors.operator), 12, dt);
      }
      signalPhase = 1; // emergency signals are held continuously
    } else if (f.activity !== 'idle') {
      // During work, periodically turn to operator and give signal
      const signalFreq = THREE.MathUtils.lerp(0.2, 0.5, f.speedRatio); // checks per second
      const signalInterval = 1 / signalFreq;

      if (!workSignalActive && t - lastSignalTime > signalInterval) {
        workSignalActive = true;
        signalCycle = 0;
      }

      if (workSignalActive) {
        isSignalling = true;
        signalType = f.activity === 'rih' ? 'lower' : 'hoist';
        signalCycle += dt;
        if (signalCycle > 2.0) {
          workSignalActive = false;
          isSignalling = false;
          signalCycle = 0;
          lastSignalTime = t; // next signal interval counts from the end of this one
        }
        signalPhase = Math.min(signalCycle / 0.5, 1); // ramp up over 0.5s
        if (signalCycle > 1.2) {
          signalPhase = Math.max(0, 1 - (signalCycle - 1.2) / 0.3);
        }
      }

      // Face the operator during signal, otherwise watch injector/wellhead
      if (isSignalling) {
        turnBody(yawToward(anchors.operator), 8, dt);
      } else {
        // Watch the activity location
        const watchLoc = f.activity === 'rih' ? anchors.injector : anchors.wellhead;
        turnBody(yawToward(watchLoc), 4, dt);
      }
    } else {
      // Idle: relaxed, slow body turn
      workSignalActive = false;
      turnBody(yawToward(anchors.wellhead) + Math.sin(t * 0.3) * 0.4, 2, dt);
    }

    // Apply body turn (yaw only, feet planted)
    hips.rotation.y = bodYaw;

    // Posture: slightly upright even during work
    const swayAmp = f.alarm ? 0.006 : f.activity !== 'idle' ? 0.008 : 0.015;
    const sway = Math.sin(t * 0.4) * swayAmp + Math.sin(t * 1.1) * swayAmp * 0.2;
    hips.position.z = sway;
    // Startle at emergency onset: quick backward recoil of the upper body (~0.8 s).
    const startle = f.alarm && sinceStart < 0.8 ? Math.sin((sinceStart / 0.8) * Math.PI) * 0.12 : 0;
    hips.rotation.x = -sway * 0.8;

    // Keep feet planted
    legs.forEach((leg, i) => {
      leg.hip.rotation.x = sway * 0.8;
      const unweighted = (i === 0 ? -sway : sway) > 0 ? Math.abs(sway) / Math.max(swayAmp, 1e-4) : 0;
      leg.knee.rotation.z = -0.02 - 0.05 * unweighted;
      leg.hip.rotation.z = 0.01 + 0.02 * unweighted;
    });

    // Breathing
    const breath = Math.sin(t * (f.alarm ? 2.8 : 1.4));
    torso.scale.set(0.72 * (1 + breath * 0.01), 1 + breath * 0.007, 1.05 * (1 + breath * 0.009));
    spine.rotation.z = breath * 0.006 + startle;

    root.updateMatrixWorld(true);

    // Gaze
    gazeTarget.copy(chooseGaze(f));
    if (!initialised) gaze.copy(gazeTarget);
    gaze.lerp(gazeTarget, damp(f.alarm ? 8 : 4, dt));

    const local = hips.worldToLocal(gaze.clone()).sub(tmp.set(0, spine.position.y + neck.position.y, 0));
    const targetYaw = THREE.MathUtils.clamp(Math.atan2(-local.z, local.x), -1.2, 1.2);
    const targetPitch = THREE.MathUtils.clamp(Math.atan2(local.y - 0.2, Math.hypot(local.x, local.z)), -0.6, 0.5);
    yaw += (targetYaw - yaw) * damp(f.alarm ? 10 : 6, dt);
    pitch += (targetPitch - pitch) * damp(f.alarm ? 10 : 6, dt);
    neck.rotation.y = yaw;
    head.rotation.z = pitch;

    root.updateMatrixWorld(true);

    // Hands
    const restLeft = new THREE.Vector3(0.02, 0.84, -0.27);
    const restRight = new THREE.Vector3(0.03, 0.84, 0.27);
    let leftGoal = bodyToWorld(restLeft);
    let rightGoal = bodyToWorld(restRight);

    if (isSignalling && signalPhase > 0) {
      const targets = getSignalTargets(t, signalType);
      // Alarm signals are held; work signals ease in/out with signalPhase.
      const w = f.alarm ? 1 : THREE.MathUtils.smoothstep(signalPhase, 0, 1);
      leftGoal = bodyToWorld(restLeft.clone().lerp(targets.left, w));
      rightGoal = bodyToWorld(restRight.clone().lerp(targets.right, w));
      if (pointing) {
        // Right arm straight at the hazard; left hand keys the radio at the head.
        const shoulder = rightArm.shoulder.getWorldPosition(new THREE.Vector3());
        const dir = hazardPoint(f.emergencyId, anchors).clone().sub(shoulder).normalize();
        rightGoal = shoulder.addScaledVector(dir, 0.58 * root.scale.x);
        leftGoal = head.localToWorld(new THREE.Vector3(0.02, 0.0, -0.13));
      }
    } else if (f.activity === 'idle') {
      // Idle hand poses
      const cycle = t % 12;
      if (cycle > 8.5 && cycle < 9.8) {
        // Adjust radio on chest
        leftGoal = head.localToWorld(new THREE.Vector3(-0.1, 0.15, 0.08));
      } else if (cycle > 4 && cycle < 6) {
        // Hands on hips
        leftGoal = bodyToWorld(new THREE.Vector3(-0.05, 0.98, -0.25));
        rightGoal = bodyToWorld(new THREE.Vector3(-0.05, 0.98, 0.25));
      }
    }

    if (!initialised) {
      leftHand.copy(leftGoal);
      rightHand.copy(rightGoal);
      initialised = true;
    }

    const handSpeed = isSignalling ? 12 : f.alarm ? 10 : f.activity !== 'idle' ? 8 : 5;
    leftHand.lerp(leftGoal, damp(handSpeed, dt));
    rightHand.lerp(rightGoal, damp(handSpeed, dt));

    solveArm(leftArm.shoulder, leftArm.elbow, spine.worldToLocal(leftHand.clone()), leftArm.pole);
    solveArm(rightArm.shoulder, rightArm.elbow, spine.worldToLocal(rightHand.clone()), rightArm.pole);
  }

  return { root, update };
}
