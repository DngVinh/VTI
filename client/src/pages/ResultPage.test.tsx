import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultPage } from './ResultPage';
import { interviewApi } from '../services/api/interviewApi';

vi.mock('../services/api/interviewApi', () => ({
  interviewApi: {
    fetchInterviewSession: vi.fn(),
    fetchRoles: vi.fn(),
    fetchLevels: vi.fn(),
  },
}));

// Mock ResizeObserver for Recharts
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ResultPage', () => {
  const mockSession = {
    _id: 'session-123',
    status: 'COMPLETED',
    overallScore: 8.5,
    setupData: {
      jobPosition: 'role-1',
      level: 'level-1',
    },
    dimensions: [
      { name: 'Technical Depth', score: 8, reasoning: 'Good' },
    ],
    learningPath: [],
    questions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewApi.fetchInterviewSession).mockResolvedValue(mockSession as any);
    vi.mocked(interviewApi.fetchRoles).mockResolvedValue([{ _id: 'role-1', code: 'FE', name: 'Frontend Engineer' }]);
    vi.mocked(interviewApi.fetchLevels).mockResolvedValue([{ _id: 'level-1', code: 'SENIOR', name: 'Senior' }]);
  });

  it('toggles language between Vietnamese and English for static labels', async () => {
    render(
      <MemoryRouter initialEntries={['/result/session-123']}>
        <Routes>
          <Route path="/result/:sessionId" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Báo cáo đánh giá năng lực')).toBeInTheDocument();
    });
    expect(screen.getByText('Điểm tổng quan')).toBeInTheDocument();

    const enBtn = screen.getByRole('button', { name: 'English' });
    fireEvent.click(enBtn);

    expect(screen.getByText('Competency Assessment Report')).toBeInTheDocument();
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });
});
