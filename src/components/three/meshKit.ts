import * as THREE from 'three';

/**
 * Small procedural-modelling toolkit shared by the oilfield scene builders.
 * Materials are cached per kit so repeated parts share one GPU material, and
 * fine details default to not casting shadows to keep the shadow pass cheap.
 */
export type MeshKit = ReturnType<typeof createMeshKit>;

const UP = new THREE.Vector3(0, 1, 0);

export function createMeshKit() {
  const materials = new Map<string, THREE.MeshStandardMaterial>();

  function mat(color: number, roughness = 0.6, metalness = 0.4, emissive = 0x000000, emissiveIntensity = 0) {
    const key = `${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
      materials.set(key, material);
    }
    return material;
  }

  function add<T extends THREE.Mesh>(parent: THREE.Object3D, mesh: T, castShadow: boolean): T {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material,
    x: number, y: number, z: number, castShadow = true) {
    const mesh = add(parent, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), castShadow);
    mesh.position.set(x, y, z);
    return mesh;
  }

  /** Cylinder whose long axis follows `axis`. */
  function cyl(parent: THREE.Object3D, radius: number, length: number, material: THREE.Material,
    x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y', segments = 16, castShadow = true) {
    const mesh = add(parent, new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material), castShadow);
    mesh.position.set(x, y, z);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  /** Round member (pipe, cylinder rod, handrail) spanning two points. */
  function strut(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number,
    material: THREE.Material, segments = 8, castShadow = false) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const mesh = add(parent, new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), material), castShadow);
    mesh.position.copy(a).addScaledVector(delta, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
    return mesh;
  }

  /** Pipe run through a polyline of points (elbows are implied by joints). */
  function pipe(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material) {
    for (let i = 1; i < points.length; i++) strut(parent, points[i - 1], points[i], radius, material, 10);
    for (let i = 1; i < points.length - 1; i++) {
      const elbow = add(parent, new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 10, 8), material), false);
      elbow.position.copy(points[i]);
    }
  }

  /**
   * Guard railing along a polyline at floor level `points`: posts plus a top
   * rail and knee rail, matching standard 42" (≈1.05 u) industrial handrails.
   */
  function railing(parent: THREE.Object3D, points: THREE.Vector3[], material: THREE.Material,
    height = 1.05, postSpacing = 1.6) {
    const lift = (p: THREE.Vector3, h: number) => p.clone().setY(p.y + h);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const spans = Math.max(1, Math.round(a.distanceTo(b) / postSpacing));
      for (let s = i === 1 ? 0 : 1; s <= spans; s++) {
        const p = a.clone().lerp(b, s / spans);
        strut(parent, p, lift(p, height), 0.025, material, 6);
      }
      strut(parent, lift(a, height), lift(b, height), 0.022, material, 6);
      strut(parent, lift(a, height * 0.5), lift(b, height * 0.5), 0.018, material, 6);
    }
  }

  /** One draw call for many copies of the same part. */
  function instanced(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
    transforms: THREE.Matrix4[], castShadow = false) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
    transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Canvas-backed label/sign texture (text lines centred on a coloured board). */
  function signTexture(lines: Array<{ text: string; color?: string; size?: number }>,
    background: string, width = 512, height = 256, border?: string) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = Math.max(6, width * 0.02);
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const totalSize = lines.reduce((sum, l) => sum + (l.size ?? 48) * 1.25, 0);
      let y = (height - totalSize) / 2;
      for (const line of lines) {
        const size = line.size ?? 48;
        ctx.font = `bold ${size}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle = line.color ?? '#111111';
        y += size * 0.625;
        ctx.fillText(line.text, width / 2, y);
        y += size * 0.625;
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function signPlane(parent: THREE.Object3D, texture: THREE.Texture, w: number, h: number,
    x: number, y: number, z: number, rotationY = 0) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide }));
    plane.position.set(x, y, z);
    plane.rotation.y = rotationY;
    parent.add(plane);
    return plane;
  }

  return { mat, box, cyl, strut, pipe, railing, instanced, signTexture, signPlane };
}

/** Matrix helper for instanced parts. */
export function placement(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0,
  sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Deterministic PRNG so procedural scatter is identical on every load. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
