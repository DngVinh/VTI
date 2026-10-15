import { describe, it, expect } from 'vitest';
import { InterviewSessionModel } from '../../src/models/InterviewSession';

describe('InterviewSession Model Status Enum (Micro-Task 1.3)', () => {
  it('should accept FOLLOW_UP as a valid status in schema enum', () => {
    const doc = new InterviewSessionModel({
      userId: 'user-123',
      status: 'FOLLOW_UP',
      setupData: {
        jobPosition: 'Backend Engineer',
        level: 'Junior',
        techStacks: ['Node.js'],
      },
    });

    const error = doc.validateSync(['status']);
    expect(error).toBeUndefined();
  });

  it('should reject invalid status in schema enum', () => {
    const doc = new InterviewSessionModel({
      userId: 'user-123',
      status: 'INVALID_STATUS' as any,
      setupData: {},
    });

    const error = doc.validateSync(['status']);
    expect(error?.errors.status).toBeDefined();
  });
});
