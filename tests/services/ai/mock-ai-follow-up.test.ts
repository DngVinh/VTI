import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { MockAiProvider } from '../../../src/services/ai/providers/MockAiProvider';

describe('MockAiProvider.generateFollowUp (Micro-Task 1.7a)', () => {
  const provider = new MockAiProvider();

  it('should generate follow-up question when answer is short or shallow', async () => {
    const res = await provider.generateFollowUp(
      { vi: 'Biến là gì?', en: 'What is a variable?' },
      'Biến là nơi lưu giá trị.',
      []
    );

    expect(res.data).toBeDefined();
    expect(res.data.shouldFollowUp).toBe(true);
    expect(res.data.followUpQuestion?.vi).toBeDefined();
    expect(res.data.gapAnalysis.length).toBeGreaterThan(0);
    expect(res.audit.totalTokenCount).toBeGreaterThan(0);
  });

  it('should return shouldFollowUp=false when candidate answer is sufficiently detailed', async () => {
    const res = await provider.generateFollowUp(
      { vi: 'Biến là gì?', en: 'What is a variable?' },
      'Biến trong lập trình là một vùng nhớ được định danh, dùng để lưu trữ dữ liệu có thể thay đổi trong quá trình thực thi chương trình. Trong JavaScript, biến có thể khai báo bằng let, const, hoặc var với phạm vi scope và hoisting khác nhau.',
      []
    );

    expect(res.data.shouldFollowUp).toBe(false);
  });
});
