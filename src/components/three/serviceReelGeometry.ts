/** Pure (three.js-free) CoRod service reel geometry + rod/RPM math, so UI panels can import it without pulling three.js into the main bundle. */
export const REEL_GEOM = {
  /** Trailer deck top surface (local Y). */
  deckTopY: -1.91,
  /** Trailer deck half-width (Z) — wide enough for the large flat reel. */
  deckHalfZ: 2.8,
  /** Tilt hinge along the front edge of the cradle (local Y/Z). */
  hingeY: -1.79,
  hingeZ: 2.7,
  /** Cradle tilt (rad) — back edge lifted by the hydraulic cylinders. */
  tilt: (10 * Math.PI) / 180,
  /** Cradle base frame half-size (square, X and Z) and its rail height (untilted local Y). */
  frameHalf: 2.7,
  frameBaseY: -1.79,
  /** Bottom flange top surface (first coil layer sits on it). */
  platterTopY: -1.45,
  /** Top flange (open, spoked) height — a LOW, wide reel. */
  topFlangeY: -0.6,
  /** Flange radius (large diameter). */
  rimR: 2.6,
  /** The rod band: wound between the ring of columns and the rim. */
  coilInnerR: 1.7,
  coilOuterR: 2.48,
  /** Ring of separate vertical columns the rod is wound around (no solid wall). */
  columnR: 1.6,
  columnCount: 16,
  /** Hub radius at the drum centre (spokes run hub → rim). */
  hubR: 0.45,
};

/** Rod length in one wrap at the band's mean radius (ft) — ≈ 43 ft. */
export const REEL_MEAN_WRAP_FT = (2 * Math.PI * ((REEL_GEOM.coilInnerR + REEL_GEOM.coilOuterR) / 2)) / 0.3048;
/** Real reel RPM for a rod speed in ft/min (one drum turn per wrap of rod). */
export function reelRpmForSpeed(ftPerMin: number): number {
  return Math.abs(ftPerMin) / REEL_MEAN_WRAP_FT;
}
