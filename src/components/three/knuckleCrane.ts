import * as THREE from 'three';
import { SLING_LENGTH } from '../../crane/craneSim';
import type { CraneSpec, CraneState, CraneLoadDef } from '../../crane/craneSim';

/**
 * Visual model of a Fassi F215C-style knuckle-boom crane (red, as fitted to
 * the CoRod MG unit) driven by `CraneState`. Joint groups mirror the sim:
 *
 *   root (slew axis at the deck) ─ slew ─ main boom pivot ─ outer boom ─ extensions
 *
 * Hydraulic rams are re-stretched between their attachment points every frame;
 * stabilizer beams slide out and the striped jack legs extend to the ground.
 * Hook, sling, load and landing mat are placed in WORLD space from the sim.
 */

export interface KnuckleCraneVisual {
  /** Add to the scene at the crane base (world). */
  root: THREE.Group;
  /** World-space objects (hook, sling, load, target mat). */
  world: THREE.Group;
  update(state: CraneState, opts: { groundAt: (x: number, z: number) => number; target: { x: number; z: number; radius: number } | null; showTarget: boolean }): void;
  dispose(): void;
}

const RED = 0xc81e1e;

function makeLabelTexture(text: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  if (!g || typeof g.fillText !== 'function') return null;
  g.fillStyle = '#c81e1e'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffffff'; g.font = 'bold italic 64px Arial, sans-serif'; g.textBaseline = 'middle';
  g.fillText(text, 18, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stripedTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  if (!g || typeof g.fillRect !== 'function') return null;
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d01818'; g.fillRect(0, i * 32, 64, 32); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A hydraulic ram (barrel + chrome rod) stretched between two points of `space`. */
function createRam(space: THREE.Object3D, barrelRadius: number, barrelLength: number) {
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.5 });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.15, metalness: 0.95 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius, 1, 14), barrelMat);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius * 0.55, barrelRadius * 0.55, 1, 12), rodMat);
  barrel.castShadow = rod.castShadow = true;
  space.add(barrel, rod);
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  return (a: THREE.Vector3, b: THREE.Vector3) => {
    dir.subVectors(b, a);
    const L = Math.max(dir.length(), 1e-3);
    dir.divideScalar(L);
    q.setFromUnitVectors(up, dir);
    const bl = Math.min(barrelLength, L * 0.92);
    barrel.scale.set(1, bl, 1);
    barrel.quaternion.copy(q);
    barrel.position.copy(a).addScaledVector(dir, bl / 2);
    const rl = Math.max(L - bl + 0.08, 0.05);
    rod.scale.set(1, rl, 1);
    rod.quaternion.copy(q);
    rod.position.copy(b).addScaledVector(dir, -rl / 2);
  };
}

/** Load visual by kind; origin at bottom centre, lift point at top centre. */
export function buildCraneLoad(def: CraneLoadDef): THREE.Group {
  const g = new THREE.Group();
  const [w, h, d] = def.size;
  const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.6, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.7, metalness: 0.4 });
  const add = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (def.kind === 'basket') {
    // Open-top steel basket: floor + 4 mesh-like walls + corner posts.
    add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), dark)).position.y = 0.03;
    for (const [sx, sz, bw, bd] of [[0, d / 2, w, 0.04], [0, -d / 2, w, 0.04], [w / 2, 0, 0.04, d], [-w / 2, 0, 0.04, d]] as const) {
      const wall = add(new THREE.Mesh(new THREE.BoxGeometry(bw, h * 0.75, bd), mat));
      wall.position.set(sx, h * 0.42, sz);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), mat)).position.set((sx * w) / 2, h / 2, (sz * d) / 2);
    // Tools inside
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w * 0.8, 10), dark)).rotation.z = Math.PI / 2;
    g.children[g.children.length - 1].position.set(0, 0.18, 0.1);
  } else if (def.kind === 'lubricator') {
    // Long tubular section on a cradle skid, flanges at each end.
    const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.32, h * 0.32, w * 0.92, 20), mat));
    tube.rotation.z = Math.PI / 2; tube.position.y = h * 0.55;
    for (const sx of [-1, 1]) {
      const fl = add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.45, h * 0.45, 0.08, 20), dark));
      fl.rotation.z = Math.PI / 2; fl.position.set((sx * w * 0.46), h * 0.55, 0);
      const cradle = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.3, d), dark));
      cradle.position.set(sx * w * 0.3, h * 0.15, 0);
    }
  } else if (def.kind === 'injector') {
    // Injector head on its transport stand.
    add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), dark)).position.y = 0.06;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark)).position.set(sx * w * 0.42, 0.3, sz * d * 0.42);
    add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.62, d * 0.8), mat)).position.y = 0.55 + h * 0.31 - 0.05;
    for (const sz of [-1, 1]) {
      const motor = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.45, 14), dark));
      motor.rotation.x = Math.PI / 2; motor.position.set(0.1, h * 0.78, sz * d * 0.48);
    }
  } else {
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)).position.y = h / 2;
  }
  // Lifting eye at the top centre.
  const eye = add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), dark));
  eye.position.y = h + 0.02;
  return g;
}

export function createKnuckleCrane(spec: CraneSpec, opts: { side: number; truckCenterZ: number; baseY: number }): KnuckleCraneVisual {
  const root = new THREE.Group();
  const world = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.42, metalness: 0.35 });
  const darkRed = new THREE.MeshStandardMaterial({ color: 0x8f1414, roughness: 0.5, metalness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6, metalness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.3 });
  const striped = stripedTexture();
  const legMat = new THREE.MeshStandardMaterial({ color: striped ? 0xffffff : RED, map: striped ?? undefined, roughness: 0.5, metalness: 0.3 });
  const box = (w: number, h: number, d: number, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // --- Subframe + stabilizers (static, across the truck) ---------------------------
  const cz = opts.truckCenterZ; // local z of truck centreline (root is at the slew axis)
  // Stabilizer cross-beam sits just behind the column (toward the well) so the
  // legs clear the MG console box beside the pedestal.
  const SX = 0.38;
  box(0.75, 0.42, 2.3, red, root, SX * 0.5, -0.21, cz);
  const stabs = [-1, 1].map((sideZ) => {
    const beam = box(0.32, 0.26, 1.4, darkRed, root, SX, -0.28, cz + sideZ * 0.75);
    const leg = new THREE.Group();
    root.add(leg);
    const housing = box(0.24, 0.9, 0.24, legMat, leg, 0, -0.45, 0);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 12), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.2, metalness: 0.9 }));
    inner.castShadow = true;
    leg.add(inner);
    const pad = box(0.5, 0.06, 0.5, steel, leg, 0, 0, 0);
    if (striped) (housing.material as THREE.MeshStandardMaterial).map!.repeat.set(1, 1);
    return { sideZ, beam, leg, inner, pad };
  });

  // --- Slewing column ---------------------------------------------------------------
  const slew = new THREE.Group();
  root.add(slew);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.16, 28), steel);
  ring.position.y = 0.08; slew.add(ring);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.32, spec.columnHeight - 0.2, 20), red);
  column.position.y = 0.16 + (spec.columnHeight - 0.2) / 2; column.castShadow = true; slew.add(column);
  box(0.62, 0.42, 0.5, red, slew, spec.pivotOffset * 0.6, spec.columnHeight - 0.05, 0);
  // Control-valve bank housing on the column (the real lever station sits by the MG console).
  box(0.28, 0.35, 0.42, steel, slew, -0.32, 0.9, 0);

  // --- Main (inner) boom ------------------------------------------------------------
  const main = new THREE.Group();
  main.position.set(spec.pivotOffset, spec.columnHeight, 0);
  slew.add(main);
  box(spec.mainBoomLength + 0.25, 0.44, 0.34, red, main, spec.mainBoomLength / 2, 0, 0);
  const label = makeLabelTexture('FASSI');
  if (label) {
    const decalMat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.5 });
    for (const sz of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), decalMat);
      decal.position.set(spec.mainBoomLength * 0.55, 0, sz * 0.172);
      if (sz < 0) decal.rotation.y = Math.PI;
      main.add(decal);
    }
  }
  const liftRam = createRam(root, 0.1, 1.15);

  // --- Outer (knuckle) boom + extensions ---------------------------------------------
  const outer = new THREE.Group();
  outer.position.set(spec.mainBoomLength, 0, 0);
  main.add(outer);
  box(0.5, 0.5, 0.36, darkRed, outer, 0, 0.05, 0); // knuckle joint block
  box(spec.outerBoomLength, 0.36, 0.3, red, outer, spec.outerBoomLength / 2, 0, 0);
  const outerLabel = makeLabelTexture('F215C');
  if (outerLabel) {
    const m = new THREE.MeshStandardMaterial({ map: outerLabel, roughness: 0.5 });
    for (const sz of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.16), m);
      decal.position.set(spec.outerBoomLength * 0.45, 0, sz * 0.152);
      if (sz < 0) decal.rotation.y = Math.PI;
      outer.add(decal);
    }
  }
  const knuckleRam = createRam(root, 0.085, 0.95);
  const sectionLen = spec.outerBoomLength * 0.85;
  const extensions = Array.from({ length: spec.extensionCount }, (_, i) => {
    const s = 0.3 - (i + 1) * 0.045;
    const g = new THREE.Group();
    outer.add(g);
    box(sectionLen, s, s * 0.85, i % 2 ? red : darkRed, g, -sectionLen / 2, 0, 0);
    return g;
  });
  // Boom-tip head with hook shackle point.
  const tipHead = new THREE.Group();
  outer.add(tipHead);
  box(0.22, 0.2, 0.2, steel, tipHead, 0, 0, 0);
  // Hose carrier along the outer boom (black tube).
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, spec.outerBoomLength, 8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
  hose.rotation.z = Math.PI / 2; hose.position.set(spec.outerBoomLength / 2, 0.22, 0.1); outer.add(hose);

  // --- World-space: hook, link, slings, target mat ------------------------------------
  const hook = new THREE.Group();
  box(0.2, 0.26, 0.14, yellow, hook, 0, 0.16, 0);
  const hookCurve = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 18, Math.PI * 1.5), steel);
  hookCurve.rotation.z = Math.PI * 0.75; hookCurve.position.y = -0.02; hook.add(hookCurve);
  world.add(hook);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x18181b });
  const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const link = new THREE.Line(linkGeo, lineMat);
  link.frustumCulled = false;
  world.add(link);
  const slingGeo = new THREE.BufferGeometry();
  slingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const slings = new THREE.LineSegments(slingGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b }));
  slings.frustumCulled = false;
  world.add(slings);

  const mat = new THREE.Group();
  const matFrame = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
  const matRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0x16a34a, side: THREE.DoubleSide }));
  matRing.rotation.x = -Math.PI / 2; matRing.position.y = 0.025; mat.add(matRing);
  for (const [x, z, w, d] of [[0, 1, 2, 0.1], [0, -1, 2, 0.1], [1, 0, 0.1, 2], [-1, 0, 0.1, 2]] as const) box(w, 0.04, d, matFrame, mat, x, 0.02, z);
  world.add(mat);

  let loadMesh: THREE.Group | null = null;
  let loadId: string | null = null;

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const update: KnuckleCraneVisual['update'] = (s, o) => {
    slew.rotation.y = s.joints.slew;
    main.rotation.z = s.joints.main;
    outer.rotation.z = s.joints.outer;
    const n = extensions.length;
    extensions.forEach((g, i) => { g.position.x = spec.outerBoomLength + (s.joints.extension * (i + 1)) / n; });
    tipHead.position.x = spec.outerBoomLength + s.joints.extension;

    // Stabilizers: beams slide out, legs extend down to the ground.
    const k = s.stabilizers;
    root.updateMatrixWorld(true);
    for (const st of stabs) {
      const reach = 0.6 + k * 0.85;
      const lz = cz + st.sideZ * (1.25 + reach - 0.6);
      st.beam.scale.z = 1 + k * 0.6;
      st.beam.position.z = cz + st.sideZ * (0.75 + k * 0.42);
      st.leg.position.set(SX, -0.28, lz);
      const legWorld = root.localToWorld(tmpA.set(SX, -0.28, lz));
      const ground = o.groundAt(legWorld.x, legWorld.z);
      const drop = Math.max(0.95, legWorld.y - ground);
      const RETRACTED = 0.95; // foot pad just below the leg housing when stowed
      const ext = RETRACTED + k * Math.max(0, drop - RETRACTED);
      st.inner.scale.y = Math.max(ext - 0.6, 0.05);
      st.inner.position.y = -0.6 - st.inner.scale.y / 2;
      st.pad.position.y = -ext + 0.03;
    }

    // Rams (computed in root space from attachment points on each link).
    root.updateMatrixWorld(true);
    const inRoot = (obj: THREE.Object3D, v: THREE.Vector3) => root.worldToLocal(obj.localToWorld(v));
    liftRam(inRoot(slew, tmpA.set(spec.pivotOffset + 0.05, 0.45, 0)), inRoot(main, tmpB.set(1.45, -0.24, 0)));
    knuckleRam(inRoot(main, tmpA.set(1.6, 0.3, 0)), inRoot(outer, tmpB.set(-0.32, 0.36, 0)));

    // Hook + link from the tip. Unloaded, the sim's pendulum point IS the hook;
    // loaded, it is the load's lift point and the hook sits one sling length up the rope.
    const load = s.load;
    const hookPos = tmpA.set(s.hook.x, s.hook.y, s.hook.z);
    if (load?.attached) {
      tmpB.set(s.tip.x - s.hook.x, s.tip.y - s.hook.y, s.tip.z - s.hook.z);
      const L = tmpB.length();
      if (L > 1e-4) hookPos.addScaledVector(tmpB, Math.min(SLING_LENGTH, L) / L);
    }
    hook.position.copy(hookPos);
    const lp = linkGeo.attributes.position as THREE.BufferAttribute;
    lp.setXYZ(0, s.tip.x, s.tip.y, s.tip.z);
    lp.setXYZ(1, hookPos.x, hookPos.y + 0.3, hookPos.z);
    lp.needsUpdate = true;

    // Load mesh (rebuild when the task load changes).
    if ((load?.def.id ?? null) !== loadId) {
      if (loadMesh) { world.remove(loadMesh); loadMesh.traverse((c) => { if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose(); }); }
      loadMesh = load ? buildCraneLoad(load.def) : null;
      loadId = load?.def.id ?? null;
      if (loadMesh) world.add(loadMesh);
    }
    if (loadMesh && load) {
      loadMesh.position.set(load.position.x, load.position.y, load.position.z);
      loadMesh.rotation.y = load.yaw;
    }
    // Four-leg sling from the hook to the load's top corners.
    slings.visible = !!load?.attached;
    if (load?.attached) {
      const sp = slingGeo.attributes.position as THREE.BufferAttribute;
      const [w, h, d] = load.def.size;
      let i = 0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        sp.setXYZ(i++, hook.position.x, hook.position.y, hook.position.z);
        sp.setXYZ(i++, load.position.x + (sx * w) / 2.4, load.position.y + h, load.position.z + (sz * d) / 2.4);
      }
      sp.needsUpdate = true;
    }

    // Target landing mat.
    mat.visible = !!(o.showTarget && o.target);
    if (o.target) {
      mat.position.set(o.target.x, o.groundAt(o.target.x, o.target.z), o.target.z);
      const r = o.target.radius;
      mat.scale.set(r, 1, r);
    }
  };

  return {
    root,
    world,
    update,
    dispose() {
      [root, world].forEach((g) => g.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      }));
    },
  };
}
