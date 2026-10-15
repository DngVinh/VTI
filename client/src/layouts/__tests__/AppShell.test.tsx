import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { I18nProvider } from '../../locales/I18nContext';

describe('AppShell with Language Switcher', () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        clear: () => {
          store = {};
        },
      },
      writable: true,
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <I18nProvider>{ui}</I18nProvider>
      </MemoryRouter>
    );
  };

  it('renders language switcher and switches navbar language between VI and EN', () => {
    renderWithProviders(<AppShell><div>Test Content</div></AppShell>);

    // Initially Vietnamese
    expect(screen.getByRole('button', { name: /Chuyển sang tiếng Việt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to English/i })).toBeInTheDocument();
    expect(screen.getByText('Luyện phỏng vấn')).toBeInTheDocument();

    // Toggle to English
    fireEvent.click(screen.getByRole('button', { name: /Switch to English/i }));

    expect(screen.getByText('Practice Interview')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});
