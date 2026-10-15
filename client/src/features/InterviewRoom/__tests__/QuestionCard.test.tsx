import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QuestionCard } from '../components/QuestionCard';
import type { Question, SpeechMetrics, StarData } from '../types';

describe('QuestionCard', () => {
  afterEach(() => {
    cleanup();
  });

  const mockQuestion: Question = {
    _id: 'q1',
    order: 1,
    difficulty: 'Medium',
    category: 'Backend',
    content: {
      vi: 'Giải thích nguyên lý hoạt động của Redis Caching?',
      en: 'Explain how Redis Caching works?',
    },
  };

  const mockSpeechMetrics: SpeechMetrics = {
    wordCount: 15,
    durationSeconds: 10,
    wpm: 90,
    fillerWords: [],
    fillerCount: 0,
  };

  const mockStarData: StarData = {
    situation: '',
    task: '',
    action: '',
    result: '',
  };

  const defaultProps = {
    question: mockQuestion,
    currentAnswer: 'Redis lưu trữ trên RAM',
    onAnswerChange: vi.fn(),
    index: 0,
    answerMode: 'text' as const,
    onAnswerModeChange: vi.fn(),
    codeLanguage: 'javascript' as const,
    onCodeLanguageChange: vi.fn(),
    starData: mockStarData,
    onStarDataChange: vi.fn(),
    speechTranscript: '',
    isListening: false,
    onStartListening: vi.fn(),
    onStopListening: vi.fn(),
    isSttSupported: true,
    speechMetrics: mockSpeechMetrics,
  };

  it('renders question content in VI by default and toggles to EN', () => {
    render(<QuestionCard {...defaultProps} />);
    expect(screen.getByText('Giải thích nguyên lý hoạt động của Redis Caching?')).toBeInTheDocument();

    const enBtn = screen.getByRole('button', { name: 'EN' });
    fireEvent.click(enBtn);
    expect(screen.getByText('Explain how Redis Caching works?')).toBeInTheDocument();
  });

  it('renders standard textarea when answerMode="text"', () => {
    render(<QuestionCard {...defaultProps} answerMode="text" />);
    const textarea = screen.getByPlaceholderText(/Nhập câu trả lời của bạn tại đây/i);
    expect(textarea).toBeInTheDocument();
  });

  it('renders CodeWorkspace when answerMode="code"', () => {
    render(<QuestionCard {...defaultProps} answerMode="code" />);
    expect(screen.getByText(/Ngôn ngữ:/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders StarAnswerHelper when answerMode="star"', () => {
    render(<QuestionCard {...defaultProps} answerMode="star" />);
    expect(screen.getByText(/Situation/i)).toBeInTheDocument();
    expect(screen.getByText(/Task/i)).toBeInTheDocument();
  });

  it('triggers onStartListening when mic button is clicked while not listening', () => {
    const onStartMock = vi.fn();
    render(<QuestionCard {...defaultProps} isListening={false} onStartListening={onStartMock} />);
    const micBtn = screen.getByRole('button', { name: /Bắt đầu nói/i });
    fireEvent.click(micBtn);
    expect(onStartMock).toHaveBeenCalledTimes(1);
  });

  it('triggers onStopListening when mic button is clicked while listening', () => {
    const onStopMock = vi.fn();
    render(<QuestionCard {...defaultProps} isListening={true} onStopListening={onStopMock} />);
    const micBtn = screen.getByRole('button', { name: /Dừng nói/i });
    fireEvent.click(micBtn);
    expect(onStopMock).toHaveBeenCalledTimes(1);
  });

  it('calls onLangChange and respects controlled lang prop', () => {
    const onLangChangeMock = vi.fn();
    const { rerender } = render(
      <QuestionCard {...defaultProps} lang="vi" onLangChange={onLangChangeMock} />
    );
    expect(screen.getByText('Giải thích nguyên lý hoạt động của Redis Caching?')).toBeInTheDocument();

    const enBtn = screen.getByRole('button', { name: 'EN' });
    fireEvent.click(enBtn);
    expect(onLangChangeMock).toHaveBeenCalledWith('en');

    rerender(<QuestionCard {...defaultProps} lang="en" onLangChange={onLangChangeMock} />);
    expect(screen.getByText('Explain how Redis Caching works?')).toBeInTheDocument();
  });

  it('falls back gracefully when target language content is empty', () => {
    const partialQuestion: Question = {
      ...mockQuestion,
      content: { vi: 'Chỉ có tiếng Việt', en: '' },
    };
    render(<QuestionCard {...defaultProps} question={partialQuestion} lang="en" />);
    expect(screen.getByText('Chỉ có tiếng Việt')).toBeInTheDocument();
  });
});
