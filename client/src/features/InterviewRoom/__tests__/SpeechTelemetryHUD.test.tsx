import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SpeechTelemetryHUD } from '../components/SpeechTelemetryHUD';
import type { SpeechMetrics } from '../types';

describe('SpeechTelemetryHUD', () => {
  afterEach(() => {
    cleanup();
  });

  const baseMetrics: SpeechMetrics = {
    wordCount: 50,
    durationSeconds: 30,
    wpm: 100,
    fillerWords: ['à'],
    fillerCount: 1,
  };

  it('renders WPM with "Tốt" label when wpm is between 80-150', () => {
    render(<SpeechTelemetryHUD metrics={{ ...baseMetrics, wpm: 120 }} isListening={true} />);
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByText(/Tốt/i)).toBeInTheDocument();
  });

  it('renders WPM with "Chậm" label when wpm < 80 and wpm > 0', () => {
    render(<SpeechTelemetryHUD metrics={{ ...baseMetrics, wpm: 60 }} isListening={true} />);
    expect(screen.getByText(/60/)).toBeInTheDocument();
    expect(screen.getByText(/Chậm/i)).toBeInTheDocument();
  });

  it('renders WPM with "Nhanh" label when wpm > 150', () => {
    render(<SpeechTelemetryHUD metrics={{ ...baseMetrics, wpm: 180 }} isListening={true} />);
    expect(screen.getByText(/180/)).toBeInTheDocument();
    expect(screen.getByText(/Nhanh/i)).toBeInTheDocument();
  });

  it('renders filler count in red when fillerCount > 3', () => {
    const { container } = render(
      <SpeechTelemetryHUD metrics={{ ...baseMetrics, fillerCount: 5 }} isListening={true} />
    );
    const fillerElement = container.querySelector('[data-testid="filler-count"]');
    expect(fillerElement).toBeInTheDocument();
    expect(fillerElement?.className).toContain('text-rose-600');
  });

  it('shows recording indicator when isListening=true', () => {
    render(<SpeechTelemetryHUD metrics={baseMetrics} isListening={true} />);
    expect(screen.getByText(/Đang ghi âm/i)).toBeInTheDocument();
  });

  it('shows "Bấm mic để bắt đầu nói" when not listening and no words', () => {
    render(
      <SpeechTelemetryHUD
        metrics={{ wordCount: 0, durationSeconds: 0, wpm: 0, fillerWords: [], fillerCount: 0 }}
        isListening={false}
      />
    );
    expect(screen.getByText(/Bấm mic để bắt đầu nói/i)).toBeInTheDocument();
  });
});
