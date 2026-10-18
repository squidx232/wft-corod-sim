import * as THREE from 'three';
import { MeshKit, placement } from './meshKit';

/** Vertical travel at the horsehead per radian of walking-beam rotation. */
export const PUMPJACK_HORSEHEAD_REACH = 5.3;

/**
 * Pump-jack detail pass in PUMPJACK-LOCAL space (well end at +X, Samson post
 * at the origin with its saddle at Y = `postTopY`, gearbox/crank centred at
 * X = −4.6). Returns the polished-rod hanger, which the render loop moves
 * vertically with the walking beam so the rod strokes straight into the
 * stuffing box instead of swinging with the beam.
 */
export function addPumpjackDetails(pumpjack: THREE.Group, kit: MeshKit, postTopY: number): {
  hanger: THREE.Group;
  hangerRestY: number;
} {
  const { mat, box, cyl, strut, pipe, railing } = kit;
  const concrete = mat(0x9ca3af, 0.95, 0.05);
  const dark = mat(0x111827, 0.6, 0.4);
  const steel = mat(0x8b95a1, 0.4, 0.8);
  const rodChrome = mat(0xdfe5ea, 0.15, 0.95);
  const wellheadPaint = mat(0x6b7280, 0.55, 0.6);
  const valveRed = mat(0xc81e1e, 0.5, 0.3);
  const guard = mat(0xf2c200, 0.55, 0.3);
  const cable = mat(0x2b2b2b, 0.5, 0.7);
  const flowline = mat(0x2f3540, 0.7, 0.5);
  const panelGrey = mat(0xa7adb5, 0.6, 0.4);
  const amber = mat(0xffb020, 0.35, 0.1, 0xff8a00, 0.6);

  // Concrete foundation under the gear end, a gearbox sub-base and motor rails
  // so the gearbox and prime mover sit on something instead of floating.
  box(pumpjack, 5.3, 0.25, 3.6, concrete, -5.65, 0.125, 0, false);
  box(pumpjack, 1.8, 0.45, 1.7, dark, -4.6, 0.475, 0);
  box(pumpjack, 1.0, 0.4, 0.8, dark, -7.0, 0.45, 0.9, false);
  // Belt guard bridging the motor sheave to the gearbox input shaft.
  box(pumpjack, 2.2, 1.1, 0.1, guard, -6.0, 1.3, 1.37);

  // Crank guard: a U-shaped safety fence around the rotating counterweights.
  railing(pumpjack, [
    new THREE.Vector3(-2.4, 0.25, 1.6), new THREE.Vector3(-8.0, 0.25, 1.6),
    new THREE.Vector3(-8.0, 0.25, -1.6), new THREE.Vector3(-2.4, 0.25, -1.6),
  ], guard, 1.1, 1.4);

  // Brake lever and linkage on the post side of the guard.
  strut(pumpjack, new THREE.Vector3(-2.8, 0.25, 1.85), new THREE.Vector3(-2.8, 1.5, 1.85), 0.04, valveRed, 8, true);
  strut(pumpjack, new THREE.Vector3(-2.8, 1.45, 1.85), new THREE.Vector3(-3.8, 1.6, 0.9), 0.02, dark);

  // Motor starter / pump-off controller panel on a post at the motor end.
  strut(pumpjack, new THREE.Vector3(-8.9, 0, 1.2), new THREE.Vector3(-8.9, 1.7, 1.2), 0.05, dark, 8, true);
  box(pumpjack, 0.25, 0.7, 0.5, panelGrey, -8.75, 1.3, 1.2);
  box(pumpjack, 0.03, 0.08, 0.08, amber, -8.61, 1.55, 1.05, false);
  pipe(pumpjack, [new THREE.Vector3(-8.75, 0.95, 1.2), new THREE.Vector3(-8.75, 0.3, 1.2), new THREE.Vector3(-7.3, 0.3, 1.0)], 0.03, dark);

  // Wellhead under the horsehead: casing head, tubing head, pumping tee and
  // stuffing box, with a flowline and casing valve.
  const wx = PUMPJACK_HORSEHEAD_REACH;
  cyl(pumpjack, 0.35, 0.4, wellheadPaint, wx, 0.2, 0, 'y', 18);
  cyl(pumpjack, 0.42, 0.08, wellheadPaint, wx, 0.42, 0, 'y', 18, false);
  cyl(pumpjack, 0.26, 0.2, wellheadPaint, wx, 0.55, 0, 'y', 16);
  cyl(pumpjack, 0.14, 0.5, wellheadPaint, wx, 0.85, 0, 'y', 14);
  cyl(pumpjack, 0.1, 0.2, steel, wx, 1.2, 0, 'y', 12, false);
  pipe(pumpjack, [
    new THREE.Vector3(wx, 0.85, 0.1), new THREE.Vector3(wx, 0.85, 0.9),
    new THREE.Vector3(wx, 0.15, 0.9), new THREE.Vector3(wx, 0.15, 6.0),
  ], 0.06, flowline);
  box(pumpjack, 0.18, 0.22, 0.32, wellheadPaint, wx, 0.85, 0.55, false); // check valve
  cyl(pumpjack, 0.07, 0.5, wellheadPaint, wx, 0.2, -0.55, 'z', 10, false);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 16), valveRed);
  wheel.position.set(wx, 0.2, -0.82);
  pumpjack.add(wheel);
  for (const z of [3, 5.5]) box(pumpjack, 0.2, 0.15, 0.2, dark, wx, 0.07, z, false); // pipe supports

  // Polished-rod hanger: wireline bridle, carrier bar, rod clamp and polished rod.
  const hanger = new THREE.Group();
  const hangerRestY = postTopY - 2.3;
  hanger.position.set(wx, hangerRestY, 0);
  for (const z of [-0.12, 0.12]) {
    strut(hanger, new THREE.Vector3(0, 0, z), new THREE.Vector3(0, 2.3, z), 0.022, cable, 6);
  }
  box(hanger, 0.12, 0.12, 0.5, dark, 0, 0, 0, false);
  box(hanger, 0.16, 0.12, 0.16, steel, 0, 0.12, 0, false);
  cyl(hanger, 0.04, 2.5, rodChrome, 0, -0.95, 0, 'y', 10, false);
  pumpjack.add(hanger);

  return { hanger, hangerRestY };
}

export interface TankBatteryLayout {
  startX: number;
  z: number;
  radius: number;
  height: number;
  /** Y of the tank bottoms (top of the containment pad). */
  baseY: number;
  count: number;
  spacing: number;
}

function hazardDiamondTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const q = size / 4;
    const quads: Array<[number, number, string, string]> = [
      [c, q, '#d62020', '3'], [q, c, '#1f5fd6', '1'], [c + q, c, '#f4d000', '0'], [c, c + q, '#ffffff', ''],
    ];
    for (const [x, y, fill, digit] of quads) {
      ctx.beginPath();
      ctx.moveTo(x, y - q);
      ctx.lineTo(x + q, y);
      ctx.lineTo(x, y + q);
      ctx.lineTo(x - q, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#111';
      ctx.stroke();
      if (digit) {
        ctx.fillStyle = '#111';
        ctx.font = 'bold 60px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(digit, x, y + 2);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Tank-battery detail: stair tower, catwalk across the tank roofs, thief
 * hatches and PV vents, level gauge boards, NFPA placards and tank IDs,
 * truck load-out stands and lease signage on the containment berm.
 */
export function addTankBatteryDetails(scene: THREE.Scene, kit: MeshKit, t: TankBatteryLayout): void {
  const { mat, box, cyl, strut, pipe, railing, instanced, signTexture, signPlane } = kit;
  const R = t.radius;
  const roofY = t.baseY + t.height + 0.25;
  const lastX = t.startX + (t.count - 1) * t.spacing;
  const walkZ = t.z - 1.2;
  const walkStartX = t.startX - R - 0.6;
  const galvanised = mat(0x9aa3ad, 0.55, 0.7);
  const grating = mat(0x6b7280, 0.7, 0.6);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const dark = mat(0x1c1917, 0.7, 0.5);
  const valveRed = mat(0xc81e1e, 0.5, 0.3);
  const white = mat(0xe5e7eb, 0.6, 0.2);

  // Catwalk across all tank roofs with guard rails on both sides.
  const walkLen = lastX + R * 0.6 - walkStartX;
  box(scene, walkLen, 0.08, 0.9, grating, walkStartX + walkLen / 2, roofY + 0.04, walkZ);
  for (const dz of [-0.45, 0.45]) {
    railing(scene, [new THREE.Vector3(walkStartX, roofY + 0.08, walkZ + dz), new THREE.Vector3(walkStartX + walkLen, roofY + 0.08, walkZ + dz)], yellow, 1.05, 1.6);
  }

  // Stair from grade up to the catwalk at the west end of the battery.
  const foot = new THREE.Vector3(walkStartX - 7.4, 0, walkZ);
  const top = new THREE.Vector3(walkStartX, roofY, walkZ);
  for (const dz of [-0.45, 0.45]) {
    strut(scene, foot.clone().setZ(walkZ + dz), top.clone().setZ(walkZ + dz), 0.06, galvanised, 8, true);
    railing(scene, [foot.clone().setZ(walkZ + dz), top.clone().setZ(walkZ + dz)], yellow, 1.0, 1.8);
  }
  const treads: THREE.Matrix4[] = [];
  const steps = Math.round((roofY - foot.y) / 0.22);
  for (let i = 1; i < steps; i++) {
    const p = foot.clone().lerp(top, i / steps);
    treads.push(placement(p.x, p.y, p.z));
  }
  instanced(scene, new THREE.BoxGeometry(0.28, 0.04, 0.9), grating, treads);
  for (const f of [0.35, 0.7]) {
    const p = foot.clone().lerp(top, f);
    for (const dz of [-0.45, 0.45]) {
      strut(scene, new THREE.Vector3(p.x, 0, walkZ + dz), new THREE.Vector3(p.x, p.y, walkZ + dz), 0.06, galvanised, 8, true);
    }
  }

  // Per-tank roof fittings, gauge boards, ID stencils and hazard placards.
  const diamond = hazardDiamondTexture();
  const placardMaterial = new THREE.MeshStandardMaterial({ map: diamond, transparent: true, alphaTest: 0.1, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < t.count; i++) {
    const x = t.startX + i * t.spacing;
    cyl(scene, 0.25, 0.15, galvanised, x - 0.9, roofY + 0.07, t.z + 0.4, 'y', 14, false); // thief hatch
    cyl(scene, 0.27, 0.05, dark, x - 0.9, roofY + 0.17, t.z + 0.4, 'y', 14, false);
    box(scene, 0.3, 0.25, 0.3, galvanised, x + R * 0.5, roofY + 0.85, t.z, false); // PV vent / arrestor

    const gaugeAngle = Math.PI / 3;
    const gx = x + (R + 0.06) * Math.sin(gaugeAngle);
    const gz = t.z + (R + 0.06) * Math.cos(gaugeAngle);
    const board = box(scene, 0.06, t.height - 0.4, 0.14, white, gx, t.baseY + t.height / 2, gz, false);
    board.rotation.y = gaugeAngle;
    const target = box(scene, 0.08, 0.25, 0.22, mat(0xff6a00, 0.5, 0.2), gx, t.baseY + t.height * (0.35 + 0.1 * i), gz, false);
    target.rotation.y = gaugeAngle;

    const placardAngle = Math.PI / 7;
    const placard = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), placardMaterial);
    placard.position.set(x + (R + 0.04) * Math.sin(placardAngle), t.baseY + 2.4, t.z + (R + 0.04) * Math.cos(placardAngle));
    placard.rotation.y = placardAngle;
    scene.add(placard);

    const idAngle = -Math.PI / 7;
    const idTexture = signTexture([{ text: `TK-${101 + i}`, color: '#111111', size: 110 }, { text: 'CRUDE OIL', color: '#111111', size: 44 }], '#c7ccd2', 512, 256);
    signPlane(scene, idTexture, 1.8, 0.9, x + (R + 0.04) * Math.sin(idAngle), t.baseY + 4.8, t.z + (R + 0.04) * Math.cos(idAngle), idAngle);
  }

  // Truck load-out stands in front of the berm: riser from the manifold, valve,
  // handwheel, hose coupling and drip pan.
  const midX = t.startX + ((t.count - 1) * t.spacing) / 2;
  const manifoldZ = t.z + R + 0.6;
  const standZ = t.z + R + 3.6;
  for (const dx of [-3, 3]) {
    const x = midX + dx;
    pipe(scene, [
      new THREE.Vector3(x, 0.9, manifoldZ), new THREE.Vector3(x, 1.6, manifoldZ),
      new THREE.Vector3(x, 1.6, standZ), new THREE.Vector3(x, 0.95, standZ),
    ], 0.11, dark);
    box(scene, 0.32, 0.32, 0.32, valveRed, x, 1.25, standZ, false);
    const handwheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 18), valveRed);
    handwheel.position.set(x, 1.6, standZ + 0.35);
    scene.add(handwheel);
    cyl(scene, 0.15, 0.2, galvanised, x, 0.85, standZ, 'y', 14, false);
    box(scene, 0.9, 0.12, 0.9, dark, x, 0.06, standZ, false);
    strut(scene, new THREE.Vector3(x, 0, standZ - 1.2), new THREE.Vector3(x, 1.5, standZ - 1.2), 0.05, galvanised, 8, true);
  }

  // Lease sign on two posts at the front of the containment berm.
  const signTex = signTexture([
    { text: 'WEATHERFORD', color: '#c8102e', size: 64 },
    { text: 'TANK BATTERY No. 1', color: '#111111', size: 44 },
    { text: '⚠ DANGER  H2S MAY BE PRESENT', color: '#b91c1c', size: 34 },
    { text: 'NO SMOKING · NO OPEN FLAMES', color: '#111111', size: 30 },
  ], '#f5f5f0', 768, 384, '#111111');
  const signX = t.startX - R + 1.0;
  const signZ = t.z + R + 3.4;
  for (const dx of [-1.1, 1.1]) strut(scene, new THREE.Vector3(signX + dx, 0, signZ), new THREE.Vector3(signX + dx, 2.9, signZ), 0.05, galvanised, 8, true);
  signPlane(scene, signTex, 2.8, 1.4, signX, 2.15, signZ + 0.06, 0);
}

/**
 * Production facility on its own gravel pad: vertical heater-treater with
 * firetube stack, horizontal two-phase separator on saddles, gas meter run,
 * interconnecting piping and a guyed flare stack.
 */
export function addProductionFacility(scene: THREE.Scene, kit: MeshKit, x: number, z: number, groundY: number): void {
  const { mat, box, cyl, strut, pipe, railing } = kit;
  const vessel = mat(0xd9d4c7, 0.6, 0.35);
  const dark = mat(0x1c1917, 0.7, 0.5);
  const galvanised = mat(0x9aa3ad, 0.55, 0.7);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const valveRed = mat(0xc81e1e, 0.5, 0.3);
  const gravel = mat(0x6f6455, 0.98, 0.02);
  const flame = mat(0xff8c1a, 0.4, 0, 0xff6a00, 2.0);
  const g = groundY;

  box(scene, 15, 0.2, 11, gravel, x, g + 0.1, z, false);
  const base = g + 0.2;

  // Vertical heater-treater with skirt, burner box, firetube stack and platform.
  const tx = x - 3.5;
  cyl(scene, 1.15, 0.6, dark, tx, base + 0.3, z, 'y', 24);
  cyl(scene, 1.1, 6, vessel, tx, base + 3.6, z, 'y', 28);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), vessel);
  head.position.set(tx, base + 6.6, z);
  head.castShadow = true;
  scene.add(head);
  box(scene, 0.8, 0.8, 0.8, dark, tx, base + 1.4, z + 1.35);
  cyl(scene, 0.2, 4.2, dark, tx + 0.5, base + 8.4, z + 0.3, 'y', 12);
  box(scene, 2.0, 0.08, 1.2, mat(0x6b7280, 0.7, 0.6), tx, base + 5.4, z - 1.6);
  railing(scene, [new THREE.Vector3(tx - 1.0, base + 5.44, z - 1.1), new THREE.Vector3(tx - 1.0, base + 5.44, z - 2.2), new THREE.Vector3(tx + 1.0, base + 5.44, z - 2.2), new THREE.Vector3(tx + 1.0, base + 5.44, z - 1.1)], yellow, 1.0, 1.0);
  for (const dz of [-0.2, 0.2]) box(scene, 0.05, 5.4, 0.05, galvanised, tx - 1.0, base + 2.7, z - 1.6 + dz, false);

  // Horizontal separator on saddles with relief valve.
  const sx = x + 2.5;
  const sz = z - 2.2;
  cyl(scene, 0.75, 4.2, vessel, sx, base + 1.6, sz, 'x', 24);
  for (const dx of [-2.1, 2.1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 12), vessel);
    cap.scale.set(0.45, 1, 1);
    cap.position.set(sx + dx, base + 1.6, sz);
    cap.castShadow = true;
    scene.add(cap);
  }
  for (const dx of [-1.3, 1.3]) box(scene, 0.4, 0.9, 1.2, dark, sx + dx, base + 0.45, sz);
  cyl(scene, 0.09, 0.6, valveRed, sx + 1.0, base + 2.6, sz, 'y', 10, false);

  // Interconnecting piping, gas meter run with orifice fitting, inlet header.
  pipe(scene, [
    new THREE.Vector3(sx - 2.4, base + 1.6, sz), new THREE.Vector3(tx + 1.4, base + 1.6, sz),
    new THREE.Vector3(tx + 1.4, base + 1.6, z), new THREE.Vector3(tx + 1.1, base + 1.6, z),
  ], 0.08, dark);
  pipe(scene, [
    new THREE.Vector3(sx, base + 2.35, sz), new THREE.Vector3(sx, base + 3.0, sz),
    new THREE.Vector3(sx, base + 3.0, z + 2.5), new THREE.Vector3(sx + 4.8, base + 3.0, z + 2.5),
  ], 0.07, galvanised);
  box(scene, 0.4, 0.45, 0.35, valveRed, sx + 2.0, base + 3.0, z + 2.5, false);
  pipe(scene, [
    new THREE.Vector3(tx - 1.1, base + 0.9, z), new THREE.Vector3(x - 7.4, base + 0.9, z),
  ], 0.08, dark);
  for (const px of [x - 6, sx + 3.5]) strut(scene, new THREE.Vector3(px, base, px > x ? z + 2.5 : z), new THREE.Vector3(px, base + (px > x ? 3.0 : 0.9), px > x ? z + 2.5 : z), 0.05, galvanised, 8, true);

  // Guyed flare stack with pilot flame at the pad corner.
  const fx = x + 6.2;
  const fz = z + 4.2;
  cyl(scene, 0.22, 12, galvanised, fx, base + 6, fz, 'y', 12);
  cyl(scene, 0.32, 0.6, dark, fx, base + 12.2, fz, 'y', 12, false);
  const pilot = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 10), flame);
  pilot.position.set(fx, base + 13.05, fz);
  scene.add(pilot);
  const guy = new THREE.LineBasicMaterial({ color: 0x3f3f46 });
  for (const [dx, dz] of [[4, 0], [-2, 3.5], [-2, -3.5]]) {
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(fx, base + 10, fz), new THREE.Vector3(fx + dx, base, fz + dz),
    ]), guy));
  }
}
