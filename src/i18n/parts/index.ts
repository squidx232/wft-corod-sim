/**
 * Per-component translation fragments.
 *
 * Each part file exports `{ en, ar }` dictionaries scoped to one feature area.
 * They are aggregated here and merged into the main dictionaries by
 * `src/i18n/index.tsx`. This lets different areas be translated independently
 * without editing one giant file.
 */
export interface TranslationPart {
  en: Record<string, string>;
  ar: Record<string, string>;
}

import { station } from './station';
import { modals } from './modals';
import { scenarios } from './scenarios';
import { auxiliary } from './auxiliary';

export const PARTS: TranslationPart[] = [station, modals, scenarios, auxiliary];
