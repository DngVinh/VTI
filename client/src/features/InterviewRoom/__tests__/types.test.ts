import { describe, it, expect } from 'vitest';
import type { AnswerMode } from '../types';

describe('InterviewRoom Types (Micro-Task 4.9a)', () => {
  it('supports whiteboard in AnswerMode type union', () => {
    const modes: AnswerMode[] = ['text', 'code', 'star', 'whiteboard'];
    expect(modes).toContain('whiteboard');
  });
});
