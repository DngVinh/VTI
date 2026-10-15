import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QuestionNavigator } from '../components/QuestionNavigator';

afterEach(() => {
  cleanup();
});

describe('QuestionNavigator (Micro-Tasks 4.1 & 4.6)', () => {
  it('renders buttons with bilingual aria-labels', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <QuestionNavigator
        totalQuestions={3}
        currentIndex={0}
        onSelectQuestion={onSelect}
        answeredIndices={new Set([1])}
        language="vi"
      />
    );

    expect(screen.getByRole('button', { name: /Câu hỏi 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Câu hỏi 2 \(Đã trả lời\)/ })).toBeInTheDocument();

    rerender(
      <QuestionNavigator
        totalQuestions={3}
        currentIndex={0}
        onSelectQuestion={onSelect}
        answeredIndices={new Set([1])}
        language="en"
      />
    );

    expect(screen.getByRole('button', { name: /Question 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Question 2 \(Answered\)/ })).toBeInTheDocument();
  });

  it('supports keyboard arrow navigation across questions', () => {
    const onSelect = vi.fn();
    render(
      <QuestionNavigator
        totalQuestions={4}
        currentIndex={1}
        onSelectQuestion={onSelect}
        answeredIndices={new Set()}
        language="vi"
      />
    );

    const activeBtn = screen.getByRole('button', { name: /Câu hỏi 2/ });
    activeBtn.focus();

    // ArrowRight -> Question 3 (index 2)
    fireEvent.keyDown(activeBtn, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(2);

    // ArrowLeft -> Question 1 (index 0)
    fireEvent.keyDown(activeBtn, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith(0);

    // Home -> Question 1 (index 0)
    fireEvent.keyDown(activeBtn, { key: 'Home' });
    expect(onSelect).toHaveBeenCalledWith(0);

    // End -> Question 4 (index 3)
    fireEvent.keyDown(activeBtn, { key: 'End' });
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
