import * as THREE from 'three';
import { MeshKit, placement, seededRandom } from './meshKit';

export interface SiteLayout {
  groundAt: (x: number, z: number) => number;
  /** Lease pad rectangle (world). */
  pad: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Areas to keep clear of scattered vegetation/rocks (equipment, facilities). */
  keepClear: Array<{ x: number; z: number; r: number }>;
  keepClearRects: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
}

/** Lease-road centreline: leaves the west pad edge and curves gently toward the horizon. */
export const LEASE_ROAD = {
  startX: -34,
  endX: -250,
  width: 7,
  centerZ(x: number): number {
    const t = THREE.MathUtils.clamp((-45 - x) / 200, 0, 1);
    return 7 + 10 * Math.sin(t * Math.PI * 0.5);
  },
};

function ribbon(points: THREE.Vector3[], width: number, surfaceAt: (x: number, z: number) => number,
  lift: number, material: THREE.Material): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev).setY(0).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
    if (i > 0) distance += points[i].distanceTo(points[i - 1]);
    for (const s of [-1, 1]) {
      const x = points[i].x + side.x * s;
      const z = points[i].z + side.z * s;
      positions.push(x, surfaceAt(x, z) + lift, z);
      uvs.push(s < 0 ? 0 : 1, distance / width);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Lease-level dressing that makes the site read as a working oilfield:
 * a graded lease road with wheel ruts and entry gate, desert scrub, rocks and
 * dry grass, portable light towers, a crew/doghouse trailer, a tubular pipe
 * rack, a windsock, a muster-point sign and a portable toilet.
 */
/** Muster-point sign location (world XZ); crew evacuate to just in front of it. */
export const MUSTER_SIGN = { x: -15, z: 18.5 };

/** Live handles for lighting / wind animation (see siteAtmosphere.ts). */
export interface OilfieldSiteHandles {
  /** Lamp-lens material on the light towers (emissive driven by time of day). */
  lampMaterial: THREE.MeshStandardMaterial;
  /** Light-tower spotlights (intensity 0 at build; driven live). */
  towerLights: THREE.SpotLight[];
  /** Orient and flutter the windsock. `wind` = velocity vector (m/s) the air moves toward. */
  updateWindsock(wind: THREE.Vector3, time: number): void;
}

export function addOilfieldSiteDetails(scene: THREE.Scene, kit: MeshKit, site: SiteLayout): OilfieldSiteHandles {
  const { mat, box, cyl, strut, railing, instanced, signTexture, signPlane } = kit;
  const { groundAt } = site;
  const towerLights: THREE.SpotLight[] = [];
  let windsock: THREE.Group | null = null;
  const galvanised = mat(0x9aa3ad, 0.55, 0.7);
  const dark = mat(0x1f2937, 0.6, 0.5);
  const yellow = mat(0xf2c200, 0.55, 0.3);
  const rubber = mat(0x0b0b0c, 0.95, 0.05);

  // --- Lease road with ruts, following the terrain ------------------------------
  // On the pad the road lies on the pad surface (Y ≈ 0.01); off it, on the terrain.
  const inPad = (x: number, z: number) => x >= site.pad.minX && x <= site.pad.maxX && z >= site.pad.minZ && z <= site.pad.maxZ;
  const surfaceAt = (x: number, z: number) => (inPad(x, z) ? Math.max(groundAt(x, z), 0.01) : groundAt(x, z));
  const roadPoints: THREE.Vector3[] = [];
  for (let x = LEASE_ROAD.startX; x >= LEASE_ROAD.endX; x -= 2) roadPoints.push(new THREE.Vector3(x, 0, LEASE_ROAD.centerZ(x)));
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x7d6c55, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  scene.add(ribbon(roadPoints, LEASE_ROAD.width, surfaceAt, 0.12, roadMaterial));
  const rutMaterial = new THREE.MeshStandardMaterial({ color: 0x5e5040, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const offset of [-1.4, 1.4]) {
    const rut = roadPoints.map((p, i) => {
      const next = roadPoints[Math.min(roadPoints.length - 1, i + 1)];
      const prev = roadPoints[Math.max(0, i - 1)];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      return p.clone().add(new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(offset));
    });
    scene.add(ribbon(rut, 0.55, surfaceAt, 0.14, rutMaterial));
  }

  // Entry gate (pipe-frame cattle guard posts + swing gate) and lease sign.
  const gateX = site.pad.minX - 1;
  const gateZ = LEASE_ROAD.centerZ(gateX);
  for (const s of [-1, 1]) {
    strut(scene, new THREE.Vector3(gateX, 0, gateZ + s * 4.3), new THREE.Vector3(gateX, 1.6, gateZ + s * 4.3), 0.09, galvanised, 10, true);
  }
  const gate = new THREE.Group();
  gate.position.set(gateX, 0, gateZ - 4.3);
  gate.rotation.y = -1.2; // swung open
  for (const y of [0.5, 1.0, 1.45]) strut(gate, new THREE.Vector3(0, y, 0), new THREE.Vector3(0, y, 4.2), 0.04, galvanised);
  strut(gate, new THREE.Vector3(0, 0.4, 4.2), new THREE.Vector3(0, 1.5, 4.2), 0.04, galvanised);
  strut(gate, new THREE.Vector3(0, 0.5, 0.2), new THREE.Vector3(0, 1.45, 4.1), 0.03, galvanised);
  scene.add(gate);
  const leaseSign = signTexture([
    { text: 'WEATHERFORD', color: '#c8102e', size: 70 },
    { text: 'CoRod® WELL SERVICING', color: '#111111', size: 40 },
    { text: 'LEASE  WFT-ALS  WELL No. 7', color: '#111111', size: 36 },
    { text: 'EMERGENCY  ☎  911', color: '#b91c1c', size: 34 },
  ], '#fafaf5', 768, 384, '#111111');
  const signX = gateX - 1.5;
  const signZ = gateZ + 6.5;
  for (const dz of [-1.2, 1.2]) strut(scene, new THREE.Vector3(signX, 0, signZ + dz), new THREE.Vector3(signX, 3.2, signZ + dz), 0.06, galvanised, 8, true);
  signPlane(scene, leaseSign, 3.0, 1.5, signX - 0.07, 2.4, signZ, -Math.PI / 2);

  // --- Scattered vegetation and rocks (instanced, kept off roads/pads) ---------------
  const rnd = seededRandom(90210);
  const blocked = (x: number, z: number, margin: number) => {
    const p = site.pad;
    if (x > p.minX - margin && x < p.maxX + margin && z > p.minZ - margin && z < p.maxZ + margin) return true;
    if (x < LEASE_ROAD.startX && x > LEASE_ROAD.endX - 5 && Math.abs(z - LEASE_ROAD.centerZ(x)) < LEASE_ROAD.width / 2 + margin) return true;
    if (site.keepClear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin)) return true;
    return site.keepClearRects.some((r) => x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin);
  };
  const scatter = (count: number, minR: number, maxR: number, margin: number,
    make: (x: number, z: number, gy: number) => THREE.Matrix4) => {
    const out: THREE.Matrix4[] = [];
    for (let i = 0; i < count * 3 && out.length < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = minR + Math.sqrt(rnd()) * (maxR - minR);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (blocked(x, z, margin)) continue;
      out.push(make(x, z, groundAt(x, z)));
    }
    return out;
  };
  const shrubGeometry = new THREE.IcosahedronGeometry(1, 0);
  const sageGreen = mat(0x6b7448, 1, 0);
  const dryBrush = mat(0x8f7d4e, 1, 0);
  for (const material of [sageGreen, dryBrush]) {
    instanced(scene, shrubGeometry, material, scatter(380, 47, 230, 1.5, (x, z, gy) => {
      const s = 0.45 + rnd() * 0.9;
      return placement(x, gy + s * 0.25, z, 0, rnd() * Math.PI, 0, s * (1 + rnd() * 0.5), s * 0.6, s);
    }), true);
  }
  instanced(scene, new THREE.ConeGeometry(0.22, 0.7, 5), mat(0xb39b62, 1, 0),
    scatter(900, 46, 140, 0.8, (x, z, gy) => {
      const s = 0.6 + rnd() * 0.8;
      return placement(x, gy + 0.3 * s, z, (rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3, s);
    }));
  instanced(scene, new THREE.DodecahedronGeometry(1, 0), mat(0x7a6c5a, 1, 0),
    scatter(320, 47, 240, 1, (x, z, gy) => {
      const s = 0.25 + rnd() * rnd() * 1.6;
      return placement(x, gy + s * 0.3, z, rnd() * 3, rnd() * 3, rnd() * 3, s, s * 0.65, s * (0.8 + rnd() * 0.5));
    }), true);

  // --- Portable light towers ------------------------------------------------------
  const lampMaterial = mat(0xfff4d6, 0.2, 0.1, 0xfff1c1, 0.4);
  const buildLightTower = (x: number, z: number, faceY: number) => {
    const tower = new THREE.Group();
    tower.position.set(x, groundAt(x, z) + 0.15, z);
    tower.rotation.y = faceY;
    box(tower, 2.6, 1.0, 1.3, mat(0xf2c200, 0.5, 0.35), 0, 0.95, 0);
    box(tower, 0.6, 0.8, 1.32, dark, 0.7, 0.95, 0, false); // generator louvres
    for (const z0 of [-0.75, 0.75]) cyl(tower, 0.32, 0.22, rubber, -0.3, 0.32, z0, 'z', 16, false);
    strut(tower, new THREE.Vector3(1.3, 0.6, 0), new THREE.Vector3(2.4, 0.4, 0), 0.05, dark); // tow tongue
    for (const s of [-1, 1]) {
      strut(tower, new THREE.Vector3(-1.2, 0.7, s * 0.6), new THREE.Vector3(-1.2, 0.05, s * 1.6), 0.05, dark);
      box(tower, 0.3, 0.06, 0.3, dark, -1.2, 0.03, s * 1.6, false);
    }
    strut(tower, new THREE.Vector3(-1.0, 1.45, 0), new THREE.Vector3(-1.0, 8.0, 0), 0.09, galvanised, 10, true);
    strut(tower, new THREE.Vector3(-1.0, 8.0, -1.1), new THREE.Vector3(-1.0, 8.0, 1.1), 0.05, galvanised);
    for (const [dz, dy] of [[-0.75, 0.3], [0.75, 0.3], [-0.75, -0.25], [0.75, -0.25]]) {
      const head = new THREE.Group();
      head.position.set(-0.85, 8.0 + dy, dz);
      head.rotation.z = -0.35;
      box(head, 0.18, 0.45, 0.55, dark, 0, 0, 0, false);
      box(head, 0.02, 0.38, 0.48, lampMaterial, 0.1, 0, 0, false);
      tower.add(head);
    }
    // Stronger, wider night-work beam (intensity driven live by the atmosphere).
    const light = new THREE.SpotLight(0xfff1d0, 0, 95, Math.PI / 3.2, 0.5, 2);
    light.position.set(-0.7, 8.0, 0);
    light.target.position.set(14, -8, 0);
    tower.add(light, light.target);
    towerLights.push(light);
    scene.add(tower);
  };

  // --- Crew doghouse / office trailer --------------------------------------------
  const buildDoghouse = (x: number, z: number) => {
    const dh = new THREE.Group();
    dh.position.set(x, groundAt(x, z), z);
    const white = mat(0xe8e8e2, 0.6, 0.25);
    box(dh, 8.4, 0.35, 3.2, dark, 0, 0.35, 0);
    for (const dx of [-3.6, 3.6]) box(dh, 0.4, 0.2, 3.4, dark, dx, 0.1, 0, false); // skid runners
    box(dh, 8.0, 2.8, 3.0, white, 0, 1.95, 0);
    box(dh, 8.1, 0.25, 3.1, mat(0xc8102e, 0.5, 0.3), 0, 2.6, 0, false); // corporate stripe
    box(dh, 8.2, 0.12, 3.2, mat(0x9ca3af, 0.6, 0.5), 0, 3.41, 0, false); // roof
    const glass = mat(0x1d3347, 0.15, 0.6);
    for (const dx of [-2.6, 0, 2.6]) box(dh, 1.2, 0.8, 0.04, glass, dx, 2.0, 1.52, false);
    box(dh, 0.04, 2.0, 0.95, mat(0x6b7280, 0.5, 0.5), 4.02, 1.55, 0.6, false); // door
    box(dh, 0.04, 0.7, 0.7, glass, 4.02, 2.1, -0.7, false);
    box(dh, 1.0, 0.6, 0.9, mat(0xcbd5e1, 0.5, 0.4), -2.5, 3.77, 0); // roof A/C unit
    cyl(dh, 0.35, 1.3, mat(0xf5f5f5, 0.5, 0.3), -4.5, 0.85, -0.9, 'y', 14); // propane bottle
    // Steps and landing with rail at the door end.
    box(dh, 1.2, 0.1, 1.4, mat(0x6b7280, 0.7, 0.6), 4.7, 0.95, 0.6);
    for (let i = 1; i <= 3; i++) box(dh, 0.3, 0.06, 1.2, mat(0x6b7280, 0.7, 0.6), 5.3 + i * 0.3, 0.95 - i * 0.24, 0.6, false);
    railing(dh, [new THREE.Vector3(4.1, 0.95, 1.3), new THREE.Vector3(5.3, 0.95, 1.3), new THREE.Vector3(6.2, 0.2, 1.3)], yellow, 1.0, 0.9);
    const logo = signTexture([{ text: 'WEATHERFORD', color: '#c8102e', size: 88 }, { text: 'CoRod® Field Office', color: '#111111', size: 40 }], '#e8e8e2', 768, 256);
    signPlane(dh, logo, 3.6, 1.2, 0, 2.0, -1.52, Math.PI);
    scene.add(dh);
  };

  // --- Tubular pipe rack -----------------------------------------------------------
  const buildPipeRack = (x: number, z: number) => {
    const gy = groundAt(x, z);
    const rackSteel = mat(0x3b4a5a, 0.6, 0.55);
    for (const dx of [-4, 0, 4]) {
      for (const dz of [-1.2, 1.2]) strut(scene, new THREE.Vector3(x + dx, gy, z + dz), new THREE.Vector3(x + dx, gy + 0.9, z + dz), 0.07, rackSteel, 8, true);
      box(scene, 0.18, 0.18, 2.8, rackSteel, x + dx, gy + 0.95, z);
    }
    const pipes: THREE.Matrix4[] = [];
    const protectors: THREE.Matrix4[] = [];
    const rows = [8, 7, 6];
    rows.forEach((n, row) => {
      for (let i = 0; i < n; i++) {
        const pz = z + (i - (n - 1) / 2) * 0.2;
        const py = gy + 1.13 + row * 0.17;
        pipes.push(placement(x, py, pz, 0, 0, Math.PI / 2));
        for (const end of [-4.75, 4.75]) protectors.push(placement(x + end, py, pz, 0, 0, Math.PI / 2));
      }
    });
    instanced(scene, new THREE.CylinderGeometry(0.09, 0.09, 9.5, 10), mat(0x6b5a4a, 0.6, 0.6), pipes, true);
    instanced(scene, new THREE.CylinderGeometry(0.105, 0.105, 0.22, 10), mat(0x1f6feb, 0.5, 0.2), protectors);
  };

  // --- Windsock (H2S wind direction indicator) --------------------------------------
  const buildWindsock = (x: number, z: number) => {
    const gy = groundAt(x, z);
    strut(scene, new THREE.Vector3(x, gy, z), new THREE.Vector3(x, gy + 6.5, z), 0.06, galvanised, 8, true);
    // Swivel at the pole top; bands stream along the swivel's local +X.
    const swivel = new THREE.Group();
    swivel.position.set(x, gy + 6.4, z);
    for (let i = 0; i < 5; i++) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34 - i * 0.045, 0.34 - (i + 1) * 0.045, 0.42, 12, 1, true),
        mat(i % 2 ? 0xf5f5f5 : 0xff5a1f, 0.8, 0),
      );
      (band.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      band.rotation.z = -Math.PI / 2;
      band.position.set(0.25 + i * 0.41, 0, 0);
      swivel.add(band);
    }
    scene.add(swivel);
    windsock = swivel;
  };

  // --- Muster point sign and portable toilet --------------------------------------
  const buildMusterSign = (x: number, z: number, rotationY: number) => {
    const gy = groundAt(x, z);
    strut(scene, new THREE.Vector3(x, gy, z), new THREE.Vector3(x, gy + 2.6, z), 0.05, galvanised, 8, true);
    const tex = signTexture([{ text: 'MUSTER', color: '#ffffff', size: 90 }, { text: 'POINT', color: '#ffffff', size: 90 }], '#0b7a3b', 512, 384, '#ffffff');
    signPlane(scene, tex, 1.3, 1.0, x, gy + 2.1, z + 0.06, rotationY);
  };
  const buildToilet = (x: number, z: number) => {
    const gy = groundAt(x, z);
    box(scene, 1.25, 2.3, 1.25, mat(0x1d4ed8, 0.6, 0.1), x, gy + 1.15, z);
    box(scene, 1.3, 0.12, 1.3, mat(0xe5e7eb, 0.6, 0.1), x, gy + 2.36, z, false);
  };

  // Aim each tower's lamp bank (local +X) at the wellhead (≈ world 9, 0).
  const aimAtWell = (x: number, z: number) => Math.atan2(-(0 - z), 9 - x);
  buildLightTower(-19, 15.5, aimAtWell(-19, 15.5));
  buildLightTower(23, -14, aimAtWell(23, -14));
  // Extra towers for night work: behind the reel trailer and front-right of the well.
  buildLightTower(-5, -19, aimAtWell(-5, -19));
  buildLightTower(14, 17.5, aimAtWell(14, 17.5));
  buildDoghouse(-30, 14);
  buildPipeRack(-27, -6);
  buildWindsock(22, 16);
  buildMusterSign(MUSTER_SIGN.x, MUSTER_SIGN.z, 0);
  buildToilet(-36.5, 14);

  return {
    lampMaterial,
    towerLights,
    updateWindsock(wind, time) {
      if (!windsock) return;
      const speed = Math.hypot(wind.x, wind.z); // m/s
      // Rotate so local +X points downwind (direction the air moves toward).
      if (speed > 0.05) windsock.rotation.y = Math.atan2(-wind.z, wind.x);
      // A sock fills fully at ~15 kn (7.7 m/s); limp at calm — droop toward vertical.
      const fill = THREE.MathUtils.clamp(speed / 7.7, 0, 1);
      const flutter = Math.sin(time * (4 + speed)) * 0.06 * fill;
      windsock.rotation.z = -(1 - fill) * 1.25 + flutter;
      windsock.rotation.x = Math.sin(time * (3 + speed * 0.7)) * 0.08 * fill;
    },
  };
}
