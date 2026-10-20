import * as THREE from 'three';
import type { EnvironmentState } from '../../types';

/** Low-cost sky details inside the existing dome; no external textures required. */
export function createFieldSky(scene: THREE.Scene, cloudCount: number) {
  const root = new THREE.Group();
  root.name = 'FieldSky';
  const disk = (color: number, radius: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), new THREE.MeshBasicMaterial({ color, fog: false, toneMapped: false }));
    root.add(m); return m;
  };
  const sun = disk(0xffe8a1, 4); sun.name = 'Sun';
  const moon = disk(0xe5eaff, 2.7); moon.name = 'Moon';
  const craterMat = new THREE.MeshBasicMaterial({ color: 0xa6aec5, fog: false });
  for (let i = 0; i < 5; i++) {
    const crater = new THREE.Mesh(new THREE.SphereGeometry(0.3 + i * 0.05, 8, 6), craterMat);
    crater.position.set(Math.sin(i * 2.4) * 1.5, Math.cos(i * 2.4) * 1.3, 2.3);
    moon.add(crater);
  }
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), cloudMat, cloudCount * 4);
  clouds.frustumCulled = false;
  root.add(clouds);
  const starsGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    const a = i * 2.39996, y = 0.15 + (i / 180) * 0.8, r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(a) * r * 260, y * 260, Math.sin(a) * r * 260], i * 3);
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xe0eaff, size: 0.65, fog: false, transparent: true, depthWrite: false }));
  root.add(stars); scene.add(root);
  const transform = new THREE.Object3D();
  return {
    root,
    update(env: EnvironmentState, time: number, camera: THREE.Vector3) {
      root.position.copy(camera);
      const night = env.timeOfDay === 'night';
      sun.visible = !night; moon.visible = night; stars.visible = night;
      const height = env.timeOfDay === 'day' ? 0.7 : 0.15;
      sun.position.set(-145, height * 210, -140);
      moon.position.set(100, 145, -160);
      moon.lookAt(camera);
      const overcast = env.weather === 'rain';
      cloudMat.color.setHex(night ? 0x26334f : overcast ? 0x8795a6 : 0xfff6e8);
      cloudMat.opacity = night ? 0.45 : 0.85;
      for (let i = 0; i < cloudCount; i++) {
        const angle = i * 2.39996 + time * (0.0006 + env.windSpeedMph * 0.00004);
        const radius = 120 + (i % 4) * 25;
        for (let j = 0; j < 4; j++) {
          transform.position.set(Math.cos(angle) * radius + j * 5, 65 + (i % 5) * 8 + Math.sin(j) * 2, Math.sin(angle) * radius);
          transform.scale.set(12 + j * 2, 3 + (j % 2), 7);
          transform.updateMatrix(); clouds.setMatrixAt(i * 4 + j, transform.matrix);
        }
      }
      clouds.instanceMatrix.needsUpdate = true;
    },
    dispose() { starsGeo.dispose(); (stars.material as THREE.Material).dispose(); },
  };
}
