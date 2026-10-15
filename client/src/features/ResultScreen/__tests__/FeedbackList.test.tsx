import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeedbackList } from '../components/FeedbackList';

describe('FeedbackList', () => {
  it('renders empty message according to language', () => {
    const { rerender } = render(<FeedbackList questions={[]} language="vi" />);
    expect(screen.getByText('Không có câu hỏi nào.')).toBeInTheDocument();

    rerender(<FeedbackList questions={[]} language="en" />);
    expect(screen.getByText('No questions found.')).toBeInTheDocument();
  });

  it('renders question content and feedback in English with proper fallback', () => {
    const mockQuestions = [
      {
        order: 1,
        difficulty: 'Easy',
        content: { vi: 'Câu hỏi tiếng Việt', en: 'English question' },
        candidateAnswer: 'Candidate answer',
        feedback: { vi: 'Phản hồi tốt', en: 'Good feedback' },
        score: 9,
      },
    ];

    render(<FeedbackList questions={mockQuestions} language="en" />);
    expect(screen.getByText(/Question 1:/)).toBeInTheDocument();
    expect(screen.getByText('English question')).toBeInTheDocument();
    expect(screen.getByText('Your Answer')).toBeInTheDocument();
    expect(screen.getByText('AI Feedback')).toBeInTheDocument();
    expect(screen.getByText('Good feedback')).toBeInTheDocument();
  });
});
