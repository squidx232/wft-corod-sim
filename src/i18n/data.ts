/**
 * Data-content translations (English source string -> Egyptian Arabic).
 *
 * This map translates dynamic content that lives in data files
 * (src/data/*.ts) such as training-scenario procedures and emergency drills,
 * which are displayed via `tData(englishText)`. Keys MUST match the exact
 * English source strings (trimmed). Missing entries fall back to English.
 *
 * Fragments are merged here so different data sets can be translated
 * independently.
 */
import { scenarioData } from './data.scenarios';
import { emergencyData } from './data.emergency';

export const DATA_AR: Record<string, string> = {
  ...scenarioData,
  ...emergencyData,
};
