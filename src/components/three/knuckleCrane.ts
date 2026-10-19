import * as THREE from 'three';
import { SLING_LENGTH } from '../../crane/craneSim';
import type { CraneSpec, CraneState, CraneLoadDef, CraneInputs, CraneJoint } from '../../crane/craneSim';

/**
 * Visual model of the Fassi F215A.0.24 knuckle-boom crane fitted ON the MG
 * unit (red), driven by `CraneState`:
 *
 *   root (slew axis on the deck) ─ slew column ─ main boom ─ outer boom ─ 6 extensions
 *
 * The crane has no stabilizers of its own — the MG outriggers do that job and
 * are animated by the viewport. Classic red box-section booms; rams are
 * re-stretched between their pins every frame. A 4-lever ground-control valve
 * bank sits on the crane base (levers tilt with the live inputs). Hook, sling, load and
 * landing mat are placed in WORLD space from the sim.
 */

export interface KnuckleCraneVisual {
  root: THREE.Group;
  world: THREE.Group;
  update(state: CraneState, opts: {
    groundAt: (x: number, z: number) => number;
    target: { x: number; z: number; radius: number } | null;
    showTarget: boolean;
    inputs?: CraneInputs;
  }): void;
  setVisible(v: boolean): void;
  dispose(): void;
}

const RED = 0xc81e1e;

function canvasTexture(draw: (g: CanvasRenderingContext2D, c: HTMLCanvasElement) => void, w: number, h: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g || typeof g.fillText !== 'function') return null;
  draw(g, c);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hydraulic ram (barrel + chrome rod) stretched between two points of `space`. */
function createRam(space: THREE.Object3D, barrelRadius: number, barrelLength: number) {
  const barrelMat = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.45, metalness: 0.35 });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.12, metalness: 0.95 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius, 1, 16), barrelMat);
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
    barrel.scale.set(1, bl, 1); barrel.quaternion.copy(q);
    barrel.position.copy(a).addScaledVector(dir, bl / 2);
    const rl = Math.max(L - bl + 0.08, 0.05);
    rod.scale.set(1, rl, 1); rod.quaternion.copy(q);
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
    add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), dark)).position.y = 0.03;
    for (const [sx, sz, bw, bd] of [[0, d / 2, w, 0.04], [0, -d / 2, w, 0.04], [w / 2, 0, 0.04, d], [-w / 2, 0, 0.04, d]] as const) {
      add(new THREE.Mesh(new THREE.BoxGeometry(bw, h * 0.75, bd), mat)).position.set(sx, h * 0.42, sz);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), mat)).position.set((sx * w) / 2, h / 2, (sz * d) / 2);
    const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w * 0.8, 10), dark));
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.18, 0.1);
  } else if (def.kind === 'lubricator') {
    const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.32, h * 0.32, w * 0.92, 20), mat));
    tube.rotation.z = Math.PI / 2; tube.position.y = h * 0.55;
    for (const sx of [-1, 1]) {
      const fl = add(new THREE.Mesh(new THREE.CylinderGeometry(h * 0.45, h * 0.45, 0.08, 20), dark));
      fl.rotation.z = Math.PI / 2; fl.position.set(sx * w * 0.46, h * 0.55, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.3, d), dark)).position.set(sx * w * 0.3, h * 0.15, 0);
    }
  } else if (def.kind === 'injector') {
    add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), dark)).position.y = 0.06;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark)).position.set(sx * w * 0.42, 0.3, sz * d * 0.42);
    add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.62, d * 0.8), mat)).position.y = 0.5 + h * 0.31;
    for (const sz of [-1, 1]) {
      const motor = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.45, 14), dark));
      motor.rotation.x = Math.PI / 2; motor.position.set(0.1, h * 0.78, sz * d * 0.48);
    }
  } else {
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)).position.y = h / 2;
  }
  add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), dark)).position.y = h + 0.02;
  return g;
}

export interface KnuckleCraneOptions {
  /** Valve-bank position in crane-root space (on the MG console), and lever order left → right for the operator. */
  leverBank?: { position: THREE.Vector3; yaw: number; order: CraneJoint[] };
}

export function createKnuckleCrane(spec: CraneSpec, opts: KnuckleCraneOptions = {}): KnuckleCraneVisual {
  const root = new THREE.Group();
  const world = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4, metalness: 0.35 });
  const darkRed = new THREE.MeshStandardMaterial({ color: 0x9b1515, roughness: 0.45, metalness: 0.35 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.55, metalness: 0.65 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.15, metalness: 0.95 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.35, metalness: 0.2 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.3 });
  const box = (w: number, h: number, d: number, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // Classic Fassi box-section look (red booms, white FASSI decals), sized to the
  // F215A.0.24: column/booms fit the 0.87 m folded width and 2.255 m folded height.
  // The base is kept slim so it clears the MG console box beside the pedestal.

  // --- Base on the MG deck (no own stabilizers: the MG outriggers are used) ---------
  box(0.62, 0.12, 0.62, darkRed, root, 0, 0.06, 0); // base plate bolted to the deck
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.16, 28), steel);
  ring.position.y = 0.2; ring.castShadow = true; root.add(ring);

  // --- Slewing column ---------------------------------------------------------------
  const slew = new THREE.Group();
  root.add(slew);
  const colH = spec.columnHeight - 0.5;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.27, colH, 20), red);
  column.position.y = 0.28 + colH / 2; column.castShadow = true; slew.add(column);
  box(0.6, 0.42, 0.46, red, slew, spec.pivotOffset * 0.6, spec.columnHeight - 0.05, 0); // column head

  // --- Main (inner) boom ------------------------------------------------------------
  const main = new THREE.Group();
  main.position.set(spec.pivotOffset, spec.columnHeight, 0);
  slew.add(main);
  box(spec.mainBoomLength + 0.25, 0.44, 0.34, red, main, spec.mainBoomLength / 2, 0, 0);
  const fassi = canvasTexture((g) => {
    g.fillStyle = '#c81e1e'; g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#ffffff'; g.font = 'bold italic 66px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('FASSI', 22, 50);
  }, 512, 96);
  if (fassi) {
    const decalMat = new THREE.MeshStandardMaterial({ map: fassi, roughness: 0.5 });
    for (const sz of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), decalMat);
      decal.position.set(spec.mainBoomLength * 0.55, 0, sz * 0.172);
      if (sz < 0) decal.rotation.y = Math.PI;
      main.add(decal);
    }
  }
  const liftRam = createRam(root, 0.1, 0.95);

  // --- Outer (knuckle) boom + 6 extensions -----------------------------------------------
  const outer = new THREE.Group();
  outer.position.set(spec.mainBoomLength, 0, 0);
  main.add(outer);
  box(0.5, 0.5, 0.36, darkRed, outer, 0, 0.05, 0); // knuckle joint block
  box(spec.outerBoomLength, 0.36, 0.3, red, outer, spec.outerBoomLength / 2, 0, 0);
  const model = canvasTexture((g) => {
    g.fillStyle = '#c81e1e'; g.fillRect(0, 0, 512, 80);
    g.fillStyle = '#ffffff'; g.font = 'bold 52px Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('F215A active', 14, 42);
  }, 512, 80);
  if (model) {
    const m = new THREE.MeshStandardMaterial({ map: model, roughness: 0.5 });
    for (const sz of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15), m);
      decal.position.set(spec.outerBoomLength * 0.45, 0, sz * 0.152);
      if (sz < 0) decal.rotation.y = Math.PI;
      outer.add(decal);
    }
  }
  const knuckleRam = createRam(root, 0.085, 0.8);
  const n = spec.extensionCount;
  const stroke = spec.maxExtension / n;
  // Telescopic sections nest inside each other (each one smaller) and run out together.
  const sectionLen = Math.min(spec.outerBoomLength - 0.05, Math.max(spec.outerBoomLength * 0.85, stroke + 0.3));
  const extensions = Array.from({ length: n }, (_, i) => {
    const sz = 0.3 * (1 - (i + 1) * 0.1);
    const g = new THREE.Group();
    outer.add(g);
    box(sectionLen, sz * 1.15, sz, i % 2 ? red : darkRed, g, -sectionLen / 2, 0, 0);
    return g;
  });
  const tipHead = new THREE.Group();
  outer.add(tipHead);
  box(0.22, 0.2, 0.2, steel, tipHead, 0, 0, 0);
  // Hose carrier along the outer boom (black tube).
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, spec.outerBoomLength, 8), black);
  hose.rotation.z = Math.PI / 2; hose.position.set(spec.outerBoomLength / 2, 0.22, 0.1); outer.add(hose);

  // --- Ground-control lever bank on the crane base (4 proportional levers) ------------
  const leverPivots: Partial<Record<CraneJoint, THREE.Group>> = {};
  if (opts.leverBank) {
    const bank = new THREE.Group();
    bank.position.copy(opts.leverBank.position);
    bank.rotation.y = opts.leverBank.yaw;
    root.add(bank);
    const spacing = 0.11;
    const count = opts.leverBank.order.length;
    box(spacing * count + 0.08, 0.12, 0.16, steel, bank, 0, 0.06, 0); // valve bank body
    opts.leverBank.order.forEach((joint, i) => {
      const x = (i - (count - 1) / 2) * spacing;
      box(0.07, 0.05, 0.004, yellow, bank, x, 0.09, 0.082); // pictogram label plate
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.12, 0.03);
      bank.add(pivot);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.3, 10), chrome);
      stem.position.y = 0.15; pivot.add(stem);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), black);
      knob.scale.set(1, 1.25, 1); knob.position.y = 0.31; pivot.add(knob);
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 10), black);
      boot.position.y = 0.02; pivot.add(boot);
      leverPivots[joint] = pivot;
    });
  }

  // --- World-space: hook, link, slings, target mat --------------------------------------
  const hook = new THREE.Group();
  box(0.2, 0.26, 0.14, yellow, hook, 0, 0.16, 0);
  const hookCurve = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 18, Math.PI * 1.5), steel);
  hookCurve.rotation.z = Math.PI * 0.75; hookCurve.position.y = -0.02; hook.add(hookCurve);
  world.add(hook);
  const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const link = new THREE.Line(linkGeo, new THREE.LineBasicMaterial({ color: 0x18181b }));
  link.frustumCulled = false; world.add(link);
  const slingGeo = new THREE.BufferGeometry();
  slingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const slings = new THREE.LineSegments(slingGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b }));
  slings.frustumCulled = false; world.add(slings);
  const mat = new THREE.Group();
  const matRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: 0x16a34a, side: THREE.DoubleSide }));
  matRing.rotation.x = -Math.PI / 2; matRing.position.y = 0.025; mat.add(matRing);
  for (const [x, z, w, d] of [[0, 1, 2, 0.1], [0, -1, 2, 0.1], [1, 0, 0.1, 2], [-1, 0, 0.1, 2]] as const) box(w, 0.04, d, yellow, mat, x, 0.02, z);
  world.add(mat);

  let loadMesh: THREE.Group | null = null;
  let loadId: string | null = null;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const update: KnuckleCraneVisual['update'] = (s, o) => {
    slew.rotation.y = s.joints.slew;
    main.rotation.z = s.joints.main;
    outer.rotation.z = s.joints.outer;
    // Sections run out together (synchronised extension), each up to `stroke`.
    extensions.forEach((g, i) => { g.position.x = spec.outerBoomLength + (s.joints.extension * (i + 1)) / n; });
    tipHead.position.x = spec.outerBoomLength + s.joints.extension;
    if (o.inputs) for (const [j, pivot] of Object.entries(leverPivots)) pivot!.rotation.x = (o.inputs[j as CraneJoint] ?? 0) * 0.45;

    root.updateMatrixWorld(true);
    const inRoot = (obj: THREE.Object3D, v: THREE.Vector3) => root.worldToLocal(obj.localToWorld(v));
    liftRam(inRoot(slew, tmpA.set(spec.pivotOffset + 0.05, 0.6, 0)), inRoot(main, tmpB.set(1.2, -0.22, 0)));
    knuckleRam(inRoot(main, tmpA.set(1.35, 0.24, 0)), inRoot(outer, tmpB.set(-0.3, 0.32, 0)));

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

    if ((load?.def.id ?? null) !== loadId) {
      if (loadMesh) { world.remove(loadMesh); loadMesh.traverse((c) => { (c as THREE.Mesh).geometry?.dispose(); }); }
      loadMesh = load ? buildCraneLoad(load.def) : null;
      loadId = load?.def.id ?? null;
      if (loadMesh) world.add(loadMesh);
    }
    if (loadMesh && load) {
      loadMesh.position.set(load.position.x, load.position.y, load.position.z);
      loadMesh.rotation.y = load.yaw;
    }
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
    mat.visible = !!(o.showTarget && o.target);
    if (o.target) {
      mat.position.set(o.target.x, o.groundAt(o.target.x, o.target.z), o.target.z);
      mat.scale.set(o.target.radius, 1, o.target.radius);
    }
  };

  return {
    root,
    world,
    update,
    setVisible(v) { root.visible = v; world.visible = v; },
    dispose() {
      [root, world].forEach((g) => g.traverse((c) => { (c as THREE.Mesh).geometry?.dispose(); }));
    },
  };
}
