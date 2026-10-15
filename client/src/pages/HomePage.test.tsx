import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';
import { I18nProvider } from '../locales/I18nContext';

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

afterEach(() => {
  cleanup();
});

vi.mock('../auth/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: null,
      token: null,
      bootstrapStatus: 'ready',
    })
  ),
}));

describe('HomePage', () => {
  it('renders hero title, badge and call-to-action buttons', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <HomePage />
        </I18nProvider>
      </MemoryRouter>
    );

    // Badge
    expect(
      screen.getByText(/Nền tảng phỏng vấn kỹ thuật thế hệ mới/i)
    ).toBeInTheDocument();

    // Main headline parts
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Nâng tầm kỹ năng phỏng vấn/i
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Chinh phục nhà tuyển dụng IT/i
    );

    // Primary CTA links
    expect(
      screen.getByRole('link', { name: /Bắt đầu phỏng vấn ngay/i })
    ).toHaveAttribute('href', '/setup');
    expect(
      screen.getByRole('link', { name: /Thư viện câu hỏi/i })
    ).toHaveAttribute('href', '/questions');
  });

  it('renders feature cards and metrics highlights', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <HomePage />
        </I18nProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('AI Feedback tức thì')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Mọi tính năng cần thiết để bứt phá/i })
    ).toBeInTheDocument();
  });

  it('switches to English when language switcher is toggled', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <HomePage />
        </I18nProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Switch to English/i }));

    expect(
      screen.getByText(/Next-Generation AI Technical Interview Platform/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Elevate Your Interview Skills/i
    );
    expect(
      screen.getByRole('link', { name: /Start Interview Now/i })
    ).toHaveAttribute('href', '/setup');
    expect(screen.getByText('Instant AI Feedback')).toBeInTheDocument();
  });
});
