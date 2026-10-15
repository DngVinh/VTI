import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QuestionCard } from '../components/QuestionCard';

afterEach(() => {
  cleanup();
});

describe('InterviewRoom Whiteboard Mode (Micro-Task 4.9b)', () => {
  const mockQuestion = {
    _id: 'q-1',
    order: 1,
    difficulty: 'Hard',
    content: {
      vi: 'Thiết kế hệ thống streaming video quy mô toàn cầu như Netflix',
      en: 'Design a global video streaming platform like Netflix',
    },
  };

  it('renders SystemDesignCanvas when answerMode is whiteboard', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        currentAnswer=""
        onAnswerChange={vi.fn()}
        index={0}
        answerMode="whiteboard"
        onAnswerModeChange={vi.fn()}
        codeLanguage="javascript"
        onCodeLanguageChange={vi.fn()}
        starData={{ situation: '', task: '', action: '', result: '' }}
        onStarDataChange={vi.fn()}
        speechTranscript=""
        isListening={false}
        onStartListening={vi.fn()}
        onStopListening={vi.fn()}
        isSttSupported={true}
      />
    );

    expect(screen.getByText(/Bảng vẽ Kiến trúc Hệ thống/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm Database/i })).toBeInTheDocument();
  });
});
