import * as THREE from 'three';
import { createMeshKit } from './meshKit';

/**
 * MG-unit (mobile gripper truck) detail pass, fitted to the imported truck
 * model's named parts. Built in the model HOLDER's local space (the truck is
 * reversed: cab toward −X, deck/console toward +X / the well), so it rides the
 * truck's engine vibration with the body.
 */
export function addMgUnitDetails(holder: THREE.Object3D, root: THREE.Object3D): void {
  const kit = createMeshKit();
  const { mat, box, cyl, strut } = kit;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  holder.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const local = (o: THREE.Object3D | undefined | null): THREE.Box3 | null => {
    if (!o) return null;
    const b = new THREE.Box3().setFromObject(o);
    if (!Number.isFinite(b.min.x)) return null;
    return b.applyMatrix4(inv);
  };
  const all = local(root)!;
  const part = (name: string) => local(root.getObjectByName(name));
  const roof = part('MG_CabRoof') ?? part('MG_CabBody');
  const cab = part('MG_CabBody');
  const bed = part('MG_BedFloor');
  const fuel = part('MG_FuelTank_0');
  const axles = ['MG_Axle_steer', 'MG_Axle_drive1', 'MG_Axle_drive2'].map(part).filter((b): b is THREE.Box3 => !!b);
  if (!all || !roof || !cab) return;

  // Chassis frame of reference.
  const halfW = Math.min(Math.abs(all.min.z), Math.abs(all.max.z), 1.6) || 1.25; // half body width
  const sideZ = halfW - 0.05;
  const cabFront = cab.min.x, cabBack = cab.max.x;
  const roofY = roof.max.y;
  const rearX = all.max.x;
  const deckTop = bed ? bed.max.y : 1.6;
  const deckMinX = bed ? bed.min.x : cabBack + 0.4;
  const axleXs = axles.map((b) => (b.min.x + b.max.x) / 2).sort((a, b) => a - b);
  const rearAxleX = axleXs.length ? axleXs[axleXs.length - 1] : rearX - 1.6;
  const frontAxleX = axleXs.length ? axleXs[0] : cabFront + 1.0;
  const wheelR = axles.length ? THREE.MathUtils.clamp((axles[0].max.y - axles[0].min.y) * 0.25, 0.45, 0.65) : 0.55;

  const chrome = mat(0xdfe5ea, 0.15, 0.95);
  const dark = mat(0x111827, 0.6, 0.4);
  const rubber = mat(0x0b0b0c, 0.9, 0.0);
  const alu = mat(0xc7ccd1, 0.35, 0.85);
  const amberLens = mat(0xffb020, 0.3, 0.1, 0xff8a00, 0.9);
  const redLens = mat(0xd61f1f, 0.3, 0.1, 0xb00000, 0.8);
  const whiteLens = mat(0xffffff, 0.2, 0.1, 0xffffff, 0.5);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const tapeRed = mat(0xd61f1f, 0.35, 0.2, 0x400000, 0.2);
  const tapeWhite = mat(0xf5f5f5, 0.3, 0.2, 0x202020, 0.2);
  const hydTank = mat(0x374151, 0.5, 0.6);

  // --- Cab roof: LED light bar, beacons, air horns, clearance lights ---------
  const roofCx = (roof.min.x + roof.max.x) / 2;
  box(holder, 0.32, 0.12, halfW * 1.5, dark, roofCx - 0.1, roofY + 0.07, 0);
  for (const s of [-1, 1]) box(holder, 0.3, 0.1, halfW * 0.6, amberLens, roofCx - 0.1, roofY + 0.09, s * halfW * 0.38, false);
  for (const s of [-1, 1]) {
    cyl(holder, 0.11, 0.06, dark, roofCx + 0.4, roofY + 0.04, s * (halfW - 0.25), 'y', 14, false);
    cyl(holder, 0.09, 0.16, amberLens, roofCx + 0.4, roofY + 0.15, s * (halfW - 0.25), 'y', 14, false);
  }
  for (const s of [-1, 1]) cyl(holder, 0.05, 0.55, chrome, roofCx + 0.1, roofY + 0.08, s * 0.35, 'x', 10, false); // air horns
  for (let k = -2; k <= 2; k++) box(holder, 0.05, 0.05, 0.12, amberLens, roof.min.x + 0.03, roofY - 0.04, k * halfW * 0.3, false);

  // --- Mirrors + grab handles + steps at both cab doors ----------------------
  for (const s of [-1, 1]) {
    const z = s * (halfW + 0.02);
    strut(holder, V(cabFront + 0.25, cab.min.y + (cab.max.y - cab.min.y) * 0.75, z), V(cabFront + 0.1, cab.min.y + (cab.max.y - cab.min.y) * 0.8, z + s * 0.45), 0.02, chrome);
    box(holder, 0.06, 0.42, 0.22, dark, cabFront + 0.1, cab.min.y + (cab.max.y - cab.min.y) * 0.8, z + s * 0.5, false);
    box(holder, 0.04, 0.36, 0.18, mat(0x9fb4c8, 0.05, 0.9), cabFront + 0.06, cab.min.y + (cab.max.y - cab.min.y) * 0.8, z + s * 0.5, false);
    strut(holder, V(cabBack - 0.05, cab.min.y + 0.2, z + s * 0.04), V(cabBack - 0.05, cab.max.y - 0.2, z + s * 0.04), 0.02, chrome);
    for (const sy of [0.42, 0.85]) box(holder, 0.5, 0.04, 0.24, alu, (cabFront + cabBack) / 2, sy, z + s * 0.1, false);
  }

  // --- Exhaust stack behind the cab (−Z side) ------------------------------
  const exX = cabBack + 0.22, exZ = -(halfW - 0.3);
  cyl(holder, 0.09, roofY + 0.9 - 1.0, chrome, exX, (roofY + 0.9 + 1.0) / 2, exZ, 'y', 14);
  cyl(holder, 0.13, 1.3, dark, exX, roofY - 0.4, exZ, 'y', 14, false); // heat shield
  const cap = cyl(holder, 0.1, 0.02, dark, exX + 0.05, roofY + 0.93, exZ, 'y', 12, false);
  cap.rotation.z = 0.5;

  // --- Under-chassis: air tanks, toolboxes, hydraulic tank, battery box ------
  const chassisY = Math.max(0.75, wheelR + 0.25);
  const fuelBack = fuel ? fuel.max.x : cabBack + 0.6;
  for (const s of [-1, 1]) {
    cyl(holder, 0.17, 1.0, mat(0x9ca3af, 0.4, 0.8), fuelBack + 0.75, chassisY - 0.05, s * (sideZ - 0.25), 'x', 14, false);
    // Diamond-plate toolbox under the deck between the axles.
    const tbX = Math.min(rearAxleX - wheelR - 0.9, deckMinX + 1.6);
    box(holder, 1.2, 0.55, 0.45, alu, tbX, chassisY + 0.05, s * (sideZ - 0.2));
    box(holder, 0.25, 0.04, 0.02, chrome, tbX, chassisY + 0.18, s * (sideZ + 0.03), false);
  }
  // Hydraulic reservoir (−Z) with sight glass + return filter; battery box (+Z).
  box(holder, 0.9, 0.75, 0.5, hydTank, fuelBack + 1.9, chassisY + 0.12, -(sideZ - 0.25));
  box(holder, 0.04, 0.35, 0.06, amberLens, fuelBack + 1.6, chassisY + 0.12, -(sideZ + 0.01), false);
  cyl(holder, 0.09, 0.35, mat(0x1d4ed8, 0.5, 0.4), fuelBack + 2.2, chassisY + 0.65, -(sideZ - 0.25), 'y', 12, false);
  box(holder, 0.75, 0.5, 0.45, dark, fuelBack + 1.9, chassisY + 0.05, sideZ - 0.25);

  // --- Mud flaps, tail/reverse lights, plate, rear marker bar -----------------
  for (const s of [-1, 1]) {
    box(holder, 0.04, 0.75, 0.55, rubber, rearAxleX + wheelR + 0.25, wheelR * 0.75 + 0.2, s * (sideZ - 0.3));
    box(holder, 0.06, 0.16, 0.3, redLens, rearX + 0.01, chassisY + 0.05, s * (sideZ - 0.3), false);
    box(holder, 0.06, 0.1, 0.14, whiteLens, rearX + 0.01, chassisY - 0.12, s * (sideZ - 0.55), false);
  }
  const plateTex = kit.signTexture([{ text: 'WFT · 7741', color: '#111111', size: 90 }], '#f4f4f5', 512, 160, '#111111');
  kit.signPlane(holder, plateTex, 0.5, 0.16, rearX + 0.02, chassisY - 0.1, 0, Math.PI / 2);

  // --- Side marker lights + DOT conspicuity tape along both sides ------------
  for (const s of [-1, 1]) {
    const z = s * (sideZ + 0.02);
    for (let x = frontAxleX + 1.2; x < rearX - 0.4; x += 1.6) box(holder, 0.1, 0.06, 0.03, amberLens, x, chassisY + 0.28, z, false);
    let k = 0;
    for (let x = cabBack + 0.4; x < rearX - 0.2; x += 0.3, k++) box(holder, 0.28, 0.05, 0.01, k % 2 ? tapeWhite : tapeRed, x, chassisY + 0.42, z, false);
    // Yellow deck-edge safety stripe.
    box(holder, Math.max(0.5, rearX - deckMinX - 0.2), 0.04, 0.03, yellow, (rearX + deckMinX) / 2, deckTop + 0.02, z, false);
  }

  // --- Weatherford side decals on the deck skirts -----------------------------
  const decal = kit.signTexture([
    { text: 'Weatherford', color: '#c8102e', size: 84 },
    { text: 'CoRod® MOBILE GRIPPER UNIT', color: '#1f2937', size: 30 },
  ], '#f4f4f5', 640, 200);
  const decalX = (cabBack + rearAxleX) / 2;
  kit.signPlane(holder, decal, 1.7, 0.53, decalX, chassisY + 0.85, sideZ + 0.04, 0);
  kit.signPlane(holder, decal, 1.7, 0.53, decalX, chassisY + 0.85, -(sideZ + 0.04), Math.PI);

  // --- Safety kit on the cab back wall: extinguisher + first-aid box ---------
  const kz = halfW - 0.45;
  cyl(holder, 0.09, 0.5, mat(0xc81e1e, 0.45, 0.3), cabBack + 0.08, cab.min.y + 0.55, kz, 'y', 12);
  box(holder, 0.04, 0.3, 0.38, mat(0x15803d, 0.5, 0.2), cabBack + 0.04, cab.min.y + 0.85, kz - 0.45);
  box(holder, 0.01, 0.12, 0.04, whiteLens, cabBack + 0.065, cab.min.y + 0.85, kz - 0.45, false);

  // --- Wheel chocks at the rear axle (on the ground; truck is parked) -------
  for (const s of [-1, 1]) {
    const chock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 3), yellow);
    chock.rotation.set(Math.PI / 2, 0, 0);
    chock.position.set(rearAxleX + wheelR + 0.12, 0.12, s * (sideZ - 0.25));
    chock.castShadow = true;
    holder.add(chock);
  }
}
