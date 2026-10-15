import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConversationThread } from '../components/ConversationThread';
import type { ConversationTurn } from '../types';

afterEach(() => {
  cleanup();
});

describe('ConversationThread Component (Micro-Task 1.12)', () => {
  const mockTurns: ConversationTurn[] = [
    {
      questionId: 'q-1',
      turnIndex: 0,
      role: 'INTERVIEWER',
      type: 'INITIAL_QUESTION',
      content: { vi: 'Event loop là gì?', en: 'What is event loop?' },
    },
    {
      questionId: 'q-1',
      turnIndex: 1,
      role: 'CANDIDATE',
      type: 'ANSWER',
      content: { vi: 'Là cơ chế xử lý bất đồng bộ.', en: 'It handles async.' },
    },
    {
      questionId: 'q-1',
      turnIndex: 2,
      role: 'INTERVIEWER',
      type: 'FOLLOW_UP',
      content: {
        vi: 'Khác biệt giữa microtask và macrotask là gì?',
        en: 'Difference between microtask and macrotask?',
      },
      metadata: {
        gapAnalysis: ['Chưa phân biệt queue'],
        difficultyAdjustment: 'HARDER',
      },
    },
  ];

  it('renders all conversation turns with roles correctly', () => {
    render(<ConversationThread turns={mockTurns} currentLang="vi" />);

    expect(screen.getByText('Event loop là gì?')).toBeInTheDocument();
    expect(screen.getByText('Là cơ chế xử lý bất đồng bộ.')).toBeInTheDocument();
    expect(
      screen.getByText('Khác biệt giữa microtask và macrotask là gì?')
    ).toBeInTheDocument();
  });

  it('renders gap analysis in follow-up turn', () => {
    render(<ConversationThread turns={mockTurns} currentLang="vi" />);

    expect(screen.getByText('Chưa phân biệt queue')).toBeInTheDocument();
  });

  it('displays loading state with thinking indicator when isLoading is true', () => {
    render(<ConversationThread turns={mockTurns} isLoading={true} currentLang="vi" />);

    expect(screen.getByText(/đang suy nghĩ|đang phân tích/i)).toBeInTheDocument();
  });

  it('calls onSpeak when speech button is clicked', () => {
    const onSpeakMock = vi.fn();
    render(<ConversationThread turns={mockTurns} onSpeak={onSpeakMock} currentLang="vi" />);

    const speakButtons = screen.getAllByRole('button', { name: /nghe|đọc|speak/i });
    expect(speakButtons.length).toBeGreaterThan(0);
    fireEvent.click(speakButtons[0]);

    expect(onSpeakMock).toHaveBeenCalledWith('Event loop là gì?');
  });

  it('renders localized gap analysis objects correctly based on currentLang', () => {
    const turnsWithLocalizedGaps: ConversationTurn[] = [
      {
        questionId: 'q-1',
        turnIndex: 1,
        role: 'INTERVIEWER',
        type: 'FOLLOW_UP',
        content: { vi: 'Câu hỏi', en: 'Question' },
        metadata: {
          gapAnalysis: [
            { vi: 'Thiếu chi tiết concurrency', en: 'Missing concurrency details' },
            'Chuỗi thuần túy',
          ],
        },
      },
    ];

    const { rerender } = render(<ConversationThread turns={turnsWithLocalizedGaps} currentLang="vi" />);
    expect(screen.getByText('Thiếu chi tiết concurrency')).toBeInTheDocument();
    expect(screen.getByText('Chuỗi thuần túy')).toBeInTheDocument();

    rerender(<ConversationThread turns={turnsWithLocalizedGaps} currentLang="en" />);
    expect(screen.getByText('Missing concurrency details')).toBeInTheDocument();
  });
});
