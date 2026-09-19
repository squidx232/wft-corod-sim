/**
 * Well Design & String Architecture.
 *
 * A well design captures the specs an operator configures BEFORE a run:
 *  - target depth
 *  - run-operation type (install / pull / rerun ...)
 *  - the active rod size for the run
 *  - a per-rod-size table of NOMINAL WEIGHTS (lbs/ft) so string weight and the
 *    required squeeze can be planned dynamically as depth changes.
 *
 * Operators can select a pre-saved design or build a new one from scratch.
 * Presets ship as mock data; user designs persist to localStorage.
 */
import { JobType, RodSize } from '../types';
import { ROD_SPECIFICATIONS } from './manualReference';

export const ALL_ROD_SIZES: RodSize[] = [
  '#3', '#4', '#4R', '#6', '#6R', '#7', '#8', '#8.5', '#8.5R',
];

/**
 * One section of a (possibly tapered) rod string, ordered from SURFACE down.
 * `lengthFt` is the run length of this section; `weightLbsPerFt` is its nominal
 * linear weight (defaults from the manual spec but editable per design).
 */
export interface RodSegment {
  rodSize: RodSize;
  lengthFt: number;
  weightLbsPerFt: number;
}

export interface WellDesign {
  id: string;
  name: string;
  targetDepthFt: number;
  runOperationType: JobType;
  activeRodSize: RodSize;
  /** Nominal weight (lbs/ft) per rod size for this design. */
  rodSizeWeights: Record<RodSize, number>;
  /**
   * Ordered rod-string segments (surface → bottom) enabling TAPERED designs.
   * Optional for backward-compatibility with legacy single-size designs; when
   * present it is the source of truth for total depth and per-depth weight.
   */
  segments?: RodSegment[];
  isPreset?: boolean;
}

/** Total measured depth of a design = sum of segment lengths (or targetDepthFt). */
export function wellDesignTotalDepthFt(d: WellDesign): number {
  if (d.segments && d.segments.length > 0) {
    return d.segments.reduce((sum, s) => sum + Math.max(0, s.lengthFt), 0);
  }
  return d.targetDepthFt;
}

/**
 * Nominal linear weight (lbs/ft) of the rod section that is currently AT the
 * gripper for a given amount of string in the hole. For a tapered string this
 * is the DEEPEST section still above `depthFt` measured from surface. Falls back
 * to the design's active-size weight for legacy (non-segmented) designs.
 */
export function weightAtDepth(d: WellDesign, depthFt: number): number {
  if (d.segments && d.segments.length > 0) {
    let acc = 0;
    for (const seg of d.segments) {
      acc += Math.max(0, seg.lengthFt);
      if (depthFt <= acc) return seg.weightLbsPerFt;
    }
    return d.segments[d.segments.length - 1].weightLbsPerFt;
  }
  return d.rodSizeWeights[d.activeRodSize] ?? 2.04;
}

/**
 * Total string weight (lbs) for a tapered design when `depthFt` of rod is in the
 * hole: sums each segment's contribution up to the current depth.
 */
export function stringWeightAtDepth(d: WellDesign, depthFt: number): number {
  if (d.segments && d.segments.length > 0) {
    let remaining = Math.max(0, depthFt);
    let total = 0;
    for (const seg of d.segments) {
      const inThisSeg = Math.min(remaining, Math.max(0, seg.lengthFt));
      total += inThisSeg * seg.weightLbsPerFt;
      remaining -= inThisSeg;
      if (remaining <= 0) break;
    }
    return total;
  }
  return depthFt * (d.rodSizeWeights[d.activeRodSize] ?? 2.04);
}

/** Default nominal weight table seeded from the manual rod specifications. */
export function defaultRodSizeWeights(): Record<RodSize, number> {
  const out = {} as Record<RodSize, number>;
  for (const size of ALL_ROD_SIZES) {
    out[size] = ROD_SPECIFICATIONS[size]?.weightLbsPerFt ?? 2.04;
  }
  return out;
}

function seg(rodSize: RodSize, lengthFt: number): RodSegment {
  return { rodSize, lengthFt, weightLbsPerFt: ROD_SPECIFICATIONS[rodSize]?.weightLbsPerFt ?? 2.04 };
}

/** Built-in mock well-design presets. */
export const WELL_DESIGN_PRESETS: WellDesign[] = [
  {
    id: 'preset-shallow-install',
    name: 'Shallow Install — 4,500 ft (#6R)',
    targetDepthFt: 4500,
    runOperationType: 'install',
    activeRodSize: '#6R',
    rodSizeWeights: defaultRodSizeWeights(),
    segments: [seg('#6R', 4500)],
    isPreset: true,
  },
  {
    id: 'preset-deep-rerun',
    name: 'Deep Rerun — 8,200 ft (#8.5)',
    targetDepthFt: 8200,
    runOperationType: 'rerun',
    activeRodSize: '#8.5',
    rodSizeWeights: defaultRodSizeWeights(),
    segments: [seg('#8.5', 8200)],
    isPreset: true,
  },
  {
    id: 'preset-tapered-9500',
    name: 'Tapered Design — 9,500 ft (#8.5 / #7 / #6R)',
    targetDepthFt: 9500,
    runOperationType: 'install',
    activeRodSize: '#8.5',
    rodSizeWeights: defaultRodSizeWeights(),
    // Heaviest at surface (carries the most load), tapering lighter downhole.
    segments: [seg('#8.5', 3500), seg('#7', 3500), seg('#6R', 2500)],
    isPreset: true,
  },
];

/**
 * Given a depth of rod in the hole, report which tapered segment the gripper is
 * currently paying out, how far into that segment we are, and totals. Returns
 * null for non-segmented (legacy) designs.
 */
export interface WellStageInfo {
  segmentIndex: number;      // 0-based
  segmentCount: number;
  rodSize: RodSize;
  runInSegmentFt: number;    // how much of THIS segment is in the hole
  segmentLengthFt: number;
  totalRunFt: number;        // total rod in hole (== depthFt, clamped)
  totalDepthFt: number;
}
export function currentWellStage(d: WellDesign, depthFt: number): WellStageInfo | null {
  if (!d.segments || d.segments.length === 0) return null;
  const total = wellDesignTotalDepthFt(d);
  const clamped = Math.max(0, Math.min(total, depthFt));
  let acc = 0;
  for (let i = 0; i < d.segments.length; i++) {
    const seg = d.segments[i];
    const segLen = Math.max(0, seg.lengthFt);
    if (clamped <= acc + segLen || i === d.segments.length - 1) {
      return {
        segmentIndex: i,
        segmentCount: d.segments.length,
        rodSize: seg.rodSize,
        runInSegmentFt: Math.max(0, Math.min(segLen, clamped - acc)),
        segmentLengthFt: segLen,
        totalRunFt: clamped,
        totalDepthFt: total,
      };
    }
    acc += segLen;
  }
  return null;
}

/** Create a blank design profile (for "build from scratch"). */
export function createBlankWellDesign(id: string): WellDesign {
  return {
    id,
    name: 'New Well Design',
    targetDepthFt: 5000,
    runOperationType: 'install',
    activeRodSize: '#6R',
    rodSizeWeights: defaultRodSizeWeights(),
    segments: [seg('#6R', 5000)],
  };
}
