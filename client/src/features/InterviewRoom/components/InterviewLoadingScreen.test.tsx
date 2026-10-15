import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { InterviewLoadingScreen } from './InterviewLoadingScreen';
import { I18nProvider } from '../../../locales/I18nContext';

describe('InterviewLoadingScreen', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders default Vietnamese preparation state and updates elapsed time', () => {
    render(<InterviewLoadingScreen isEvaluating={false} />);

    expect(screen.getByText('Hệ thống AI đang chuẩn bị...')).toBeInTheDocument();
    expect(screen.getByText(/Thời gian chờ:/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Thời gian chờ: 00:02')).toBeInTheDocument();
  });

  it('renders English evaluation state when locale is en', () => {
    render(
      <I18nProvider defaultLocale="en">
        <InterviewLoadingScreen isEvaluating={true} />
      </I18nProvider>
    );

    expect(screen.getByText('AI system is evaluating...')).toBeInTheDocument();
    expect(screen.getByText(/Elapsed time:/)).toBeInTheDocument();
    expect(screen.getByText('Initializing AI evaluation engine...')).toBeInTheDocument();
  });
});
