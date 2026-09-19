/**
 * Persistence for Equipment Configuration (injector profiles + active
 * selection + measurement units). Mirrors the localStorage pattern used by
 * leaderboard.ts. Presets are always merged in and cannot be overwritten.
 */
import {
  InjectorProfile,
  INJECTOR_PROFILE_PRESETS,
  MeasurementUnits,
} from '../data/injectorProfiles';

const PROFILES_KEY = 'corod-injector-profiles-v1';
const SELECTION_KEY = 'corod-equipment-config-v1';

interface StoredSelection {
  activeInjectorProfileId: string | null;
  measurementUnits: MeasurementUnits;
}

/** Load user-created custom profiles (excludes presets). */
export function loadCustomInjectorProfiles(): InjectorProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InjectorProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => !p.isPreset);
  } catch {
    return [];
  }
}

/** All available profiles = presets + saved custom ones. */
export function loadAllInjectorProfiles(): InjectorProfile[] {
  return [...INJECTOR_PROFILE_PRESETS, ...loadCustomInjectorProfiles()];
}

/** Save (create or update) a custom profile; returns the updated custom list. */
export function saveInjectorProfile(profile: InjectorProfile): InjectorProfile[] {
  const custom = loadCustomInjectorProfiles().filter((p) => p.id !== profile.id);
  const next = [...custom, { ...profile, isPreset: false }];
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / disabled storage */
  }
  return next;
}

export function deleteInjectorProfile(id: string): InjectorProfile[] {
  const next = loadCustomInjectorProfiles().filter((p) => p.id !== id);
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function loadEquipmentSelection(): StoredSelection {
  const fallback: StoredSelection = {
    activeInjectorProfileId: INJECTOR_PROFILE_PRESETS[0]?.id ?? null,
    measurementUnits: 'imperial',
  };
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredSelection>;
    return {
      activeInjectorProfileId:
        parsed.activeInjectorProfileId ?? fallback.activeInjectorProfileId,
      measurementUnits: parsed.measurementUnits === 'metric' ? 'metric' : 'imperial',
    };
  } catch {
    return fallback;
  }
}

export function saveEquipmentSelection(sel: StoredSelection): void {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
  } catch {
    /* ignore */
  }
}
