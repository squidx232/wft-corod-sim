/**
 * Equipment Configuration — Injector Profiles.
 *
 * Different mobile-gripper injectors have varying mechanical properties
 * (contact area, cylinder count, gripper geometry) which dictate the squeeze
 * pressure required to hold a given rod-string weight without slipping, plus a
 * hard maximum squeeze the head can deliver.
 *
 * NOTE (placeholder): the curves & specs below are HARDCODED MOCK DATA per the
 * developer note. They are structured so the real operational curves and
 * specifications can be dropped in later without changing any call sites.
 */
import { SqueezeRefPoint } from './manualReference';

export type MeasurementUnits = 'imperial' | 'metric';

export interface InjectorProfile {
  id: string;
  name: string;
  /** Number of gripper cylinders (affects clamping force distribution). */
  cylinderCount: number;
  /** Total gripper contact area against the rod, square inches. */
  contactAreaSqIn: number;
  /** Hard ceiling on squeeze pressure this head can deliver (psi). */
  maxSqueezePsi: number;
  /**
   * Scalar applied to the base squeeze requirement. A head with less contact
   * area / fewer cylinders needs proportionally MORE squeeze pressure to grip
   * the same weight (multiplier > 1); a heavy-duty head needs less (< 1).
   */
  squeezeMultiplier: number;
  /** Required-squeeze-vs-weight curve specific to this injector. */
  curve: SqueezeRefPoint[];
  /** True for the built-in presets (cannot be deleted). */
  isPreset?: boolean;
}

/**
 * Built-in mock presets. The "Standard MG" curve mirrors the manual reference
 * curve; the other two are scaled variants representing different heads.
 */
export const INJECTOR_PROFILE_PRESETS: InjectorProfile[] = [
  {
    id: 'preset-standard-mg',
    name: 'Standard MG (3-Cyl)',
    cylinderCount: 3,
    contactAreaSqIn: 4.8,
    maxSqueezePsi: 2500,
    squeezeMultiplier: 1.0,
    isPreset: true,
    curve: [
      { weightLbs: 0, minSqueezePsi: 400 },
      { weightLbs: 2000, minSqueezePsi: 700 },
      { weightLbs: 4000, minSqueezePsi: 1000 },
      { weightLbs: 6000, minSqueezePsi: 1350 },
      { weightLbs: 8000, minSqueezePsi: 1700 },
      { weightLbs: 10000, minSqueezePsi: 2050 },
      { weightLbs: 12000, minSqueezePsi: 2350 },
      { weightLbs: 13000, minSqueezePsi: 2500 },
    ],
  },
  {
    id: 'preset-heavy-duty',
    name: 'Heavy-Duty (4-Cyl)',
    cylinderCount: 4,
    contactAreaSqIn: 6.4,
    maxSqueezePsi: 3000,
    squeezeMultiplier: 0.82,
    isPreset: true,
    curve: [
      { weightLbs: 0, minSqueezePsi: 350 },
      { weightLbs: 2000, minSqueezePsi: 580 },
      { weightLbs: 4000, minSqueezePsi: 820 },
      { weightLbs: 6000, minSqueezePsi: 1110 },
      { weightLbs: 8000, minSqueezePsi: 1400 },
      { weightLbs: 10000, minSqueezePsi: 1690 },
      { weightLbs: 12000, minSqueezePsi: 1930 },
      { weightLbs: 15000, minSqueezePsi: 2400 },
    ],
  },
  {
    id: 'preset-slimhole',
    name: 'Slimhole (2-Cyl)',
    cylinderCount: 2,
    contactAreaSqIn: 3.2,
    maxSqueezePsi: 2200,
    squeezeMultiplier: 1.25,
    isPreset: true,
    curve: [
      { weightLbs: 0, minSqueezePsi: 500 },
      { weightLbs: 2000, minSqueezePsi: 880 },
      { weightLbs: 4000, minSqueezePsi: 1250 },
      { weightLbs: 6000, minSqueezePsi: 1690 },
      { weightLbs: 8000, minSqueezePsi: 2130 },
      { weightLbs: 9500, minSqueezePsi: 2200 },
    ],
  },
];

/**
 * Interpolate the required squeeze pressure for a given string weight from an
 * injector's curve (linear between reference points), clamped to the head's
 * maximum. Returns a psi value.
 */
export function requiredSqueezeForWeight(profile: InjectorProfile, weightLbs: number): number {
  const curve = profile.curve;
  if (curve.length === 0) return 0;
  const w = Math.max(0, weightLbs);

  let base: number;
  if (w <= curve[0].weightLbs) {
    base = curve[0].minSqueezePsi;
  } else if (w >= curve[curve.length - 1].weightLbs) {
    base = curve[curve.length - 1].minSqueezePsi;
  } else {
    base = curve[curve.length - 1].minSqueezePsi;
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1];
      const cur = curve[i];
      if (w <= cur.weightLbs) {
        const span = cur.weightLbs - prev.weightLbs || 1;
        const frac = (w - prev.weightLbs) / span;
        base = prev.minSqueezePsi + frac * (cur.minSqueezePsi - prev.minSqueezePsi);
        break;
      }
    }
  }

  return Math.min(profile.maxSqueezePsi, Math.round(base * profile.squeezeMultiplier));
}
