import * as THREE from 'three';
import { createMeshKit } from './meshKit';

/**
 * Extra night-work lighting for the CoRod lease: LED flood bank on the mast,
 * MG rear-deck work lights, an injector/wellhead work lamp on its own pole,
 * a reel-trailer lamp and a soft night fill. Every light starts at 0 and is
 * driven by the site atmosphere (on at dusk/night, off in daylight); the lamp
 * lenses glow through `lampMaterial`.
 */
export interface NightWorkLightLayout {
  /** Mast top area (world) where the LED flood bank is mounted. */
  mastBank: THREE.Vector3;
  /** Where the mast bank aims (reel + guide arch). */
  mastBankTarget: THREE.Vector3;
  /** MG unit rear-deck light bar position and its aim point (console/well side). */
  deckBar: THREE.Vector3;
  deckTarget: THREE.Vector3;
  /** World Y the deck light post stands on (deck top). */
  deckPostBaseY: number;
  /** Ground position of the injector work-lamp pole and the point it lights. */
  injectorPole: { x: number; z: number; height: number };
  injectorTarget: THREE.Vector3;
  /** Reel-trailer lamp (world) and aim. */
  reelLamp: THREE.Vector3;
  reelTarget: THREE.Vector3;
}

export interface NightWorkLights {
  workLights: Array<{ light: THREE.Light; onIntensity: number; dayIntensity?: number }>;
  lampMaterial: THREE.MeshStandardMaterial;
}

export function addNightWorkLights(scene: THREE.Scene, L: NightWorkLightLayout): NightWorkLights {
  const kit = createMeshKit();
  const { mat, box, cyl, strut } = kit;
  const housing = mat(0x1f2937, 0.5, 0.6);
  const galv = mat(0x9aa4ae, 0.45, 0.8);
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.2, metalness: 0.1, emissive: 0xfff1c1, emissiveIntensity: 0.4 });
  const workLights: NightWorkLights['workLights'] = [];

  /** LED flood head facing local +Z, aimed by lookAt(target). */
  const head = (parent: THREE.Object3D, pos: THREE.Vector3, target: THREE.Vector3, w = 0.6, h = 0.4) => {
    const g = new THREE.Group();
    g.position.copy(pos);
    parent.add(g);
    g.lookAt(target);
    box(g, w, h, 0.18, housing, 0, 0, 0, false);
    box(g, w * 0.88, h * 0.8, 0.02, lampMaterial, 0, 0, 0.1, false);
    for (let f = -2; f <= 2; f++) box(g, w * 0.9, 0.02, 0.1, housing, 0, (f / 2.5) * h * 0.45, -0.12, false); // cooling fins
    box(g, 0.06, h * 0.9, 0.3, galv, -w / 2 - 0.05, 0, 0, false); // yoke
    box(g, 0.06, h * 0.9, 0.3, galv, w / 2 + 0.05, 0, 0, false);
    return g;
  };
  const spot = (pos: THREE.Vector3, target: THREE.Vector3, on: number, distance: number, angle: number, color = 0xfff1d8) => {
    const s = new THREE.SpotLight(color, 0, distance, angle, 0.55, 2);
    s.position.copy(pos);
    s.target.position.copy(target);
    s.castShadow = false;
    scene.add(s, s.target);
    workLights.push({ light: s, onIntensity: on });
    return s;
  };

  // 1. Mast LED flood bank (4 heads on a cross-bar) → reel, guide arch, deck.
  const bar = new THREE.Group();
  scene.add(bar);
  strut(bar, L.mastBank.clone().add(new THREE.Vector3(0, 0, -1.4)), L.mastBank.clone().add(new THREE.Vector3(0, 0, 1.4)), 0.06, galv);
  for (const dz of [-1.05, -0.35, 0.35, 1.05]) head(bar, L.mastBank.clone().add(new THREE.Vector3(-0.25, -0.35, dz)), L.mastBankTarget, 0.55, 0.4);
  spot(L.mastBank.clone().add(new THREE.Vector3(-0.4, -0.4, 0)), L.mastBankTarget, 900, 70, Math.PI / 4.2);

  // 2. MG rear-deck light bar (3 heads) on a post at the deck corner.
  strut(scene, L.deckBar.clone().setY(L.deckPostBaseY), L.deckBar.clone().add(new THREE.Vector3(0, -0.2, 0)), 0.06, galv);
  strut(scene, L.deckBar.clone().add(new THREE.Vector3(0, -0.2, -1.1)), L.deckBar.clone().add(new THREE.Vector3(0, -0.2, 1.1)), 0.04, galv);
  for (const dz of [-0.8, 0, 0.8]) head(scene, L.deckBar.clone().add(new THREE.Vector3(0, 0, dz)), L.deckTarget, 0.5, 0.32);
  spot(L.deckBar, L.deckTarget, 260, 35, Math.PI / 3.3);

  // 3. Injector / wellhead work lamp on its own galvanised pole.
  const { x: px, z: pz, height } = L.injectorPole;
  cyl(scene, 0.09, height, galv, px, height / 2, pz, 'y', 10);
  box(scene, 0.6, 0.12, 0.6, galv, px, 0.06, pz); // base plate
  box(scene, 0.45, 0.6, 0.3, mat(0x9ca3af, 0.6, 0.4), px, 1.2, pz + 0.18); // ballast/driver box
  const injHeadPos = new THREE.Vector3(px, height + 0.1, pz);
  head(scene, injHeadPos, L.injectorTarget, 0.6, 0.42);
  head(scene, injHeadPos.clone().add(new THREE.Vector3(0, -0.6, 0)), L.injectorTarget.clone().add(new THREE.Vector3(0, -5, 0)), 0.6, 0.42);
  spot(injHeadPos, L.injectorTarget, 420, 40, Math.PI / 3.4);

  // 4. Reel lamp on a short stem above the containment-arm head → coil.
  strut(scene, L.reelLamp.clone().add(new THREE.Vector3(0, -0.9, 0)), L.reelLamp.clone().add(new THREE.Vector3(0, -0.15, 0)), 0.04, galv);
  head(scene, L.reelLamp, L.reelTarget, 0.5, 0.34);
  spot(L.reelLamp, L.reelTarget, 220, 30, Math.PI / 3.2);

  // 5. Night fill so the whole pad reads under the work lights (no cost by day).
  const fill = new THREE.HemisphereLight(0xa8bcff, 0x3b3226, 0);
  scene.add(fill);
  workLights.push({ light: fill, onIntensity: 0.6 });

  return { workLights, lampMaterial };
}
