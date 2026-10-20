import * as THREE from 'three';
import { MeshKit, placement } from './meshKit';

/**
 * Detail pass for the workover/pulling-unit carrier, in TRUCK-LOCAL space:
 * front (cab) at −X ≈ −14.5, rear at +X ≈ 3.2, deck top at Y = 1.7, frame
 * rails at Z = ±0.95. The mast base sits at the local origin.
 */
/**
 * Crew-facing points on the carrier, in TRUCK-LOCAL space (truck is rotated π
 * inside the pulling-unit group, so world = (unitX − x, y, −z)).
 */
export const PU_CREW_POINTS = {
  deckY: 1.7,
  leverZ: [0.38, 0.82] as const,
  leverTopY: 3.42,
  stairs: { x: 2.72, width: 0.55, topY: 1.7, topZ: -1.5, bottomZ: -3.5 },
} as const;

export function addPullingUnitCarrierDetails(truck: THREE.Group, kit: MeshKit): void {
  const { mat, box, cyl, strut, railing } = kit;
  const black = mat(0x14181d, 0.7, 0.5);
  const rubber = mat(0x0b0b0c, 0.95, 0.05);
  const blue = mat(0x24466e, 0.5, 0.5);
  const chrome = mat(0xc9ced6, 0.25, 0.9);
  const amber = mat(0xffb020, 0.35, 0.1, 0xff8a00, 0.6);
  const rodChrome = mat(0xb8c0c8, 0.2, 0.95);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const gaugeFace = mat(0xf4f1e8, 0.5, 0.05);

  // Fenders with turned-down lips and rubber mud flaps behind every axle group.
  const axleGroups: Array<[number, number, number]> = [
    [-12.4, -12.4, 1.65], [-8.6, -7.0, 1.75], [-3.0, -1.4, 1.75], [1.2, 2.6, 1.75],
  ];
  for (const [x0, x1, zc] of axleGroups) {
    for (const side of [1, -1]) {
      box(truck, x1 - x0 + 1.8, 0.06, 0.62, black, (x0 + x1) / 2, 1.52, side * zc, false);
      box(truck, 0.06, 0.32, 0.62, black, x0 - 0.88, 1.37, side * zc, false);
      box(truck, 0.04, 0.85, 0.55, rubber, x1 + 0.9, 0.95, side * zc, false);
    }
  }

  // Cab access: steps, grab handles, west-coast mirrors, beacons and lights.
  for (const side of [1, -1]) {
    box(truck, 0.5, 0.06, 0.35, black, -9.45, 0.62, side * 1.55, false);
    box(truck, 0.5, 0.06, 0.32, black, -9.45, 1.02, side * 1.5, false);
    strut(truck, new THREE.Vector3(-9.02, 1.4, side * 1.4), new THREE.Vector3(-9.02, 3.2, side * 1.4), 0.03, chrome);
    strut(truck, new THREE.Vector3(-11.5, 3.2, side * 1.35), new THREE.Vector3(-11.5, 3.2, side * 1.85), 0.025, black);
    box(truck, 0.06, 0.6, 0.3, chrome, -11.5, 3.05, side * 1.9, false);
    cyl(truck, 0.12, 0.18, amber, -10.4, 3.84, side * 0.9, 'y', 12, false);
    cyl(truck, 0.26, 1.0, black, -11.3, 2.5, side * 1.48, 'y', 16, false); // air cleaners
    cyl(truck, 0.06, 0.5, chrome, -10.0, 3.85, side * 0.3, 'x', 10, false); // air horns
    cyl(truck, 0.2, 1.4, mat(0x6b7280, 0.5, 0.6), -5.2, 0.72, side * 0.55, 'x', 14, false); // air tanks
  }
  for (const z of [-0.8, -0.4, 0, 0.4, 0.8]) box(truck, 0.04, 0.06, 0.1, amber, -11.97, 3.7, z, false);

  // Hydraulic reservoir with filler cap and sight glass, ahead of the drawworks.
  box(truck, 1.6, 1.2, 1.8, blue, -6.6, 2.3, 0);
  cyl(truck, 0.12, 0.12, black, -6.2, 2.96, 0.45, 'y', 12, false);
  box(truck, 0.04, 0.5, 0.12, mat(0x1d4ed8, 0.2, 0.1, 0x1d4ed8, 0.2), -5.79, 2.3, 0.5, false);

  // Twin mast-raising hydraulic cylinders from the deck up to the mast's cab-side face.
  for (const side of [1, -1]) {
    const base = new THREE.Vector3(-5.0, 1.95, side * 0.75);
    const head = new THREE.Vector3(-0.95, 8.0, side * 0.75);
    strut(truck, base, base.clone().lerp(head, 0.6), 0.17, blue, 14, true);
    strut(truck, base.clone().lerp(head, 0.55), head, 0.085, rodChrome, 12, true);
    box(truck, 0.4, 0.3, 0.4, black, base.x, base.y, base.z, false);
    box(truck, 0.3, 0.3, 0.3, black, head.x, head.y, head.z, false);
  }

  // Rear work floor: guard railing and driller's console (weight indicator + gauges).
  railing(truck, [new THREE.Vector3(2.95, 1.7, -1.45), new THREE.Vector3(2.95, 1.7, 1.45)], yellow, 1.05, 0.95);
  box(truck, 0.3, 0.9, 0.3, black, 2.3, 2.15, 0.6, false);
  box(truck, 0.5, 0.6, 0.9, mat(0x1f2937, 0.5, 0.5), 2.3, 2.9, 0.6);
  cyl(truck, 0.2, 0.04, gaugeFace, 2.56, 3.0, 0.6, 'x', 24, false); // weight indicator
  for (const z of [0.25, 0.95]) cyl(truck, 0.1, 0.04, gaugeFace, 2.56, 2.78, z, 'x', 18, false);

  // Driller's control levers on the console top (worked by the pulling-unit driller).
  for (const z of PU_CREW_POINTS.leverZ) {
    strut(truck, new THREE.Vector3(2.12, 3.2, z), new THREE.Vector3(2.12, PU_CREW_POINTS.leverTopY, z), 0.018, chrome);
    cyl(truck, 0.035, 0.08, black, 2.12, PU_CREW_POINTS.leverTopY, z, 'y', 10, false);
  }

  // Access stairs from the rear work floor down the service-lane side (truck-local −Z).
  const st = PU_CREW_POINTS.stairs;
  const steps = 8;
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    box(truck, st.width, 0.04, 0.3, black, st.x, st.topY * (1 - f), st.topZ + (st.bottomZ - st.topZ) * f, false);
  }
  for (const dx of [-st.width / 2, st.width / 2]) {
    const x = st.x + dx;
    strut(truck, new THREE.Vector3(x, st.topY, st.topZ), new THREE.Vector3(x, 0.02, st.bottomZ), 0.035, yellow);
    strut(truck, new THREE.Vector3(x, st.topY + 0.95, st.topZ), new THREE.Vector3(x, 0.95, st.bottomZ), 0.022, yellow);
    strut(truck, new THREE.Vector3(x, 0.02, st.bottomZ), new THREE.Vector3(x, 0.95, st.bottomZ), 0.022, yellow);
    strut(truck, new THREE.Vector3(x, st.topY, st.topZ), new THREE.Vector3(x, st.topY + 0.95, st.topZ), 0.022, yellow);
  }

  // Rear bumper with chevron safety striping.
  box(truck, 0.2, 0.3, 3.0, black, 3.35, 0.9, 0, false);
  for (let i = 0; i < 6; i++) {
    box(truck, 0.02, 0.28, 0.5, i % 2 ? black : yellow, 3.46, 0.9, -1.25 + i * 0.5, false);
  }
}

/**
 * Detail pass for the telescoping lattice mast, in MAST-LOCAL space: the
 * mast base is at Y = 0 (top of the carrier deck), corner chords at ±`half`
 * on X/Z, −X faces the well and +X faces the carrier cab.
 */
export function addMastDetails(mast: THREE.Group, kit: MeshKit, height: number, half: number): void {
  const { mat, box, cyl, strut, railing, instanced } = kit;
  const H = height;
  const L = half;
  const sleeveRed = mat(0xa82f23, 0.5, 0.45);
  const grating = mat(0x6b7280, 0.7, 0.6);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const dark = mat(0x1f2937, 0.6, 0.5);
  const lamp = mat(0xfff4d6, 0.2, 0.1, 0xfff1c1, 0.9);
  const aviation = mat(0xff2a2a, 0.3, 0.1, 0xff0000, 1.2);
  const steelRail = mat(0xd0d4d8, 0.6, 0.5);

  // Heavier lower (outer) telescoping section with a collar at the joint.
  const lower = H * 0.55;
  for (const [cx, cz] of [[L, L], [L, -L], [-L, L], [-L, -L]]) {
    box(mast, 0.3, lower, 0.3, sleeveRed, cx, lower / 2, cz);
    box(mast, 0.55, 0.12, 0.55, dark, cx, 0.06, cz, false); // base shoes
  }
  for (const [w, d, x, z] of [[2 * L + 0.4, 0.14, 0, L], [2 * L + 0.4, 0.14, 0, -L], [0.14, 2 * L + 0.4, L, 0], [0.14, 2 * L + 0.4, -L, 0]]) {
    box(mast, w, 0.3, d, sleeveRed, x, lower, z, false);
  }

  // Caged access ladder on the cab-side (+X) face.
  const ladderX = L + 0.12;
  for (const z of [-0.22, 0.22]) box(mast, 0.05, H - 0.6, 0.05, steelRail, ladderX, H / 2, z, false);
  const rungs: THREE.Matrix4[] = [];
  for (let y = 0.4; y < H - 0.3; y += 0.3) rungs.push(placement(ladderX, y, 0));
  instanced(mast, new THREE.BoxGeometry(0.035, 0.035, 0.44), steelRail, rungs);
  const hoopGeometry = new THREE.TorusGeometry(0.42, 0.02, 4, 14, Math.PI);
  hoopGeometry.rotateX(Math.PI / 2).rotateY(Math.PI / 2); // semicircle bulging out along +X
  const hoops: THREE.Matrix4[] = [];
  for (let y = 2.4; y < H - 0.5; y += 1.0) hoops.push(placement(ladderX, y, 0));
  instanced(mast, hoopGeometry, yellow, hoops);
  for (const a of [Math.PI / 6, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3, (5 * Math.PI) / 6]) {
    const x = ladderX + 0.42 * Math.sin(a);
    const z = -0.42 * Math.cos(a);
    strut(mast, new THREE.Vector3(x, 2.4, z), new THREE.Vector3(x, H - 0.6, z), 0.015, yellow, 4);
  }

  // Crown platform with grating, toe boards and guard rail; crown sheave cluster.
  const deckY = H + 0.5;
  const P = L + 0.8;
  box(mast, 2 * P, 0.08, 2 * P, grating, 0, deckY, 0);
  for (const [w, d, x, z] of [[2 * P, 0.03, 0, P], [2 * P, 0.03, 0, -P], [0.03, 2 * P, P, 0], [0.03, 2 * P, -P, 0]]) {
    box(mast, w, 0.12, d, yellow, x, deckY + 0.1, z, false);
  }
  railing(mast, [
    new THREE.Vector3(-P, deckY, -P), new THREE.Vector3(P, deckY, -P),
    new THREE.Vector3(P, deckY, P), new THREE.Vector3(-P, deckY, P), new THREE.Vector3(-P, deckY, -P),
  ], yellow, 1.05, 1.1);
  const sheaveGeometry = new THREE.TorusGeometry(0.42, 0.07, 8, 24);
  const sheaves = [-0.45, -0.15, 0.15, 0.45].map((z) => placement(-0.2, deckY + 0.55, z));
  instanced(mast, sheaveGeometry, dark, sheaves, true);
  cyl(mast, 0.06, 1.3, steelRail, -0.2, deckY + 0.55, 0, 'z', 10, false);
  for (const z of [-0.65, 0.65]) box(mast, 1.1, 1.0, 0.06, sleeveRed, -0.2, deckY + 0.5, z);

  // Gin pole and aviation obstruction light at opposite crown corners.
  strut(mast, new THREE.Vector3(P - 0.15, deckY, P - 0.15), new THREE.Vector3(P - 0.15, deckY + 2.8, P - 0.15), 0.07, sleeveRed, 10, true);
  strut(mast, new THREE.Vector3(P - 0.15, deckY + 2.7, P - 0.15), new THREE.Vector3(P - 1.0, deckY + 2.7, P - 0.15), 0.04, sleeveRed);
  strut(mast, new THREE.Vector3(-P + 0.15, deckY, -P + 0.15), new THREE.Vector3(-P + 0.15, deckY + 1.6, -P + 0.15), 0.035, dark);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), aviation);
  beacon.position.set(-P + 0.15, deckY + 1.72, -P + 0.15);
  mast.add(beacon);

  // Work floodlights on the well-facing (−X) side, tilted down toward the well.
  for (const y of [9, H * 0.72]) {
    for (const z of [-0.6, 0.6]) {
      const housing = new THREE.Group();
      housing.position.set(-L - 0.35, y, z);
      housing.rotation.z = 0.55; // aim down and out toward the injector/wellhead
      box(housing, 0.25, 0.35, 0.5, dark, 0, 0, 0, false);
      box(housing, 0.02, 0.28, 0.42, lamp, -0.135, 0, 0, false);
      mast.add(housing);
      strut(mast, new THREE.Vector3(-L, y, z), new THREE.Vector3(-L - 0.25, y, z), 0.03, dark);
    }
  }

  // Racking board: fingers and a full guard rail around the derrickman's platform.
  const boardY = H * 0.6;
  for (const z of [-0.9, -0.45, 0, 0.45, 0.9]) box(mast, 1.2, 0.08, 0.08, yellow, -L - 2.4, boardY, z, false);
  railing(mast, [
    new THREE.Vector3(-L - 0.05, boardY, 1.1), new THREE.Vector3(-L - 1.85, boardY, 1.1),
    new THREE.Vector3(-L - 1.85, boardY, -1.1), new THREE.Vector3(-L - 0.05, boardY, -1.1),
  ], yellow, 1.05, 0.9);

  // Derrickman's emergency escape (Geronimo) line to a ground anchor outside the fence.
  // The mast is mounted 1.7 u above grade, so grade is at mast-local Y ≈ −1.7.
  const anchor = new THREE.Vector3(-3.5, -1.4, 21);
  mast.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-L - 1.75, boardY + 1.2, 1.0), anchor]),
    new THREE.LineBasicMaterial({ color: 0x3f3f46 }),
  ));
  cyl(mast, 0.08, 0.9, dark, anchor.x, anchor.y + 0.1, anchor.z, 'y', 8, false);
  box(mast, 0.6, 0.1, 0.6, mat(0x8b8a85, 0.95, 0.05), anchor.x, -1.65, anchor.z, false);
}
