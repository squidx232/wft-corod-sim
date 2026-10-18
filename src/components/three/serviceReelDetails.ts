import * as THREE from 'three';

/** Static trailer details and rotating steelwork, in reel-local coordinates.
 * The axle is Z; keep all fixed bearings outside the flanges at Z = ±1.25.
 */
export function addServiceReelDetails(frame: THREE.Group, spool: THREE.Group): void {
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

  function beam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3,
    width: number, depth: number, material: THREE.Material): void {
    const delta = b.clone().sub(a);
    const part = mesh(parent, new THREE.BoxGeometry(width, delta.length(), depth), material,
      (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }

  function cylinder(parent: THREE.Object3D, radius: number, length: number,
    material: THREE.Material, x: number, y: number, z: number, segments = 32): THREE.Mesh {
    const part = mesh(parent, new THREE.CylinderGeometry(radius, radius, length, segments), material, x, y, z);
    part.rotation.x = Math.PI / 2;
    return part;
  }

  // Shared bolt geometry and instancing keep the repeated flange hardware cheap.
  const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 6), steel, 48);
  const transform = new THREE.Object3D();
  let boltIndex = 0;
  for (const side of [-1, 1]) {
    const z = side * 1.25;
    // Flat annular flange plates, rolled outer lips, and an inner stiffening ring.
    const plate = mesh(spool, new THREE.RingGeometry(2.08, 2.3, 64), steel, 0, 0, z);
    // RingGeometry has one face; cloning the material avoids changing all steel parts.
    const plateMaterial = steel.clone();
    plateMaterial.side = THREE.DoubleSide;
    plate.material = plateMaterial;
    mesh(spool, new THREE.TorusGeometry(2.3, 0.065, 8, 64), steel, 0, 0, z);
    mesh(spool, new THREE.TorusGeometry(1.35, 0.035, 6, 48), steel, 0, 0, z);
    cylinder(spool, 0.36, 0.16, paint, 0, 0, z);
    cylinder(spool, 0.22, 0.23, steel, 0, 0, z);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      beam(spool, direction.clone().multiplyScalar(0.32).setZ(z),
        direction.clone().multiplyScalar(2.18).setZ(z), 0.1, 0.09, steel);
    }
    for (const radius of [0.28, 2.19]) {
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        transform.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z + side * 0.065);
        transform.rotation.set(Math.PI / 2, 0, angle);
        transform.updateMatrix();
        bolts.setMatrixAt(boltIndex++, transform.matrix);
      }
    }
    // Bearing blocks and feet stay stationary while the hubs turn within them.
    mesh(frame, new THREE.BoxGeometry(0.62, 0.5, 0.28), paint, 0, 0, side * 1.58);
    cylinder(frame, 0.19, 0.32, dark, 0, 0, side * 1.59);
    cylinder(frame, 0.1, 0.06, steel, 0, 0, side * 1.78);
    for (const x of [-1.2, 1.2]) {
      beam(frame, new THREE.Vector3(x, -2.45, side * 1.58),
        new THREE.Vector3(0, -0.12, side * 1.58), 0.21, 0.22, paint);
      mesh(frame, new THREE.BoxGeometry(0.6, 0.08, 0.55), dark, x, -2.42, side * 1.58);
    }
    beam(frame, new THREE.Vector3(-1.2, -1.9, side * 1.58),
      new THREE.Vector3(1.2, -1.9, side * 1.58), 0.1, 0.12, paint);
    // Longitudinal chassis rails and reflective markers.
    mesh(frame, new THREE.BoxGeometry(6.5, 0.22, 0.14), dark, 0, -2.6, side * 1.42);
    for (const x of [-2.8, 0, 2.8]) {
      mesh(frame, new THREE.BoxGeometry(0.2, 0.09, 0.025), amber, x, -2.53, side * 1.51);
    }
    for (const x of [-2, 2]) {
      // Recessed wheel rims, hub caps, sidewalls and circumferential tread ribs.
      const wheelZ = side * 1.4;
      cylinder(frame, 0.31, 0.37, steel, x, -2.6, wheelZ);
      cylinder(frame, 0.14, 0.43, dark, x, -2.6, wheelZ);
      for (const offset of [-0.14, -0.07, 0, 0.07, 0.14]) {
        mesh(frame, new THREE.TorusGeometry(0.48, 0.025, 6, 24), rubber, x, -2.6, wheelZ + offset);
      }
      // Rolled fenders aligned to the wheels, with vertical mud flaps.
      mesh(frame, new THREE.BoxGeometry(1.3, 0.07, 0.68), dark, x, -2.04, side * 1.5);
      mesh(frame, new THREE.BoxGeometry(0.06, 0.42, 0.55), rubber, x + 0.62, -2.28, side * 1.5);
    }
  }
  bolts.instanceMatrix.needsUpdate = true;
  bolts.castShadow = true;
  spool.add(bolts);

  // Brake rotor and motor housing on the far bearing, clear of the wound rod.
  cylinder(spool, 0.5, 0.06, dark, 0, 0, -1.43);
  mesh(frame, new THREE.BoxGeometry(0.28, 0.35, 0.2), paint, 0.4, 0, -1.43);
  cylinder(frame, 0.27, 0.5, dark, 0, 0, -1.98);
  cylinder(frame, 0.3, 0.09, paint, 0, 0, -2.2);
}
