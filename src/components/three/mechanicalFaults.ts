import * as THREE from 'three';
import type { EmergencyEffectAnchors } from './emergencyEffects';

/** Equipment-local demonstrators only: never changes the training physics state. */
export function createMechanicalFaults(scene: THREE.Scene, a: EmergencyEffectAnchors) {
  const root = new THREE.Group(); root.name = 'EmergencyFaultDemonstrators'; scene.add(root);
  const red = new THREE.MeshBasicMaterial({ color: 0xff382b });
  const steel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x17202b });
  const marker = (id: string, at: THREE.Vector3) => {
    const g = new THREE.Group(); g.name = id; g.position.copy(at); g.visible = false; root.add(g); return g;
  };
  const detector = marker('emg-h2s', a.beaconPoles[0].clone().add(new THREE.Vector3(0.4, 1.5, 0)));
  detector.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.15), black));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), red); led.position.set(0, 0.12, 0.1); detector.add(led);
  const charge = marker('emg-charge', a.engine.clone().add(new THREE.Vector3(1, -1, 0.4)));
  charge.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.65, 12), steel));
  const pressure = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04), red); pressure.position.set(0, 0.1, 0.24); charge.add(pressure);
  const chain = marker('emg-chain', a.gripper);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.35), steel); chain.add(shoe);
  const overpull = marker('emg-overpull', a.gripper.clone().add(new THREE.Vector3(0, 1.7, 0)));
  const tension = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), steel); overpull.add(tension);
  const pad = marker('emg-outrigger', a.outrigger ?? new THREE.Vector3(-7.4, 0.05, 4.4));
  const depression = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x4a3829 })); pad.add(depression);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.65), steel); foot.position.y = 0.2; pad.add(foot);
  const lightning = marker('emg-lightning', new THREE.Vector3(45, 0, -65));
  const points = [new THREE.Vector3(0, 100, 0), new THREE.Vector3(3, 70, 0), new THREE.Vector3(-2, 55, 0), new THREE.Vector3(4, 30, 0), new THREE.Vector3(0, 0, 0)];
  lightning.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xdceaff, toneMapped: false })));
  return {
    root,
    update(id: string | null, t: number) {
      root.children.forEach(g => { g.visible = g.name === id; });
      led.scale.setScalar(Math.sin(t * 14) > 0 ? 1.5 : 0.4);
      pressure.rotation.z = -1.3 + Math.sin(t * 9) * 0.08;
      shoe.position.set(Math.sin(t * 24) * 0.05, Math.sin(t * 8) * 0.04, 0);
      shoe.rotation.z = Math.sin(t * 7) * 0.14;
      tension.position.x = Math.sin(t * 28) * 0.025;
      foot.position.y = 0.12 - (0.5 + Math.sin(t * 0.4) * 0.5) * 0.16;
      foot.rotation.z = -0.12;
      lightning.visible = id === 'emg-lightning' && t % 5 < 0.15;
    },
    dispose() {
      scene.remove(root);
      root.traverse(o => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach(m => m?.dispose());
      });
    },
  };
}
