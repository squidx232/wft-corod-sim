import * as THREE from 'three';

/**
 * CoRod service reel, in reel-local coordinates.
 *
 * Built like a coiled-tubing reel (drum core + two spoked flanges inside a
 * hinged base) but laid HORIZONTALLY: the drum axis is vertical.
 * The reel is LOW and WIDE: solid-but-flexible CoRod is wound in a wide band
 * around a ring of separate vertical columns (no solid core wall), in flat
 * layers stacked upward; it pays off the TOP, so the pack gets lower top →
 * bottom — the middle of the reel is open, nothing empties from the centre.
 *
 * The whole cradle is hinged along its FRONT edge (+Z, the side facing the
 * guide head / the left side of the MG) and tilted up at the BACK (−Z) by a
 * pair of hydraulic cylinders, so the reel sits slightly inclined toward the
 * pay-off side.
 */
import { REEL_GEOM, REEL_MEAN_WRAP_FT, reelRpmForSpeed } from './serviceReelGeometry';
export { REEL_GEOM, REEL_MEAN_WRAP_FT, reelRpmForSpeed };

/** Inverse of `cradleToReelLocal`: reel-local point → cradle (untilted) coordinates. */
export function reelLocalToCradle(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const G = REEL_GEOM;
  const c = Math.cos(G.tilt), s = Math.sin(G.tilt);
  const dy = y - G.hingeY, dz = z - G.hingeZ;
  return out.set(x, G.hingeY + dy * c + dz * s, G.hingeZ - dy * s + dz * c);
}

/** Reel-local position of a point given in the cradle's untilted coordinates. */
export function cradleToReelLocal(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const G = REEL_GEOM;
  const c = Math.cos(G.tilt), s = Math.sin(G.tilt);
  const dy = y - G.hingeY, dz = z - G.hingeZ;
  return out.set(x, G.hingeY + dy * c - dz * s, G.hingeZ + dy * s + dz * c);
}

// --- Shared materials + mesh helpers -----------------------------------------
const paint = new THREE.MeshStandardMaterial({ color: 0xa51f27, metalness: 0.45, roughness: 0.48 });
const steel = new THREE.MeshStandardMaterial({ color: 0xaeb9c3, metalness: 0.8, roughness: 0.38 });
const steelDs = steel.clone(); steelDs.side = THREE.DoubleSide;
const dark = new THREE.MeshStandardMaterial({ color: 0x252d35, metalness: 0.65, roughness: 0.55 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.95, roughness: 0.15 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.95 });
const amber = new THREE.MeshStandardMaterial({ color: 0xf5a623, roughness: 0.4 });

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
  x: number, y: number, z: number): THREE.Mesh {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}
/** Box beam between two points. */
function beam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, mat: THREE.Material) {
  const delta = b.clone().sub(a);
  const part = mesh(parent, new THREE.BoxGeometry(w, delta.length(), d), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return part;
}
/** Round bar between two points. */
function rod(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const delta = b.clone().sub(a);
  const part = mesh(parent, new THREE.CylinderGeometry(r, r, delta.length(), 16), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return part;
}
const vcyl = (parent: THREE.Object3D, rTop: number, rBot: number, h: number, mat: THREE.Material,
  x: number, y: number, z: number, seg = 32) => mesh(parent, new THREE.CylinderGeometry(rTop, rBot, h, seg), mat, x, y, z);
const zcyl = (parent: THREE.Object3D, r: number, len: number, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = mesh(parent, new THREE.CylinderGeometry(r, r, len, 24), mat, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
};
const xcyl = (parent: THREE.Object3D, r: number, len: number, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = mesh(parent, new THREE.CylinderGeometry(r, r, len, 16), mat, x, y, z);
  m.rotation.z = Math.PI / 2;
  return m;
};
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Builds the reel:
 * - `frame`  : fixed trailer hardware (reel-local): chassis, wheels, hinge
 *              brackets, tilt cylinders.
 * - `cradle` : the tilting base frame (untilted coordinates; caller
 *              applies the hinge transform — see `createTiltedCradle`).
 * The rotating drum is built separately by `buildReelDrum`.
 */
export function addServiceReelDetails(frame: THREE.Group, cradle: THREE.Group): void {
  const G = REEL_GEOM;

  // ===== Fixed trailer hardware ======================================================
  for (const side of [-1, 1]) {
    mesh(frame, new THREE.BoxGeometry(6.5, 0.22, 0.16), dark, 0, -2.2, side * 1.1); // chassis rail
    for (const x of [-2.8, 0, 2.8]) {
      mesh(frame, new THREE.BoxGeometry(0.2, 0.09, 0.025), amber, x, -2.0, side * (G.deckHalfZ + 0.01)); // deck-edge reflectors
    }
    for (const x of [-2, 2]) {
      const wz = side * 1.4;
      zcyl(frame, 0.31, 0.37, steel, x, -2.6, wz);
      zcyl(frame, 0.14, 0.43, dark, x, -2.6, wz);
      for (const off of [-0.14, -0.07, 0, 0.07, 0.14]) {
        mesh(frame, new THREE.TorusGeometry(0.48, 0.025, 6, 24), rubber, x, -2.6, wz + off);
      }
      mesh(frame, new THREE.BoxGeometry(0.06, 0.42, 0.55), rubber, x + 0.62, -2.35, wz); // mud flap
    }
  }
  // Hinge brackets along the front edge (the cradle pivots on these pins).
  for (const x of [-1.9, 1.9]) {
    mesh(frame, new THREE.BoxGeometry(0.3, 0.14, 0.3), paint, x, G.deckTopY + 0.07, G.hingeZ);
    xcyl(frame, 0.06, 0.42, steel, x, G.hingeY, G.hingeZ);
  }
  // Two tilt cylinders at the BACK: deck clevis → underside of the cradle's back rail.
  for (const x of [-1.6, 1.6]) {
    const foot = V(x, G.deckTopY + 0.12, -1.55);
    const head = cradleToReelLocal(x, G.frameBaseY - 0.1, -G.frameHalf + 0.12);
    mesh(frame, new THREE.BoxGeometry(0.26, 0.12, 0.26), paint, x, G.deckTopY + 0.06, -1.55);
    const split = foot.clone().lerp(head, 0.55);
    rod(frame, foot, split, 0.09, paint);                    // barrel
    rod(frame, split.clone().lerp(foot, 0.08), head, 0.045, chrome); // ram
    vcyl(frame, 0.11, 0.11, 0.08, dark, split.x, split.y, split.z, 16); // gland
  }

  // ===== Tilting cradle: low base frame only (no cage around the reel) ===============
  // The flanges contain the rod; the cradle is just the hinged base under the
  // drum that the tilt cylinders push on, carrying the slewing bearing + drive.
  const H = G.frameHalf, yb = G.frameBaseY;
  const corners = [V(-H, 0, -H), V(H, 0, -H), V(H, 0, H), V(-H, 0, H)];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    beam(cradle, V(a.x, yb, a.z), V(b.x, yb, b.z), 0.2, 0.2, paint); // base rails
  }
  beam(cradle, V(-H, yb, 0), V(H, yb, 0), 0.22, 0.2, paint);       // cross-members
  beam(cradle, V(0, yb, -H), V(0, yb, H), 0.22, 0.2, paint);
  vcyl(cradle, 0.55, 0.6, 0.2, dark, 0, yb + 0.2, 0, 32); // slewing bearing housing
  mesh(cradle, new THREE.BoxGeometry(0.4, 0.28, 0.34), paint, -1.1, yb + 0.24, 0); // hydraulic drive
  vcyl(cradle, 0.12, 0.12, 0.3, dark, -1.1, yb + 0.52, 0, 16);

}

/**
 * Rotating drum hardware (add to the spool, which spins about cradle Y): ring
 * of separate columns, centre axle, solid bottom flange and open top flange.
 * Built to `topFlangeY` so the reel is just tall enough for the well's rod.
 */
export function buildReelDrum(topFlangeY: number): THREE.Group {
  const G = REEL_GEOM;
  const drum = new THREE.Group();
  // ===== Rotating drum ================================================================
  // Ring of SEPARATE vertical columns the rod is wound around (no solid wall),
  // the centre axle and its cap.
  const coreH = topFlangeY - G.platterTopY;
  for (let i = 0; i < G.columnCount; i++) {
    const a = (i * Math.PI * 2) / G.columnCount;
    const col = mesh(drum, new THREE.BoxGeometry(0.11, coreH, 0.11), paint,
      Math.cos(a) * G.columnR, G.platterTopY + coreH / 2, Math.sin(a) * G.columnR);
    col.rotation.y = -a;
  }
  vcyl(drum, 0.2, 0.2, coreH, steel, 0, G.platterTopY + coreH / 2, 0, 16); // centre axle
  const flange = (y: number, solid: boolean) => {
    if (solid) {
      vcyl(drum, G.rimR, G.rimR, 0.06, steel, 0, y - 0.03, 0, 64);
    } else {
      // Narrow outer ring only: leaves a gap over the wraps for the rod to leave the top.
      const ring = mesh(drum, new THREE.RingGeometry(G.rimR - 0.09, G.rimR, 72), steelDs, 0, y, 0);
      ring.rotation.x = -Math.PI / 2;
    }
    const lip = mesh(drum, new THREE.TorusGeometry(G.rimR, 0.065, 8, 72), steel, 0, y, 0);
    lip.rotation.x = Math.PI / 2;
    const inner = mesh(drum, new THREE.TorusGeometry(G.columnR, 0.035, 6, 64), steel, 0, y, 0); // ties the column ends
    inner.rotation.x = Math.PI / 2;
    vcyl(drum, G.hubR, G.hubR, 0.12, paint, 0, y, 0, 32); // hub
    const off = solid ? -0.08 : 0.06; // spokes under the bottom plate / on top of the top ring
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const d = V(Math.cos(a), 0, Math.sin(a));
      beam(drum, d.clone().multiplyScalar(G.hubR - 0.05).setY(y + off), d.clone().multiplyScalar(G.rimR - 0.08).setY(y + off), 0.1, 0.09, steel);
    }
  };
  flange(G.platterTopY, true);
  flange(topFlangeY, false);
  // Yellow index mark on the top flange rim — count drum turns by eye.
  mesh(drum, new THREE.BoxGeometry(0.34, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, emissive: 0x3a2f00 }),
    G.rimR - 0.04, topFlangeY + 0.05, 0);

  // Flange bolt circles (instanced).
  const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 6), steel, 48);
  const t = new THREE.Object3D();
  let k = 0;
  for (const y of [G.platterTopY - 0.09, topFlangeY + 0.08]) {
    for (const r of [G.hubR - 0.08, G.rimR - 0.06]) {
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        t.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        t.updateMatrix();
        bolts.setMatrixAt(k++, t.matrix);
      }
    }
  }
  bolts.instanceMatrix.needsUpdate = true;
  drum.add(bolts);
  return drum;
}

/**
 * Creates the hinged cradle groups: `pivot` (add to the reel group) sits on the
 * front hinge line and carries the tilt; `cradle` inside it uses untilted
 * reel-local coordinates.
 */
export function createTiltedCradle(): { pivot: THREE.Group; cradle: THREE.Group } {
  const G = REEL_GEOM;
  const pivot = new THREE.Group();
  pivot.position.set(0, G.hingeY, G.hingeZ);
  pivot.rotation.x = G.tilt;
  const cradle = new THREE.Group();
  cradle.position.set(0, -G.hingeY, -G.hingeZ);
  pivot.add(cradle);
  return { pivot, cradle };
}
