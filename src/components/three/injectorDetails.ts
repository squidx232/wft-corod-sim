import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMeshKit } from './meshKit';

export interface InjectorDetailHandles {
  update(delta: number, rodFtPerSec: number, weightLbs: number): void;
}

/**
 * Gripper-chain geometry in the imported injector model's OWN units (the GLB is
 * ~0.8 wide × 1.9 tall × 0.45 deep before scaling). Two endless chains run in
 * the housing's chain pockets around top/bottom sprockets at x = ±0.16; their
 * inner runs close on the rod from both sides, like a CoRod / rod injector.
 */
export const INJECTOR_CHAIN_LAYOUT = {
  sprocketX: 0.16,
  lowY: 0.3,
  highY: 1.6,
  shoeThickness: 0.06,
  padThickness: 0.014,
  shoeDepth: 0.075,
  pitch: 0.05,
  /** Frame body interior (model units), used to keep every link inside the housing. */
  frame: { halfX: 0.4, minY: 0, maxY: 1.9, halfZ: 0.225 },
} as const;

/** Model parts replaced by the animated chains, or modelling helpers that must never render. */
const HIDDEN_MODEL_PARTS = /^(Chain_[LR]_(Block|Tooth)|Sprocket_[LR]_|SqueezeCyl_|ChainTens_|CoRod_)|Cutter|TubingPath_Ref/;
/** Front wall of the housing, cut away as an inspection face so the chains are visible. */
const FRONT_WALL_PARTS = /^(Injector_FrameBody|Injector_FrontBolt|PanelFastener_F)/;

export interface InjectorDetailOptions {
  groundWorldY: number;
  hoseEndWorld: THREE.Vector3;
  /** The imported injector model root (gltf.scene). Chains are built in its space. */
  model: THREE.Object3D;
  /** World radius of the rod strand that passes through the injector. */
  rodRadiusWorld?: number;
}

export function addInjectorDetails(group: THREE.Object3D, scene: THREE.Scene, bounds: THREE.Box3,
  opts: InjectorDetailOptions): InjectorDetailHandles {
  const { mat, box, cyl, strut } = createMeshKit();
  const steel = mat(0x8b95a1, 0.4, 0.8), dark = mat(0x18212d, 0.5, 0.6);
  const brass = mat(0xc9a227, 0.35, 0.85), black = mat(0x111111);
  const H = bounds.max.y - bounds.min.y;
  const low = bounds.min.y + H * 0.2, high = bounds.min.y + H * 0.8;
  const model = opts.model;
  const L = INJECTOR_CHAIN_LAYOUT;

  // --- Prepare the imported housing ------------------------------------------------
  const cut = new THREE.Plane();
  const localCut = new THREE.Plane();
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (HIDDEN_MODEL_PARTS.test(mesh.name)) { mesh.visible = false; return; }
    if (FRONT_WALL_PARTS.test(mesh.name)) {
      const clip = (m: THREE.Material) => {
        const c = m.clone(); c.clippingPlanes = [cut]; c.clipShadows = true; c.side = THREE.DoubleSide; return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clip) : clip(mesh.material);
    }
  });

  // Rod line in model space (the injector group's origin axis), clamped to the slot.
  group.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const rodLocal = model.worldToLocal(group.localToWorld(new THREE.Vector3(0, 0, 0)));
  const rodX = THREE.MathUtils.clamp(rodLocal.x, -0.04, 0.04);
  const chainZ = THREE.MathUtils.clamp(rodLocal.z, -0.19, 0.04 - L.shoeDepth / 2 + 0.03);
  const modelScale = Math.max(1e-6, model.getWorldScale(new THREE.Vector3()).y);
  const rodR = (opts.rodRadiusWorld ?? 0.045) / modelScale + 0.002;
  // Shoe centres run on this path; the pad faces just touch the rod surface.
  const rp = L.sprocketX - (rodR + L.padThickness + L.shoeThickness / 2);
  const straight = L.highY - L.lowY;
  const perimeter = straight * 2 + Math.PI * 2 * rp;
  const count = Math.round(perimeter / L.pitch);
  const pitch = perimeter / count;
  // Front face of the housing removed just ahead of the chain plane (model −Z faces the operator).
  localCut.set(new THREE.Vector3(0, 0, 1), -(chainZ - L.shoeDepth / 2 - 0.03));

  const chainRoot = new THREE.Group();
  chainRoot.name = 'InjectorGripperChains';
  model.add(chainRoot);
  const shoeMat = mat(0x6f7a86, 0.45, 0.85);
  const padMat = mat(0x1c1c1f, 0.85, 0.2);
  const shoeGeo = new THREE.BoxGeometry(L.shoeThickness, pitch * 0.86, L.shoeDepth);
  // Gripper insert on the shoe's outward face (+X local) — it bites the rod on the inner run.
  const padGeo = new THREE.BoxGeometry(L.padThickness, pitch * 0.8, L.shoeDepth * 0.8)
    .translate(L.shoeThickness / 2 + L.padThickness / 2, 0, 0);
  const sprocketGeo = buildSprocketGeometry(rp - 0.012, L.shoeDepth * 0.7, 14);
  const sprocketMat = mat(0x9aa3ad, 0.35, 0.9);
  const skateMat = mat(0xd4a017, 0.4, 0.7), frameMat = mat(0x0f4c81, 0.55, 0.45);
  const cylMat = mat(0x1d5fa8, 0.5, 0.5), rodMat = mat(0xd9dee5, 0.2, 0.95);

  const chains = [-1, 1].map(side => {
    const cx = rodX + side * L.sprocketX;
    const shoes = new THREE.InstancedMesh(shoeGeo, shoeMat, count);
    const pads = new THREE.InstancedMesh(padGeo, padMat, count);
    for (const m of [shoes, pads]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = true;
      chainRoot.add(m);
    }
    shoes.name = side < 0 ? 'LeftGripperChain' : 'RightGripperChain';
    pads.name = side < 0 ? 'LeftGripperPads' : 'RightGripperPads';
    const sprockets = [L.lowY, L.highY].map(y => {
      const s = new THREE.Mesh(sprocketGeo, sprocketMat);
      s.position.set(cx, y, chainZ);
      s.name = `${side < 0 ? 'Left' : 'Right'}Sprocket${y === L.lowY ? 'Bottom' : 'Top'}`;
      chainRoot.add(s);
      return s;
    });
    // Pressure skate behind the inner run, pushed toward the rod by squeeze
    // cylinders mounted on a backbone at the loop centre (all inside the loop).
    const skateX = cx - side * (rp - L.shoeThickness / 2 - 0.014);
    box(chainRoot, 0.018, straight * 0.82, L.shoeDepth * 0.7, skateMat, skateX, (L.lowY + L.highY) / 2, chainZ);
    box(chainRoot, 0.03, straight * 0.7, L.shoeDepth * 0.5, frameMat, cx, (L.lowY + L.highY) / 2, chainZ);
    for (const y of [L.lowY + straight * 0.3, L.lowY + straight * 0.7]) {
      const span = Math.abs(skateX - cx) - 0.02;
      cyl(chainRoot, 0.022, span * 0.55, cylMat, cx - side * span * 0.3, y, chainZ, 'x', 10, false);
      cyl(chainRoot, 0.009, span * 0.5, rodMat, skateX + side * span * 0.25, y, chainZ, 'x', 8, false);
    }
    // Chain tensioner block above the top sprocket.
    box(chainRoot, 0.05, 0.03, L.shoeDepth * 0.6, frameMat, cx, L.highY + rp + L.shoeThickness / 2 + L.padThickness + 0.03, chainZ);
    return { shoes, pads, side, cx, sprockets };
  });

  // --- Exterior details (injector-group space) ---------------------------------------
  cyl(group, 0.48, 0.22, steel, 0, -0.11, 0, 'y', 20);
  for (let k = 0; k < 10; k++) {
    const a = k * Math.PI / 5;
    cyl(group, 0.035, 0.3, brass, Math.cos(a) * 0.5, -0.05, Math.sin(a) * 0.5, 'y', 6, false);
  }
  const mx = bounds.max.x + 0.2, my = bounds.min.y + H * 0.45;
  box(group, 0.35, 0.6, 0.7, dark, mx, my, 0);
  for (let i = 0; i < 4; i++) {
    const z = -0.24 + i * 0.16;
    cyl(group, 0.045, 0.17, brass, mx + 0.22, my, z, 'x', 6, false);
    const start = group.localToWorld(new THREE.Vector3(mx + 0.3, my, z));
    const end = opts.hoseEndWorld.clone().add(new THREE.Vector3(0, 0, i * 0.12));
    const curve = new THREE.CatmullRomCurve3([start, start.clone().add(new THREE.Vector3(1, -2, 1)),
      new THREE.Vector3(start.x + 1.2, opts.groundWorldY + 0.08, 3.4 + i * 0.15),
      new THREE.Vector3(end.x + 3, opts.groundWorldY + 0.08, end.z), end]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 70, 0.04, 6, false), black));
  }
  // Load cell on the hanger and the depth encoder wheel.
  cyl(group, 0.16, 0.26, steel, 0, bounds.max.y + 0.62, 0.55, 'y', 12);
  const encoder = new THREE.Group(); encoder.position.set(0.16, bounds.max.y - 0.35, 0); group.add(encoder);
  cyl(encoder, 0.12, 0.05, dark, 0, 0, 0, 'z', 16);
  box(encoder, 0.2, 0.02, 0.055, brass, 0, 0, 0, false);
  const greaseZ = bounds.max.z + 0.07;
  box(group, 0.4, 0.12, 0.1, brass, 0.2, low, greaseZ);
  for (let i = 0; i < 4; i++) strut(group, new THREE.Vector3(0.06 + i * 0.1, low, greaseZ), new THREE.Vector3(0, low + i * 0.4, 0.3), 0.008, brass);
  void high;

  // --- Animation -----------------------------------------------------------------------
  const tmp = new THREE.Object3D();
  /** Shoe pose at arc-length u: inner run rises next to the rod, outer run returns. */
  const place = (cx: number, side: number, u: number) => {
    let x: number, y: number, phi: number;
    if (u < straight) {
      x = cx - side * rp; y = L.lowY + u; phi = side < 0 ? 0 : Math.PI;
    } else if (u < straight + Math.PI * rp) {
      const a = (u - straight) / rp;
      phi = side < 0 ? a : Math.PI - a;
      x = cx + Math.cos(phi) * rp; y = L.highY + Math.sin(phi) * rp;
    } else if (u < straight * 2 + Math.PI * rp) {
      x = cx + side * rp; y = L.highY - (u - straight - Math.PI * rp); phi = side < 0 ? Math.PI : 0;
    } else {
      const a = (u - straight * 2 - Math.PI * rp) / rp;
      phi = side < 0 ? Math.PI + a : -a;
      x = cx + Math.cos(phi) * rp; y = L.lowY + Math.sin(phi) * rp;
    }
    tmp.position.set(x, y, chainZ);
    tmp.rotation.set(0, 0, phi);
    tmp.updateMatrix();
    return tmp.matrix;
  };

  let distance = 0;
  const update = (delta: number, rodFtPerSec: number) => {
    // Inspection cut follows the (vibrating / hoisted) injector.
    model.updateWorldMatrix(true, false);
    cut.copy(localCut).applyMatrix4(model.matrixWorld);
    const step = (rodFtPerSec * 0.3048 * delta) / modelScale; // rod surface travel, model units
    encoder.rotation.z -= rodFtPerSec * 0.3048 * delta / 0.12;
    distance = THREE.MathUtils.euclideanModulo(distance + step, perimeter);
    for (const chain of chains) {
      for (let i = 0; i < count; i++) {
        const m = place(chain.cx, chain.side, THREE.MathUtils.euclideanModulo(i * pitch + distance, perimeter));
        chain.shoes.setMatrixAt(i, m);
        chain.pads.setMatrixAt(i, m);
      }
      chain.shoes.instanceMatrix.needsUpdate = true;
      chain.pads.instanceMatrix.needsUpdate = true;
      // Inner run rising = left loop counter-clockwise, right loop clockwise (viewed from the front).
      for (const s of chain.sprockets) s.rotation.z += (-chain.side * step) / rp;
    }
  };
  update(0, 0);
  return { update };
}

/** Disc + hub + teeth merged into one geometry (axis = Z) so each sprocket is one draw call. */
function buildSprocketGeometry(radius: number, width: number, teeth: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(radius, radius, width, 24).rotateX(Math.PI / 2));
  parts.push(new THREE.CylinderGeometry(radius * 0.35, radius * 0.35, width * 1.6, 12).rotateX(Math.PI / 2));
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    parts.push(new THREE.BoxGeometry(radius * 0.22, radius * 0.18, width * 0.9)
      .translate(radius * 1.05, 0, 0).rotateZ(a));
  }
  // Spokes (lightening holes look) so rotation reads clearly through the inspection face.
  for (let k = 0; k < 4; k++) {
    parts.push(new THREE.BoxGeometry(radius * 1.6, radius * 0.12, width * 1.1).rotateZ((k * Math.PI) / 4));
  }
  const nonIndexed = parts.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(nonIndexed, false) ?? nonIndexed[0];
  parts.forEach(g => { if (g !== merged) g.dispose(); });
  return merged;
}
