/**
 * Runtime shape guards for data read back from localStorage.
 *
 * Persisted JSON can be stale (older builds), hand-edited, truncated, or written
 * by another same-origin app, so it is validated before being trusted. A bad
 * record is dropped instead of crashing a render (e.g. `undefined.toFixed`).
 */
import type { LeaderboardEntry } from '../types';
import type { WellDesign } from '../data/wellDesigns';
import type { InjectorProfile } from '../data/injectorProfiles';

const MAX_TEXT = 200;

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isShortString = (v: unknown, max = MAX_TEXT): v is string => typeof v === 'string' && v.length <= max;

/** Parse a JSON array from storage, keeping only items that pass `guard`. */
export function parseStoredArray<T>(raw: string | null, guard: (v: unknown) => v is T, limit = 500): T[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, limit).filter(guard);
}

export function isLeaderboardEntry(v: unknown): v is LeaderboardEntry {
  return (
    isRecord(v) &&
    isShortString(v.id) &&
    isShortString(v.name) &&
    isShortString(v.role) &&
    isShortString(v.unit) &&
    isShortString(v.grade) &&
    isShortString(v.difficulty) &&
    isFiniteNumber(v.score) &&
    isFiniteNumber(v.eventsResolved) &&
    isFiniteNumber(v.eventsHandled) &&
    (v.avgReactionSec === null || isFiniteNumber(v.avgReactionSec)) &&
    isFiniteNumber(v.hintsUsed) &&
    isFiniteNumber(v.durationSec) &&
    isFiniteNumber(v.timestamp)
  );
}

export function isWellDesign(v: unknown): v is WellDesign {
  if (!isRecord(v)) return false;
  if (!isShortString(v.id) || !isShortString(v.name)) return false;
  if (!isFiniteNumber(v.targetDepthFt) || !isShortString(v.runOperationType) || !isShortString(v.activeRodSize)) return false;
  if (!isRecord(v.rodSizeWeights) || !Object.values(v.rodSizeWeights).every(isFiniteNumber)) return false;
  if (v.segments !== undefined) {
    if (!Array.isArray(v.segments) || v.segments.length > 50) return false;
    const ok = v.segments.every(
      (s) => isRecord(s) && isShortString(s.rodSize) && isFiniteNumber(s.lengthFt) && isFiniteNumber(s.weightLbsPerFt),
    );
    if (!ok) return false;
  }
  return true;
}

export function isInjectorProfile(v: unknown): v is InjectorProfile {
  return (
    isRecord(v) &&
    isShortString(v.id) &&
    isShortString(v.name) &&
    isFiniteNumber(v.cylinderCount) &&
    isFiniteNumber(v.contactAreaSqIn) &&
    isFiniteNumber(v.maxSqueezePsi) &&
    isFiniteNumber(v.squeezeMultiplier) &&
    Array.isArray(v.curve) &&
    v.curve.length <= 100 &&
    v.curve.every((p) => isRecord(p) && isFiniteNumber(p.weightLbs) && isFiniteNumber(p.minSqueezePsi))
  );
}

/**
 * Overlay `stored` onto `defaults`, keeping only keys present in `defaults`
 * whose value has the same primitive type (or null where the default allows it).
 */
export function mergeKnownKeys<T extends object>(defaults: T, stored: unknown): T {
  const out = { ...defaults } as Record<string, unknown>;
  if (!isRecord(stored)) return out as T;
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(stored, key)) continue;
    const def = (defaults as Record<string, unknown>)[key];
    const val = stored[key];
    if (val === null || def === null || typeof val === typeof def) out[key] = val;
  }
  return out as T;
}
