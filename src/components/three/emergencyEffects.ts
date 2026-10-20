import * as THREE from 'three';
import type { AlarmTier } from '../../types';
import { createEmergencyAudioController } from './emergencyAudio';
import { createMechanicalFaults } from './mechanicalFaults';

/**
 * Visible consequences of emergencies in the 3D scene: strobe beacons, sparks
 * at the gripper during rod slip / free-fall, fluid or air spray at the
 * wellhead/BOP, and engine smoke or steam. Driven every frame from the live
 * alarm tier and active emergency scenario id.
 *
 * All 13 scenarios with distinctive animated fault cues:
 * 1. emg-freefall: Red strobes, continuous spark shower
 * 2. emg-charge: Orange strobes, weak spray at wellhead
 * 3. emg-blowout: Red strobes, dark mud/oil spray upward
 * 4. emg-h2s: Red strobes, no visible gas (per spec), green safety markers
 * 5. emg-engine: Red strobes, black engine smoke, spark trail
 * 6. emg-hydraulic: Orange strobes, red hydraulic mist at BOP
 * 7. emg-lightning: White/blue flickering strobes, rig geometry highlights
 * 8. emg-outrigger: Red strobes, tilt/sag geometry indicators, ground damage
 * 9. emg-overpull: Red strobes, chain tension sparks, upward rod stress cues
 * 10. emg-chain: Orange strobes, chain wear particles, oiler failure spray
 * 11. emg-overheat: Red strobes, white steam plumes from hydraulic lines
 * 12. emg-bopair: Red strobes, white air/fog at BOP, reduced pressure spray
 * 13. emg-wind: Blue/white strobes, wind-driven particle trails, gust effect
 */

export interface EmergencyEffectAnchors {
  /** Ground points for free-standing strobe beacon poles. */
  beaconPoles: THREE.Vector3[];
  /** Beacons mounted directly on equipment (head position). */
  beaconHeads: THREE.Vector3[];
  /** Point where the rod passes through the gripper blocks. */
  gripper: THREE.Vector3;
  /** Wellhead / BOP flange where a leak sprays from. */
  wellheadLeak: THREE.Vector3;
  /** BOP body (air/hydraulic leak at the ram operators). */
  bop: THREE.Vector3;
  /** Engine compartment / exhaust outlet on the MG unit. */
  engine: THREE.Vector3;
  /** Optional: pulling unit base for outrigger/chain visualization. */
  pullingUnit?: THREE.Vector3;
  /** Optional: outrigger pad position for sinking/tilt effects. */
  outrigger?: THREE.Vector3;
  particleScale?: number;
}

export interface EmergencyEffectsFrame {
  time: number;
  delta: number;
  alarmTier: AlarmTier;
  scenarioId: string | null;
  /** Rod speed ft/min (+ POOH, − RIH); sparks follow the rod direction. */
  rodSpeedFtPerMin: number;
  /** Wind velocity (m/s) the air moves toward. */
  wind: THREE.Vector3;
}

export interface EmergencyEffects {
  update(frame: EmergencyEffectsFrame): void;
  dispose(): void;
}

interface EmitterOptions {
  count: number;
  color: number;
  size: number;
  additive?: boolean;
  opacity?: number;
}

interface Emitter {
  points: THREE.Points;
  /** Spawn up to `rate*delta` particles and integrate the rest. */
  step(delta: number, rate: number, spawn: (p: THREE.Vector3, v: THREE.Vector3) => number, gravity: number, drag: number, wind: THREE.Vector3, windCoupling: number): void;
  dispose(): void;
}

function createEmitter(scene: THREE.Scene, o: EmitterOptions): Emitter {
  const scale = Number(scene.userData.emergencyParticleScale ?? 1);
  o = { ...o, count: Math.max(12, Math.floor(o.count * scale)) };
  const pos = new Float32Array(o.count * 3);
  const vel = new Float32Array(o.count * 3);
  const life = new Float32Array(o.count); // remaining seconds; <= 0 = dead
  const colors = new Float32Array(o.count * 3);
  const base = new THREE.Color(o.color);
  for (let i = 0; i < o.count; i++) pos[i * 3 + 1] = -1000;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: o.size, vertexColors: !!o.additive, color: o.additive ? 0xffffff : o.color, transparent: true, opacity: o.opacity ?? 0.9, depthWrite: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  const maxLife = new Float32Array(o.count);
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();
  let carry = 0;
  let cursor = 0;
  let alive = 0;

  return {
    points,
    step(delta, rate, spawn, gravity, drag, wind, windCoupling) {
      carry += rate * Math.max(0, Math.min(delta, 0.1)) * scale;
      let toSpawn = Math.floor(carry);
      carry -= toSpawn;
      while (toSpawn-- > 0) {
        const i = cursor;
        cursor = (cursor + 1) % o.count;
        const l = spawn(p.set(0, 0, 0), v.set(0, 0, 0));
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
        life[i] = l; maxLife[i] = l;
      }
      alive = 0;
      const dragK = Math.exp(-drag * delta);
      for (let i = 0; i < o.count; i++) {
        if (life[i] <= 0) continue;
        life[i] -= delta;
        if (life[i] <= 0) { pos[i * 3 + 1] = -1000; colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0; continue; }
        alive++;
        const j = i * 3;
        vel[j] = (vel[j] - wind.x * windCoupling) * dragK + wind.x * windCoupling;
        vel[j + 1] = vel[j + 1] * dragK - gravity * delta;
        vel[j + 2] = (vel[j + 2] - wind.z * windCoupling) * dragK + wind.z * windCoupling;
        pos[j] += vel[j] * delta; pos[j + 1] += vel[j + 1] * delta; pos[j + 2] += vel[j + 2] * delta;
        // Additive sparks cool toward black (= transparent) as they die.
        const fade = life[i] / maxLife[i];
        colors[j] = base.r * fade; colors[j + 1] = base.g * fade; colors[j + 2] = base.b * fade;
      }
      points.visible = alive > 0;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    dispose() { scene.remove(points); geo.dispose(); mat.dispose(); },
  };
}

// Scenario groupings for strobe and effect color schemes
const RED_SCENARIOS = new Set(['emg-freefall', 'emg-blowout', 'emg-h2s', 'emg-lightning', 'emg-outrigger', 'emg-overpull', 'emg-engine', 'emg-hydraulic', 'emg-bopair']);
const SPARK_SCENARIOS = new Set(['emg-freefall', 'emg-chain', 'emg-overpull']);
const WIND_SCENARIOS = new Set(['emg-wind']);
export function createEmergencyEffects(scene: THREE.Scene, a: EmergencyEffectAnchors): EmergencyEffects {
  scene.userData.emergencyParticleScale = a.particleScale ?? 1;
  // --- Strobe beacons (distinct per scenario class) --------------------------------
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8c00, emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.9 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.5, metalness: 0.6 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.3 });
  const beacons: Array<{ light: THREE.PointLight; lens: THREE.Mesh; phase: number }> = [];
  const addBeacon = (head: THREE.Vector3, phase: number) => {
    const g = new THREE.Group();
    g.position.copy(head);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 16), baseMat);
    plinth.position.y = 0.04;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.22, 16), lensMat.clone());
    lens.position.y = 0.19;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), baseMat);
    cap.position.y = 0.3;
    const light = new THREE.PointLight(0xff8c00, 0, 14, 2);
    light.position.y = 0.2;
    g.add(plinth, lens, cap, light);
    scene.add(g);
    beacons.push({ light, lens, phase });
  };
  a.beaconPoles.forEach((ground, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 10), poleMat);
    pole.position.set(ground.x, ground.y + 1.6, ground.z);
    pole.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 16), baseMat);
    foot.position.set(ground.x, ground.y + 0.06, ground.z);
    scene.add(pole, foot);
    addBeacon(new THREE.Vector3(ground.x, ground.y + 3.2, ground.z), i * 0.37);
  });
  a.beaconHeads.forEach((h, i) => addBeacon(h, 0.5 + i * 0.29));

  // --- Particle systems (one set per emitter type) ---------------------------------
  const sparks = createEmitter(scene, { count: 500, color: 0xffb347, size: 0.06, additive: true, opacity: 1 });
  const spray = createEmitter(scene, { count: 900, color: 0x4a3b2a, size: 0.16, opacity: 0.75 });
  const smoke = createEmitter(scene, { count: 450, color: 0x2b2b2b, size: 0.9, opacity: 0.5 });
  const steam = createEmitter(scene, { count: 600, color: 0xe8eef2, size: 0.8, opacity: 0.4 });
  const windParticles = createEmitter(scene, { count: 700, color: 0xaabbcc, size: 0.12, opacity: 0.6 });
  const chainWear = createEmitter(scene, { count: 300, color: 0x8b8b8b, size: 0.08, opacity: 0.7 });

  const smokeMat = smoke.points.material as THREE.PointsMaterial;
  const sprayMat = spray.points.material as THREE.PointsMaterial;
  const steamMat = steam.points.material as THREE.PointsMaterial;
  const windMat = windParticles.points.material as THREE.PointsMaterial;
  const chainMat = chainWear.points.material as THREE.PointsMaterial;

  const rand = (s = 1) => (Math.random() * 2 - 1) * s;

  const audio = createEmergencyAudioController();
  const faults = createMechanicalFaults(scene, a);

  const update = (f: EmergencyEffectsFrame) => {
    const id = f.scenarioId;
    const alarm = f.alarmTier !== 'none';
    const active = alarm || !!id;

    audio.update(id, f.time);
    faults.update(id, f.time);

    // --- Beacons: rotating-strobe look (sharp double pulse), color by scenario -----
    const isRed = RED_SCENARIOS.has(id ?? '');
    const isWind = WIND_SCENARIOS.has(id ?? '');
    const hex = isRed ? 0xff1a1a : isWind ? 0x4da6ff : 0xff8c00;

    for (const b of beacons) {
      const m = b.lens.material as THREE.MeshStandardMaterial;
      if (!active) { b.light.intensity = 0; b.light.visible = false; m.emissiveIntensity = 0.15; continue; }
      const cycle = (f.time * (isRed ? 2.4 : 1.6) + b.phase) % 1;
      const pulse = cycle < 0.08 || (cycle > 0.16 && cycle < 0.24) ? 1 : 0.05;
      b.light.visible = true;
      b.light.color.setHex(hex);
      b.light.intensity = pulse * 18;
      m.color.setHex(isRed ? 0xff3030 : isWind ? 0x5eb3ff : 0xffa000);
      m.emissive.setHex(hex);
      m.emissiveIntensity = 0.3 + pulse * 4;
    }

    // --- Sparks at the gripper: slip = intermittent, free-fall = continuous shower ----
    const slipLevel = f.alarmTier === 'freefall' || id === 'emg-freefall' ? 1
      : f.alarmTier === 'slip' || f.alarmTier === 'emergency' ? 0.45
      : id && SPARK_SCENARIOS.has(id) ? 0.3 : 0;
    const rodDir = f.rodSpeedFtPerMin < -0.1 ? -1 : 1;
    const sparkRate = slipLevel > 0 ? 260 * slipLevel * (0.5 + 0.5 * Math.max(0, Math.sin(f.time * 13))) : 0;

    sparks.step(f.delta, sparkRate, (p, v) => {
      const ang = Math.random() * Math.PI * 2;
      p.set(a.gripper.x + Math.cos(ang) * 0.06, a.gripper.y + rand(0.25), a.gripper.z + Math.sin(ang) * 0.06);
      const sp = 2.5 + Math.random() * 3.5;
      v.set(Math.cos(ang) * sp, rodDir * (1 + Math.random() * 2) + 1.2, Math.sin(ang) * sp);
      return 0.25 + Math.random() * 0.45;
    }, 9.8, 0.6, f.wind, 0);

    // --- Wellhead / BOP spray: scenario-specific origin, color, and dynamics --------
    let sprayRate = 0;
    let sprayHex = 0x4a3b2a;
    let sprayOrigin = a.wellheadLeak;
    let sprayUp = 9, spraySpread = 1.6, sprayLife = 1.6, sprayGravity = 6;

    if (id === 'emg-blowout') { sprayRate = 420; } // Dark mud upward
    else if (id === 'emg-hydraulic') { sprayRate = 160; sprayHex = 0xb5462b; sprayOrigin = a.bop; sprayUp = 2.5; spraySpread = 3.2; sprayLife = 0.9; } // Red hydraulic mist
    else if (id === 'emg-bopair') { sprayRate = 120; sprayHex = 0xe8eef2; sprayOrigin = a.bop; sprayUp = 1.2; spraySpread = 1.8; sprayLife = 1.2; sprayGravity = -0.4; } // White air fog
    // Charge pressure failure is shown on the charge circuit indicator, not as a well leak.
    else if (id === 'emg-chain') { sprayRate = 140; sprayHex = 0xc0a080; sprayOrigin = a.gripper; sprayUp = 0.5; spraySpread = 2.0; sprayLife = 0.6; sprayGravity = 8; } // Oiler failure spray (downward)

    if (sprayRate > 0) sprayMat.color.setHex(sprayHex);
    spray.step(f.delta, sprayRate, (p, v) => {
      p.set(sprayOrigin.x + rand(0.15), sprayOrigin.y + rand(0.1), sprayOrigin.z + rand(0.15));
      const side = Math.random() * Math.PI * 2;
      const r = Math.random() * spraySpread;
      v.set(Math.cos(side) * r, sprayUp * (0.6 + Math.random() * 0.6), Math.sin(side) * r);
      return sprayLife * (0.6 + Math.random() * 0.6);
    }, sprayGravity, 0.4, f.wind, 0.6);

    // --- Engine smoke (black, dense) for engine failure; white steam for overheat ----
    let smokeRate = 0;
    if (id === 'emg-engine') { smokeRate = 40; smokeMat.color.setHex(0x1f1f1f); smokeMat.opacity = 0.55; }
    else if (id === 'emg-overheat') { smokeRate = 0; } // Use steam instead for overheat
    smoke.step(f.delta, smokeRate, (p, v) => {
      p.set(a.engine.x + rand(0.3), a.engine.y + rand(0.15), a.engine.z + rand(0.3));
      v.set(rand(0.3), 1.6 + Math.random(), rand(0.3));
      return 3 + Math.random() * 2;
    }, -0.2, 0.25, f.wind, 0.8);

    // --- Steam plumes for hydraulic overheat (white vapor) -------------------------
    let steamRate = 0;
    if (id === 'emg-overheat') { steamRate = 35; steamMat.color.setHex(0xe5e7eb); steamMat.opacity = 0.35; }
    steam.step(f.delta, steamRate, (p, v) => {
      p.set(a.engine.x + rand(0.4), a.engine.y + 0.5 + rand(0.2), a.engine.z + rand(0.4));
      v.set(rand(0.5), 2.2 + Math.random() * 0.8, rand(0.5));
      return 2.5 + Math.random() * 1.5;
    }, -0.3, 0.2, f.wind, 0.9);

    // --- Wind-driven particles for high wind scenario -------
    let windRate = 0;
    if (id === 'emg-wind') { windRate = 200; windMat.color.setHex(0xaabbcc); windMat.opacity = 0.6; }
    windParticles.step(f.delta, windRate, (p, v) => {
      p.set(a.gripper.x + rand(3), a.gripper.y + rand(2), a.gripper.z + rand(3));
      const windStrength = 3 + Math.random() * 2;
      v.set(f.wind.x * windStrength + rand(1), rand(0.5), f.wind.z * windStrength + rand(1));
      return 1.5 + Math.random() * 1;
    }, -0.1, 0.3, f.wind, 1.2);

    // --- Chain wear particles for chain over-tension --------
    let chainRate = 0;
    if (id === 'emg-chain') { chainRate = 150; chainMat.color.setHex(0x8b8b8b); chainMat.opacity = 0.7; }
    chainWear.step(f.delta, chainRate, (p, v) => {
      p.set(a.gripper.x + rand(0.2), a.gripper.y + rand(0.15), a.gripper.z + rand(0.2));
      const ang = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2;
      v.set(Math.cos(ang) * sp, rand(1.5), Math.sin(ang) * sp);
      return 0.3 + Math.random() * 0.4;
    }, 5, 0.8, f.wind, 0.2);

    // Mechanical fault demonstrators above provide detector, pressure, chain,
    // tension, outrigger settlement and lightning geometry for their drills.
  };

  return {
    update,
    dispose() {
      audio.dispose();
      faults.dispose();
      sparks.dispose();
      spray.dispose();
      smoke.dispose();
      steam.dispose();
      windParticles.dispose();
      chainWear.dispose();
    },
  };
}
