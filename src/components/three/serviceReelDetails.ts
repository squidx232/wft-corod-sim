import * as THREE from 'three';

/**
 * Horizontal (turntable) CoRod service reel, in reel-local coordinates.
 *
 * A CoRod reel lies FLAT: the continuous rod is coiled like a rope around a
 * central vertical stake on a rotating platter, layer upon layer. The reel turns
 * about its vertical centre axis and the rod pays off the TOP of the pack, so the
 * pack gets lower from the top down — it does not shrink from the outside in like
 * a vertical coiled-tubing drum.
 */
export const REEL_GEOM = {
  /** Trailer deck top surface (local Y). */
  deckTopY: -1.91,
  /** Rotating platter top surface (local Y) — the first coil layer sits on it. */
  platterTopY: -1.75,
  /** Platter / containment radius. */
  rimR: 2.3,
  /** Central stake (spindle) radius the first wrap sits against. */
  stakeR: 0.38,
  /** Top of the rim containment posts (local Y). */
  postTopY: 0.0,
  /** Top of the central stake (local Y). */
  stakeTopY: 0.4,
};

/**
 * Builds the fixed trailer hardware into `frame` and the rotating platter,
 * stake and containment posts into `spool` (which spins about local Y).
 */
export function addServiceReelDetails(frame: THREE.Group, spool: THREE.Group): void {
  const G = REEL_GEOM;
  const paint = new THREE.MeshStandardMaterial({ color: 0xa51f27, metalness: 0.45, roughness: 0.48 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb9c3, metalness: 0.8, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252d35, metalness: 0.65, roughness: 0.55 });
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
  /** Vertical cylinder (axis = Y). */
  const vcyl = (parent: THREE.Object3D, rTop: number, rBot: number, h: number, mat: THREE.Material,
    x: number, y: number, z: number, seg = 32) => mesh(parent, new THREE.CylinderGeometry(rTop, rBot, h, seg), mat, x, y, z);
  /** Cylinder with its axis along Z (wheels). */
  const zcyl = (parent: THREE.Object3D, r: number, len: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = mesh(parent, new THREE.CylinderGeometry(r, r, len, 24), mat, x, y, z);
    m.rotation.x = Math.PI / 2;
    return m;
  };

  // --- Fixed: trailer chassis, wheels, turntable bearing and slew drive ----------
  for (const side of [-1, 1]) {
    mesh(frame, new THREE.BoxGeometry(6.5, 0.22, 0.16), dark, 0, -2.2, side * 1.1); // chassis rail
    for (const x of [-2.8, 0, 2.8]) {
      mesh(frame, new THREE.BoxGeometry(0.2, 0.09, 0.025), amber, x, -2.0, side * 2.46); // deck-edge reflectors
    }
    for (const x of [-2, 2]) {
      const wz = side * 1.4;
      zcyl(frame, 0.31, 0.37, steel, x, -2.6, wz);
      zcyl(frame, 0.14, 0.43, dark, x, -2.6, wz);
      for (const off of [-0.14, -0.07, 0, 0.07, 0.14]) {
        mesh(frame, new THREE.TorusGeometry(0.48, 0.025, 6, 24), rubber, x, -2.6, wz + off);
      }
      mesh(frame, new THREE.BoxGeometry(0.06, 0.42, 0.55), rubber, x + 0.62, -2.35, side * 1.4); // mud flap
    }
  }
  // Slewing-ring bearing on the deck (fixed outer race) and the hydraulic slew drive.
  vcyl(frame, 1.25, 1.3, 0.1, dark, 0, G.deckTopY + 0.05, 0, 48);
  vcyl(frame, 1.32, 1.32, 0.04, paint, 0, G.deckTopY + 0.02, 0, 48);
  mesh(frame, new THREE.BoxGeometry(0.42, 0.3, 0.36), paint, -1.45, G.deckTopY + 0.15, 0);
  vcyl(frame, 0.13, 0.13, 0.32, dark, -1.45, G.deckTopY + 0.46, 0, 16); // drive motor

  // --- Rotating: platter, spokes, rim, containment posts, central stake ----------
  const platterH = 0.08;
  const platterY = G.platterTopY - platterH / 2;
  vcyl(spool, G.rimR, G.rimR, platterH, steel, 0, platterY, 0, 64);
  vcyl(spool, 1.2, 1.2, 0.06, dark, 0, platterY - 0.07, 0, 48); // inner race / hub plate
  // Radial spokes under the platter (they read as the platter turning).
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const spoke = mesh(spool, new THREE.BoxGeometry(G.rimR - 0.2, 0.09, 0.12), paint,
      Math.cos(a) * (G.rimR / 2), platterY - 0.065, Math.sin(a) * (G.rimR / 2));
    spoke.rotation.y = -a;
  }
  // Rolled rim lip.
  const lip = mesh(spool, new THREE.TorusGeometry(G.rimR, 0.05, 8, 72), steel, 0, G.platterTopY, 0);
  lip.rotation.x = Math.PI / 2;
  // Containment posts around the rim keep the outer wraps on the platter.
  const postH = G.postTopY - G.platterTopY;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const post = mesh(spool, new THREE.BoxGeometry(0.1, postH, 0.1), paint,
      Math.cos(a) * (G.rimR - 0.04), G.platterTopY + postH / 2, Math.sin(a) * (G.rimR - 0.04));
    post.rotation.y = -a;
    vcyl(spool, 0.07, 0.07, 0.04, steel, Math.cos(a) * (G.rimR - 0.04), G.postTopY + 0.02, Math.sin(a) * (G.rimR - 0.04), 10);
  }
  // Central stake (spindle) the rod is coiled around, with a lifting cap.
  const stakeH = G.stakeTopY - G.platterTopY;
  vcyl(spool, G.stakeR, G.stakeR, stakeH, dark, 0, G.platterTopY + stakeH / 2, 0, 32);
  vcyl(spool, G.stakeR + 0.08, G.stakeR + 0.08, 0.08, paint, 0, G.stakeTopY, 0, 32);
  const eye = mesh(spool, new THREE.TorusGeometry(0.12, 0.03, 8, 16), steel, 0, G.stakeTopY + 0.16, 0);
  eye.rotation.y = Math.PI / 2;

  // Bolt circle on the platter (instanced).
  const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 6), steel, 24);
  const t = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    t.position.set(Math.cos(a) * (G.stakeR + 0.18), G.platterTopY + 0.02, Math.sin(a) * (G.stakeR + 0.18));
    t.updateMatrix();
    bolts.setMatrixAt(i, t.matrix);
  }
  bolts.instanceMatrix.needsUpdate = true;
  spool.add(bolts);
}
