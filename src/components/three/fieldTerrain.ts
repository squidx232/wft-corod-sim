import * as THREE from 'three';

/** Level, graded area (lease pad, tank battery, pump-jack site) cut into the hills. */
export type GradedPad =
  | { kind: 'circle'; x: number; z: number; radius: number; blend: number }
  | { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number; blend: number };

/** World Y of the terrain mesh origin (the mesh sits slightly below the pad). */
export const TERRAIN_BASE_Y = -0.15;

function distanceOutside(pad: GradedPad, x: number, z: number): number {
  if (pad.kind === 'circle') return Math.max(0, Math.hypot(x - pad.x, z - pad.z) - pad.radius);
  const dx = Math.max(pad.minX - x, 0, x - pad.maxX);
  const dz = Math.max(pad.minZ - z, 0, z - pad.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * Rolling-dune terrain with graded pads. All facilities share one height
 * function so equipment always sits on (not in, or above) the ground.
 */
export function createTerrainSampler(pads: GradedPad[]) {
  /** Height above TERRAIN_BASE_Y at world (x, z). */
  function relief(x: number, z: number): number {
    // The terrain plane is rotated −90° about X, so plane-local Y = −world Z.
    // Keep the original dune formula in plane-local space so the horizon is unchanged.
    const y = -z;
    const dist = Math.hypot(x, y);
    let h =
      Math.sin(x * 0.014) * Math.cos(y * 0.017) * 11.0 +
      Math.sin(x * 0.035 + 1.7) * Math.cos(y * 0.03 + 0.6) * 5.0 +
      Math.sin(x * 0.08 + 3.1) * Math.cos(y * 0.065 + 2.2) * 2.0;
    h += THREE.MathUtils.smoothstep(dist, 120, 300) * 26.0;
    let grade = 1;
    for (const pad of pads) {
      grade = Math.min(grade, THREE.MathUtils.smoothstep(distanceOutside(pad, x, z), 0, pad.blend));
    }
    return h * grade;
  }

  /** World Y of the ground surface. */
  function groundAt(x: number, z: number): number {
    return relief(x, z) + TERRAIN_BASE_Y;
  }

  return { relief, groundAt };
}
