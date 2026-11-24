'use client';

import { useState, useEffect, useCallback } from 'react';
import en from './dictionaries/en.json';
import hi from './dictionaries/hi.json';

export type Language = 'en' | 'hi';
const dictionaries = { en, hi };

export function useTranslation() {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('cafe_language') as Language | null;
    if (saved && (saved === 'en' || saved === 'hi')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cafe_language', lang);
      window.dispatchEvent(new Event('languagechange'));
    }
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const current = localStorage.getItem('cafe_language') as Language | null;
      if (current && (current === 'en' || current === 'hi')) {
        setLanguageState(current);
      }
    };
    window.addEventListener('languagechange', handleStorage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('languagechange', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  /**
   * Helper to fetch translated text by dot path, e.g. t('common.welcome')
   */
  const t = useCallback(
    (keyPath: string, fallback?: string): string => {
      const dict = dictionaries[language] || en;
      const keys = keyPath.split('.');
      let result: unknown = dict;

      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = (result as Record<string, unknown>)[key];
        } else {
          return fallback || keyPath;
        }
      }

      return typeof result === 'string' ? result : fallback || keyPath;
    },
    [language]
  );

  return { language, setLanguage, t };
}
