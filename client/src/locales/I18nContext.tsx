import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import viDict from './vi.json';
import enDict from './en.json';

export type Locale = 'vi' | 'en';

type Dictionary = Record<string, any>;

const dictionaries: Record<Locale, Dictionary> = {
  vi: viDict,
  en: enDict,
};

export interface I18nContextType {
  locale: Locale;
  language: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, defaultText?: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'app_locale';

const lookupPath = (dict: unknown, path: string): string | undefined => {
  if (!dict || typeof dict !== 'object') return undefined;
  const keys = path.split('.');
  let current: any = dict;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
};

export const I18nProvider: React.FC<{ children: React.ReactNode; defaultLocale?: Locale }> = ({ children, defaultLocale }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (defaultLocale) return defaultLocale;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'vi' || saved === 'en') return saved;
      }
    } catch {
      // Fallback if localStorage disabled
    }
    return 'vi';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, newLocale);
      }
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (path: string, defaultText?: string): string => {
      const dict = dictionaries[locale] || dictionaries.vi;
      const val = lookupPath(dict, path);
      if (val !== undefined) return val;

      if (locale !== 'vi') {
        const fallbackVal = lookupPath(dictionaries.vi, path);
        if (fallbackVal !== undefined) return fallbackVal;
      }

      return defaultText || path;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      language: locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

const defaultContext: I18nContextType = {
  locale: 'vi',
  language: 'vi',
  setLocale: () => {},
  t: (path: string, defaultText?: string): string => {
    const val = lookupPath(dictionaries.vi, path);
    return val !== undefined ? val : defaultText || path;
  },
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  return context || defaultContext;
};
