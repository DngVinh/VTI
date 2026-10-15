import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { InterviewController } from '../../src/controllers/InterviewController';
import { InterviewService } from '../../src/services/InterviewService';

describe('InterviewController Follow-Up (Micro-Task 1.9b)', () => {
  let mockInterviewService: Partial<InterviewService>;
  let controller: InterviewController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockInterviewService = {
      processFollowUp: vi.fn(),
      getConversationHistory: vi.fn(),
    };

    controller = new InterviewController(
      {} as any,
      mockInterviewService as InterviewService
    );

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it('should call processFollowUp and return 200 with result', async () => {
    const fakeResult = {
      shouldFollowUp: true,
      followUpQuestion: { vi: 'Câu hỏi', en: 'Question' },
      gapAnalysis: [],
      turnIndex: 1,
      maxTurns: 3,
      summary: { vi: 'Tóm tắt', en: 'Summary' },
    };
    (mockInterviewService.processFollowUp as any).mockResolvedValue(fakeResult);

    mockReq = {
      params: { id: 'session-123' },
      body: { questionId: 'q-456', candidateAnswer: 'Answer text' },
      user: { _id: 'user-789' } as any,
    };

    await (controller as any).requestFollowUp(mockReq as Request, mockRes as Response, vi.fn());

    expect(mockInterviewService.processFollowUp).toHaveBeenCalledWith(
      'session-123',
      { questionId: 'q-456', candidateAnswer: 'Answer text' },
      'user-789'
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: fakeResult });
  });

  it('should call getConversationHistory and return 200 with turns', async () => {
    const fakeTurns = [{ turnIndex: 1, role: 'CANDIDATE', content: { vi: 'a', en: 'a' } }];
    (mockInterviewService.getConversationHistory as any).mockResolvedValue(fakeTurns);

    mockReq = {
      params: { id: 'session-123' },
      query: { questionId: 'q-456' },
      user: { _id: 'user-789' } as any,
    };

    await (controller as any).getConversationHistory(mockReq as Request, mockRes as Response, vi.fn());

    expect(mockInterviewService.getConversationHistory).toHaveBeenCalledWith(
      'session-123',
      'user-789',
      'q-456'
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: fakeTurns });
  });
});
