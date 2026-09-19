/**
 * Persistence for Well Designs. Mirrors the localStorage pattern used by
 * leaderboard.ts. Presets are always merged in and cannot be overwritten.
 */
import { WellDesign, WELL_DESIGN_PRESETS } from '../data/wellDesigns';

const DESIGNS_KEY = 'corod-well-designs-v1';
const SELECTION_KEY = 'corod-well-design-selection-v1';

/** Load user-saved designs (excludes presets). */
export function loadCustomWellDesigns(): WellDesign[] {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WellDesign[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d) => !d.isPreset);
  } catch {
    return [];
  }
}

/** All available designs = presets + saved custom ones. */
export function loadAllWellDesigns(): WellDesign[] {
  return [...WELL_DESIGN_PRESETS, ...loadCustomWellDesigns()];
}

/** Save (create or update) a custom design; returns the updated custom list. */
export function saveWellDesign(design: WellDesign): WellDesign[] {
  const custom = loadCustomWellDesigns().filter((d) => d.id !== design.id);
  const next = [...custom, { ...design, isPreset: false }];
  try {
    localStorage.setItem(DESIGNS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function deleteWellDesign(id: string): WellDesign[] {
  const next = loadCustomWellDesigns().filter((d) => d.id !== id);
  try {
    localStorage.setItem(DESIGNS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function loadActiveWellDesignId(): string | null {
  try {
    return localStorage.getItem(SELECTION_KEY);
  } catch {
    return null;
  }
}

export function saveActiveWellDesignId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SELECTION_KEY, id);
    else localStorage.removeItem(SELECTION_KEY);
  } catch {
    /* ignore */
  }
}
