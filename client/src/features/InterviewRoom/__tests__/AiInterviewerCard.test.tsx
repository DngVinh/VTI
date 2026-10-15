import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AiInterviewerCard } from '../components/AiInterviewerCard';

describe('AiInterviewerCard', () => {
  afterEach(() => {
    cleanup();
  });
  const defaultProps = {
    questionContent: { vi: 'Câu hỏi tiếng Việt', en: 'English question' },
    currentLang: 'vi' as const,
    isSpeaking: false,
    onSpeak: vi.fn(),
    onStopSpeaking: vi.fn(),
    isTtsSupported: true,
  };

  it('renders AI avatar and "Sẵn sàng" status when not speaking', () => {
    render(<AiInterviewerCard {...defaultProps} />);
    expect(screen.getByText('AI Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đọc câu hỏi/i })).toBeInTheDocument();
  });

  it('renders "Đang nói..." status when isSpeaking=true', () => {
    render(<AiInterviewerCard {...defaultProps} isSpeaking={true} />);
    expect(screen.getByText('Đang nói...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dừng đọc/i })).toBeInTheDocument();
  });

  it('calls onSpeak when "Đọc câu hỏi" button is clicked', () => {
    const onSpeakMock = vi.fn();
    render(<AiInterviewerCard {...defaultProps} onSpeak={onSpeakMock} />);
    fireEvent.click(screen.getByRole('button', { name: /Đọc câu hỏi/i }));
    expect(onSpeakMock).toHaveBeenCalledTimes(1);
  });

  it('calls onStopSpeaking when "Dừng đọc" button is clicked', () => {
    const onStopSpeakingMock = vi.fn();
    render(<AiInterviewerCard {...defaultProps} isSpeaking={true} onStopSpeaking={onStopSpeakingMock} />);
    fireEvent.click(screen.getByRole('button', { name: /Dừng đọc/i }));
    expect(onStopSpeakingMock).toHaveBeenCalledTimes(1);
  });

  it('disables speak button when isTtsSupported=false', () => {
    render(<AiInterviewerCard {...defaultProps} isTtsSupported={false} />);
    const button = screen.getByRole('button', { name: /Trình duyệt không hỗ trợ đọc/i });
    expect(button).toBeDisabled();
  });

  it('renders 5 waveform bars', () => {
    const { container } = render(<AiInterviewerCard {...defaultProps} isSpeaking={true} />);
    const bars = container.querySelectorAll('[data-testid="waveform-bar"]');
    expect(bars.length).toBe(5);
  });

  it('renders English labels when currentLang="en"', () => {
    render(<AiInterviewerCard {...defaultProps} currentLang="en" />);
    expect(screen.getByText('Technical Interview Assistant')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Audio Frequency')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Read Question/i })).toBeInTheDocument();
  });
});
