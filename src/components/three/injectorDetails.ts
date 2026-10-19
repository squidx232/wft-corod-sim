import * as THREE from 'three';
import { createMeshKit } from './meshKit';

/**
 * Injector-head detail pass, fitted to the imported injector model's bounds.
 * Everything is built in INJECTOR-GROUP local space (rod on the local Y axis,
 * x = z = 0; front/operator side = −X) except the long hydraulic hoses, which
 * live in world space so their ground runs stay planted while the head shakes.
 *
 * Live parts: the depth-encoder wheel (rolls with the rod) and the weight-
 * indicator needle (string weight on the load cell).
 */
export interface InjectorDetailHandles {
  /** `rodFtPerSec` signed rod speed (on screen), `weightLbs` hook/string load. */
  update(delta: number, rodFtPerSec: number, weightLbs: number): void;
}

export function addInjectorDetails(
  group: THREE.Object3D,
  scene: THREE.Scene,
  bounds: THREE.Box3,
  opts: { groundWorldY: number; hoseEndWorld: THREE.Vector3 },
): InjectorDetailHandles {
  const kit = createMeshKit();
  const { mat, box, cyl, strut } = kit;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const min = bounds.min, max = bounds.max;
  const H = max.y - min.y;
  const steel = mat(0x8b95a1, 0.4, 0.8);
  const dark = mat(0x111827, 0.55, 0.5);
  const black = mat(0x0b0b0c, 0.6, 0.3);
  const brass = mat(0xc9a227, 0.35, 0.85);
  const red = mat(0xc81e1e, 0.5, 0.3);
  const blue = mat(0x1d4ed8, 0.5, 0.3);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const white = mat(0xf5f5f4, 0.4, 0.1);
  const glass = new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.55, emissive: 0x3a2000, emissiveIntensity: 0.4 });

  // 1. Adapter spool + studded flange between the BOP top and the head base.
  cyl(group, 0.48, 0.22, steel, 0, -0.11, 0, 'y', 24);
  cyl(group, 0.56, 0.06, steel, 0, -0.01, 0, 'y', 24);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5;
    cyl(group, 0.022, 0.36, brass, x, -0.08, z, 'y', 6, false);
    cyl(group, 0.04, 0.05, dark, x, 0.06, z, 'y', 6, false);
    cyl(group, 0.04, 0.05, dark, x, -0.22, z, 'y', 6, false);
  }

  // 2. Rod entry funnel / stabbing guide on top.
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.07, 0.4, 20, 1, true), mat(0x9aa4ae, 0.35, 0.85));
  funnel.material.side = THREE.DoubleSide;
  funnel.position.set(0, max.y + 0.2, 0);
  group.add(funnel);
  cyl(group, 0.3, 0.04, dark, 0, max.y + 0.41, 0, 'y', 20, false);

  // 3. Hydraulic manifold block on the back (+X) face with fittings + gauges.
  const mx = max.x + 0.18, my = min.y + H * 0.42;
  box(group, 0.34, 0.62, 0.78, mat(0x6b7280, 0.45, 0.7), mx, my, 0);
  const fittings: THREE.Vector3[] = [];
  [-0.27, -0.09, 0.09, 0.27].forEach((fz, i) => {
    const fy = my - 0.12 + (i % 2) * 0.04;
    cyl(group, 0.045, 0.16, brass, mx + 0.24, fy, fz, 'x', 8, false);
    cyl(group, 0.06, 0.06, dark, mx + 0.34, fy, fz, 'x', 6, false); // swivel nut
    fittings.push(V(mx + 0.38, fy, fz));
  });
  for (const gz of [-0.2, 0.2]) {
    const g = new THREE.Group();
    g.position.set(mx + 0.18, my + 0.22, gz);
    g.rotation.z = -Math.PI / 2;
    cyl(g, 0.11, 0.06, dark, 0, 0, 0, 'y', 18, false);
    cyl(g, 0.095, 0.01, white, 0, 0.032, 0, 'y', 18, false);
    box(g, 0.08, 0.005, 0.012, red, 0.02, 0.038, 0, false);
    group.add(g);
  }

  // 4. Hoses (world space): drape off the manifold, drop to the pad and run
  //    back toward the MG unit. Drive pair = black w/ red tags; squeeze/brake
  //    pair = black w/ blue tags.
  group.updateWorldMatrix(true, false);
  const gy = opts.groundWorldY + 0.06;
  fittings.forEach((f, i) => {
    const start = group.localToWorld(f.clone());
    const lane = 3.4 + i * 0.16; // parallel lanes on the +Z side, clear of the cellar
    const pts = [
      start,
      start.clone().add(V(0.45, -0.25, 0)),
      V(start.x + 1.1, start.y - 2.2, start.z + lane * 0.25),
      V(start.x + 1.5, gy + 1.2, lane * 0.8),
      V(start.x + 1.2, gy, lane),
      V(start.x - 3, gy, lane + 0.05),
      V(opts.hoseEndWorld.x + 3, gy, opts.hoseEndWorld.z + i * 0.16),
      V(opts.hoseEndWorld.x, opts.hoseEndWorld.y, opts.hoseEndWorld.z + i * 0.16),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.04, 8, false), black);
    hose.castShadow = true;
    scene.add(hose);
    // Colour tags near the fitting and at the MG end.
    for (const t of [0.04, 0.97]) {
      const p = curve.getPointAt(t);
      const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), i < 2 ? red : blue);
      tag.position.copy(p);
      tag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t));
      scene.add(tag);
    }
  });

  // 5. Load cell on the bail + weight indicator dial on the operator (−X) face.
  cyl(group, 0.16, 0.26, mat(0x374151, 0.4, 0.7), 0, max.y + 0.62, 0.55, 'y', 16);
  const wiX = min.x - 0.06, wiY = min.y + H * 0.58, wiZ = Math.max(min.z + 0.4, -0.55);
  const dial = new THREE.Group();
  dial.position.set(wiX, wiY, wiZ);
  dial.rotation.z = -Math.PI / 2; // dial face (local −Y) → −X, toward the operator
  cyl(dial, 0.34, 0.1, black, 0, 0, 0, 'y', 28, false);
  cyl(dial, 0.3, 0.01, white, 0, -0.055, 0, 'y', 28, false);
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI * 0.75 + (k / 10) * Math.PI * 1.5;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.05), black);
    tick.position.set(Math.sin(a) * 0.25, -0.062, Math.cos(a) * 0.25);
    tick.rotation.y = a;
    dial.add(tick);
  }
  const needle = new THREE.Group();
  needle.position.set(0, -0.066, 0);
  const nMesh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.24), red);
  nMesh.position.z = 0.1;
  needle.add(nMesh);
  dial.add(needle);
  group.add(dial);
  strut(group, V(wiX + 0.05, wiY + 0.3, wiZ), V(0.05, max.y + 0.5, 0.55), 0.012, black); // load-cell line

  // 6. Depth encoder (measuring wheel on the rod at the top) + junction box.
  const enc = new THREE.Group();
  enc.position.set(0.16, max.y - 0.35, 0);
  group.add(enc);
  const wheel = new THREE.Group();
  enc.add(wheel);
  cyl(wheel, 0.12, 0.05, mat(0x1f2937, 0.4, 0.6), 0, 0, 0, 'z', 20, false);
  box(wheel, 0.2, 0.02, 0.055, yellow, 0, 0, 0, false); // spoke so rolling reads
  box(enc, 0.32, 0.05, 0.03, steel, 0.12, 0, 0.05, false); // spring arm
  box(group, 0.22, 0.26, 0.12, mat(0x9ca3af, 0.6, 0.4), 0.42, max.y - 0.5, 0.18);
  strut(group, V(0.42, max.y - 0.63, 0.18), V(max.x, min.y + H * 0.5, 0.25), 0.012, black);

  // 7. Chain-lube oil reservoir with sight glass (−Z side) + grease manifold (+Z).
  const rz = min.z - 0.2;
  cyl(group, 0.16, 0.6, mat(0xb91c1c, 0.5, 0.4), 0.25, min.y + H * 0.75, rz, 'y', 16);
  cyl(group, 0.03, 0.4, glass, 0.25 + 0.16, min.y + H * 0.75, rz, 'y', 8, false);
  strut(group, V(0.25, min.y + H * 0.75 + 0.3, rz), V(0.1, min.y + H * 0.88, min.z + 0.05), 0.012, black);
  const gz = max.z + 0.07;
  box(group, 0.4, 0.12, 0.1, brass, 0.2, min.y + H * 0.3, gz);
  for (let k = 0; k < 4; k++) {
    const x = 0.06 + k * 0.1;
    strut(group, V(x, min.y + H * 0.3 + 0.06, gz), V(x - 0.1, min.y + H * (0.45 + k * 0.08), max.z - 0.02), 0.008, brass);
  }

  // 8. Hazard stripes, nameplate and pinch-point warning.
  const stripes = document.createElement('canvas');
  stripes.width = 256; stripes.height = 32;
  const sctx = stripes.getContext('2d');
  if (sctx) {
    sctx.fillStyle = '#f2c200'; sctx.fillRect(0, 0, 256, 32);
    sctx.fillStyle = '#111111';
    for (let x = -32; x < 256; x += 32) { sctx.beginPath(); sctx.moveTo(x, 32); sctx.lineTo(x + 16, 32); sctx.lineTo(x + 32, 0); sctx.lineTo(x + 16, 0); sctx.fill(); }
  }
  const stripeTex = new THREE.CanvasTexture(stripes);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6, side: THREE.DoubleSide });
  const w = max.z - min.z;
  for (const y of [min.y + 0.12, max.y - 0.12]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, 0.12), stripeMat);
    band.position.set(min.x - 0.012, y, (min.z + max.z) / 2);
    band.rotation.y = -Math.PI / 2;
    group.add(band);
  }
  const name = kit.signTexture([
    { text: 'WEATHERFORD', color: '#c8102e', size: 64 },
    { text: 'CoRod® GRIPPER INJECTOR', color: '#111111', size: 34 },
    { text: 'MAX PULL 30,000 lbf · 5000 psi', color: '#333333', size: 26 },
  ], '#f4f4f5', 512, 220, '#111111');
  kit.signPlane(group, name, 0.62, 0.27, (min.x + max.x) / 2, min.y + H * 0.22, max.z + 0.015, 0);
  const warn = kit.signTexture([
    { text: '⚠ DANGER', color: '#ffffff', size: 60 },
    { text: 'PINCH POINTS · KEEP CLEAR', color: '#ffffff', size: 30 },
  ], '#c8102e', 512, 200, '#ffffff');
  kit.signPlane(group, warn, 0.5, 0.2, (min.x + max.x) / 2, min.y + H * 0.22, min.z - 0.015, Math.PI);

  let wheelAngle = 0;
  let needleAngle = -Math.PI * 0.75;
  return {
    update(delta, rodFtPerSec, weightLbs) {
      // Wheel rolls at rod surface speed: ω = v / r (r = 0.12 m).
      wheelAngle -= (rodFtPerSec * 0.3048 * delta) / 0.12;
      wheel.rotation.z = wheelAngle;
      // 0..30,000 lbf across the 270° dial, with needle damping.
      const target = -Math.PI * 0.75 + THREE.MathUtils.clamp(weightLbs / 30000, 0, 1) * Math.PI * 1.5;
      needleAngle = THREE.MathUtils.damp(needleAngle, target, 6, delta);
      needle.rotation.y = needleAngle;
    },
  };
}
