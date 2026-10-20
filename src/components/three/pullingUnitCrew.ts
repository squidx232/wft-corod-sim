import * as THREE from 'three';
import { createMeshKit } from './meshKit';
import { buildWorkerRig, solveArm } from './operatorCharacter';

/** Independent low-detail carrier crew. All paths stay outside the well exclusion zone. */
export function createPullingUnitCrew(scene: THREE.Scene, opts: { groundAt: (x: number, z: number) => number }) {
  const root = new THREE.Group();
  root.name = 'PullingUnitCrew';
  const kit = createMeshKit();
  const members = ['supervisor', 'floorman', 'roustabout'].map((role, i) => {
    const rig = buildWorkerRig(kit, { coverallColour: 0xef6c16, hatColour: i === 0 ? 0xffffff : 0xf5c542 });
    rig.root.name = role;
    rig.root.scale.setScalar(1.2);
    // Carrier at X=16.5, cab extends left; positive-Z service lane, away from well X=9/Z=0.
    rig.root.position.set(16.5 + i * 2.2, 0, 4.2 + i * 0.6);
    rig.root.rotation.y = Math.PI / 2;
    root.add(rig.root);
    if (i === 0) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.25, 0.2), kit.mat(0x5b4230));
      board.position.set(0.27, 0.2, -0.1);
      rig.spine.add(board);
    }
    if (i === 2) {
      const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), kit.mat(0x777d83));
      tool.rotation.x = Math.PI / 2;
      tool.position.set(0.3, 0.12, 0);
      rig.spine.add(tool);
    }
    // Reduce tessellation of rounded body parts for these background workers.
    rig.root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const old = m.geometry;
      if (old instanceof THREE.CapsuleGeometry) {
        m.geometry = new THREE.CapsuleGeometry(old.parameters.radius, old.parameters.height, 2, 6);
        old.dispose();
      }
    });
    return rig;
  });
  scene.add(root);
  const hand = new THREE.Vector3();
  return {
    root,
    update(_delta: number, elapsed: number, emergencyId: string | null) {
      members.forEach((rig, i) => {
        const t = elapsed + i * 2.7;
        const emergency = !!emergencyId;
        const walking = i === 2 && !emergency;
        const x = 16.5 + i * 2.2 + (walking ? Math.sin(t * 0.22) * 1.4 : 0);
        rig.root.position.set(x, opts.groundAt(x, 4.2 + i * 0.6), 4.2 + i * 0.6);
        rig.root.rotation.y = walking ? (Math.cos(t * 0.22) > 0 ? 0 : Math.PI) : Math.PI / 2;
        const stride = walking ? Math.sin(t * 4) * 0.35 : 0;
        rig.hips.position.y = 0.93 + Math.sin(t * 1.6) * 0.005 + (walking ? Math.abs(Math.sin(t * 4)) * 0.015 : 0);
        rig.spine.rotation.z = i === 1 ? -0.12 - Math.sin(t * 0.65) * 0.1 : -0.025;
        rig.neck.rotation.y = Math.sin(t * 0.4) * 0.35;
        rig.head.rotation.z = i === 0 ? Math.sin(t * 0.5) * 0.08 : -0.08;
        rig.legs.forEach((leg, j) => {
          leg.hip.rotation.z = (j === 0 ? stride : -stride);
          leg.knee.rotation.z = -Math.max(0, j === 0 ? -stride : stride) * 0.7;
        });
        rig.arms.forEach((arm, j) => {
          const side = j === 0 ? -1 : 1;
          hand.set(i === 1 ? 0.4 : 0.28, i === 0 ? 0.23 : 0.1, side * 0.16);
          if (emergency) hand.set(0.15, 0.55 + Math.sin(t * 5) * 0.1, side * 0.38);
          else if (i === 1) hand.y += Math.sin(t * 1.5 + j) * 0.04;
          solveArm(arm.shoulder, arm.elbow, hand, arm.pole);
        });
      });
    },
  };
}
