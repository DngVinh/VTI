import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSystemDesignWhiteboard } from '../hooks/useSystemDesignWhiteboard';
import { interviewApi } from '../../../services/api/interviewApi';

vi.mock('../../../services/api/interviewApi', () => ({
  interviewApi: {
    submitWhiteboardSnapshot: vi.fn(),
  },
}));

describe('useSystemDesignWhiteboard Hook (Micro-Task 4.8)', () => {
  const mockSessionId = 'session-999';
  const mockQuestionId = 'q-arch-2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manages canvas nodes and edges in state', () => {
    const { result } = renderHook(() =>
      useSystemDesignWhiteboard({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);

    act(() => {
      result.current.addNode('LOAD_BALANCER', 'ALB', 100, 100);
      result.current.addNode('DATABASE', 'Postgres', 400, 100);
    });

    expect(result.current.nodes.length).toBe(2);

    act(() => {
      result.current.addEdge(result.current.nodes[0].id, result.current.nodes[1].id, 'TCP');
    });

    expect(result.current.edges.length).toBe(1);
    expect(result.current.edges[0].protocol).toBe('TCP');
  });

  it('submits whiteboard snapshot and saves critique analysis', async () => {
    const fakeCritique = {
      detectedNodes: [{ type: 'DATABASE', label: 'Postgres' }],
      issues: [],
      tradeOffEvaluation: { vi: 'Hợp lý', en: 'Good' },
      score: 9,
    };

    (interviewApi.submitWhiteboardSnapshot as any).mockResolvedValue({
      snapshotId: 'snap-1',
      analysis: fakeCritique,
    });

    const { result } = renderHook(() =>
      useSystemDesignWhiteboard({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    await act(async () => {
      await result.current.submitWhiteboard('data:image/png;base64,fake-bytes');
    });

    expect(interviewApi.submitWhiteboardSnapshot).toHaveBeenCalledWith(mockSessionId, {
      questionId: mockQuestionId,
      imageBase64: 'data:image/png;base64,fake-bytes',
      mimeType: 'image/png',
      canvasData: expect.any(Object),
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.critique?.score).toBe(9);
    expect(result.current.error).toBeNull();
  });

  it('resets canvas and critique when clearCanvas is called', () => {
    const { result } = renderHook(() =>
      useSystemDesignWhiteboard({ sessionId: mockSessionId, questionId: mockQuestionId })
    );

    act(() => {
      result.current.addNode('SERVICE', 'API', 100, 100);
    });

    expect(result.current.nodes.length).toBe(1);

    act(() => {
      result.current.clearCanvas();
    });

    expect(result.current.nodes.length).toBe(0);
    expect(result.current.edges.length).toBe(0);
    expect(result.current.critique).toBeNull();
  });
});
