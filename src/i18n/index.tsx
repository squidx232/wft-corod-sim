/**
 * Lightweight i18n for the COROD Simulator.
 *
 * - Two languages: English ("en") and Egyptian Arabic ("ar").
 * - Key-based lookup via the `useT()` hook -> `t('some.key')`.
 * - Language is persisted to localStorage and applied to <html lang/dir>
 *   so Arabic renders full RTL (chrome only; the 3D viewport & physical
 *   console hardware keep their own layout).
 *
 * Usage:
 *   const { t, lang, setLang, dir } = useT();
 *   <span>{t('header.title')}</span>
 *
 * Missing keys fall back to the English string, then to the key itself,
 * so the UI never shows blank text while translations are being filled in.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { en } from './en';
import { ar } from './ar';

export type Lang = 'en' | 'ar';

export type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = { en, ar };

const STORAGE_KEY = 'corod.lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  dir: 'ltr' | 'rtl';
  /** Translate a key. Optional {vars} interpolation via `${name}` tokens. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'ar' ? 'ar' : 'en';
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\$\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `\${${k}}`));
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  // Reflect language on <html> so CSS :dir()/[dir] and screen readers work.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore storage errors */
    }
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((p) => (p === 'en' ? 'ar' : 'en')), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = DICTS[lang];
      const raw = dict[key] ?? DICTS.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggle, dir, t }),
    [lang, setLang, toggle, dir, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

/** Access translation + language controls. */
export function useT(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback if a component renders outside the provider (e.g. tests):
    // behave as English with identity translation.
    return {
      lang: 'en',
      setLang: () => {},
      toggle: () => {},
      dir: 'ltr',
      t: (k) => en[k] ?? k,
    };
  }
  return ctx;
}
