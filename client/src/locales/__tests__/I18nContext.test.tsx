import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { I18nProvider, useTranslation } from '../I18nContext';

describe('I18nContext & useTranslation', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const localStorageMock = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      clear: () => {
        store = {};
      },
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nProvider>{children}</I18nProvider>
  );

  it('provides default Vietnamese locale and translates nested keys', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.locale).toBe('vi');
    expect(result.current.t('common.save')).toBe('Lưu');
    expect(result.current.t('nav.practice')).toBe('Luyện phỏng vấn');
  });

  it('switches to English and persists in localStorage', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    act(() => {
      result.current.setLocale('en');
    });

    expect(result.current.locale).toBe('en');
    expect(result.current.t('common.save')).toBe('Save');
    expect(result.current.t('nav.practice')).toBe('Practice Interview');
    expect(localStorage.getItem('app_locale')).toBe('en');
  });

  it('falls back to key path when key is missing', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
  });
});
