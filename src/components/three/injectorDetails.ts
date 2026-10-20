import * as THREE from 'three';
import { createMeshKit } from './meshKit';

export interface InjectorDetailHandles {
  update(delta: number, rodFtPerSec: number, weightLbs: number): void;
}

/** Opposed endless gripper chains; inner runs share the rod's signed surface velocity. */
export function addInjectorDetails(group: THREE.Object3D, scene: THREE.Scene, bounds: THREE.Box3,
  opts: { groundWorldY: number; hoseEndWorld: THREE.Vector3 }): InjectorDetailHandles {
  const { mat, box, cyl, strut } = createMeshKit();
  const steel = mat(0x8b95a1, 0.4, 0.8), dark = mat(0x18212d, 0.5, 0.6);
  const brass = mat(0xc9a227, 0.35, 0.85), red = mat(0xc81e1e), black = mat(0x111111);
  const H = bounds.max.y - bounds.min.y;
  // Cut away only the front half of the imported housing to expose internal chains.
  // Planes are transformed each frame so the inspection cut follows injector vibration.
  const cut = new THREE.Plane();
  const localCut = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.45);
  group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => {
      const clone = m.clone(); clone.clippingPlanes = [cut]; clone.clipShadows = true; return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  });
  cyl(group, 0.48, 0.22, steel, 0, -0.11, 0, 'y', 20);
  for (let k = 0; k < 10; k++) {
    const a = k * Math.PI / 5;
    cyl(group, 0.035, 0.3, brass, Math.cos(a) * 0.5, -0.05, Math.sin(a) * 0.5, 'y', 6, false);
  }
  const low = bounds.min.y + H * 0.2, high = bounds.min.y + H * 0.8;
  const straight = high - low, radius = 0.3, perimeter = straight * 2 + Math.PI * 2 * radius;
  const count = Math.ceil(perimeter / 0.18), shoeGeo = new THREE.BoxGeometry(0.19, 0.14, 0.27);
  const matrix = new THREE.Object3D();
  const chains = [-1, 1].map(side => {
    const mesh = new THREE.InstancedMesh(shoeGeo, steel, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    mesh.name = side < 0 ? 'LeftGripperChain' : 'RightGripperChain';
    group.add(mesh);
    const center = side * (radius + 0.13);
    for (const y of [low, high]) {
      cyl(group, radius, 0.3, dark, center, y, 0, 'z', 16);
      cyl(group, 0.09, 0.34, brass, center, y, 0, 'z', 8);
    }
    return { mesh, side, center };
  });
  // Open inspection frame, rather than a solid cover hiding the moving runs.
  for (const z of [-0.3, 0.3]) {
    box(group, 1.65, 0.1, 0.1, red, 0, low - radius - 0.1, z);
    box(group, 1.65, 0.1, 0.1, red, 0, high + radius + 0.1, z);
  }
  const mx = bounds.max.x + 0.2, my = bounds.min.y + H * 0.45;
  box(group, 0.35, 0.6, 0.7, dark, mx, my, 0);
  group.updateWorldMatrix(true, false);
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
  cyl(group, 0.16, 0.55, red, 0.25, high, bounds.min.z - 0.2, 'y', 12);
  strut(group, new THREE.Vector3(0.25, high, bounds.min.z - 0.2), new THREE.Vector3(0, high - 0.5, 0), 0.015, brass);
  // Keep the encoder, load cell and safety markings; only the weight dial is removed.
  cyl(group, 0.16, 0.26, steel, 0, bounds.max.y + 0.62, 0.55, 'y', 12);
  const encoder = new THREE.Group(); encoder.position.set(0.16, bounds.max.y - 0.35, 0); group.add(encoder);
  cyl(encoder, 0.12, 0.05, dark, 0, 0, 0, 'z', 16);
  box(encoder, 0.2, 0.02, 0.055, brass, 0, 0, 0, false);
  for (const z of [-0.32, 0.32]) {
    for (let i = 0; i < 10; i++) {
      box(group, 0.13, 0.1, 0.06, i % 2 ? black : brass, -0.65 + i * 0.145, high + radius + 0.1, z, false);
    }
  }
  const greaseZ = bounds.max.z + 0.07;
  box(group, 0.4, 0.12, 0.1, brass, 0.2, low, greaseZ);
  for (let i = 0; i < 4; i++) strut(group, new THREE.Vector3(0.06 + i * 0.1, low, greaseZ), new THREE.Vector3(0, low + i * 0.4, 0.3), 0.008, brass);
  let distance = 0;
  return { update(delta, rodFtPerSec) {
    group.updateWorldMatrix(true, false);
    cut.copy(localCut).applyMatrix4(group.matrixWorld);
    encoder.rotation.z -= rodFtPerSec * 0.3048 * delta / 0.12;
    distance = THREE.MathUtils.euclideanModulo(distance + rodFtPerSec * 0.3048 * delta, perimeter);
    for (const chain of chains) {
      for (let i = 0; i < count; i++) {
        const s = THREE.MathUtils.euclideanModulo(i * perimeter / count + distance, perimeter);
        let x: number, y: number, angle: number;
        // Inner run rises; upper semicircle, outer return, lower semicircle.
        if (s < straight) { x = -radius; y = low + s; angle = 0; }
        else if (s < straight + Math.PI * radius) {
          const a = Math.PI - (s - straight) / radius;
          x = Math.cos(a) * radius; y = high + Math.sin(a) * radius; angle = a - Math.PI;
        } else if (s < straight * 2 + Math.PI * radius) {
          x = radius; y = high - (s - straight - Math.PI * radius); angle = -Math.PI;
        } else {
          const a = -(s - straight * 2 - Math.PI * radius) / radius;
          x = Math.cos(a) * radius; y = low + Math.sin(a) * radius; angle = a - Math.PI;
        }
        matrix.position.set(chain.center + x * chain.side, y, 0);
        matrix.rotation.z = -angle * chain.side;
        matrix.updateMatrix(); chain.mesh.setMatrixAt(i, matrix.matrix);
      }
      chain.mesh.instanceMatrix.needsUpdate = true;
    }
  } };
}
