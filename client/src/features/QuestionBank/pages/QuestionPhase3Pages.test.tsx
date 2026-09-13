import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuestionSelectionPage } from './QuestionSelectionPage';
import { QuestionAnalyticsPage } from './QuestionAnalyticsPage';
import { QuestionImportExportPage } from './QuestionImportExportPage';
import { QuestionAiAssistantPage } from './QuestionAiAssistantPage';

const api = vi.hoisted(() => ({
  selectQuestions: vi.fn(),
  getCoverage: vi.fn(),
  getAnalytics: vi.fn(),
  importQuestions: vi.fn(),
  exportQuestions: vi.fn(),
  generateAiDraft: vi.fn(),
}));

vi.mock('../api/questionBankApi', () => ({
  questionBankApi: api,
  createIdempotencyKey: () => 'qb-test-idempotency-key-001',
}));

describe('AIP-64 Phase 3 Frontend Pages', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('QuestionSelectionPage', () => {
    it('renders form and executes selection simulation with diagnostics', async () => {
      api.selectQuestions.mockResolvedValueOnce({
        selected: [
          {
            id: '64b000000000000000000001',
            code: 'QB-2026-000001',
            versionNumber: 1,
            prompt: { vi: 'Câu hỏi tuyển chọn 1', en: 'Selection question 1' },
            type: 'TECHNICAL',
            difficulty: 'MEDIUM',
            primaryRoleId: '64b000000000000000000002',
            levelIds: ['64b000000000000000000003'],
            technologies: [],
          },
        ],
        diagnostics: {
          requestedCount: 5,
          availableCount: 1,
          selectedCount: 1,
          isPoolSufficient: false,
          insufficientReason: 'Chỉ có 1 câu hỏi thỏa mãn',
        },
      });

      render(
        <MemoryRouter>
          <QuestionSelectionPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Mô phỏng tuyển chọn câu hỏi')).toBeInTheDocument();
      expect(screen.getByText(/Ranh giới độc lập/i)).toBeInTheDocument();

      const submitButton = screen.getByRole('button', { name: 'Chạy mô phỏng tuyển chọn' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.selectQuestions).toHaveBeenCalledWith(
          expect.objectContaining({ count: 5 })
        );
      });

      expect(await screen.findByText('QB-2026-000001')).toBeInTheDocument();
      expect(screen.getByText('Thiếu câu hỏi')).toBeInTheDocument();
      expect(screen.getByText(/Chỉ có 1 câu hỏi thỏa mãn/i)).toBeInTheDocument();
    });
  });

  describe('QuestionAnalyticsPage', () => {
    it('loads and renders coverage and switches to analytics tab', async () => {
      api.getCoverage.mockResolvedValueOnce({
        totalQuestions: 10,
        activeQuestions: 8,
        retiredQuestions: 2,
        publishedActiveQuestions: 6,
        draftOnlyQuestions: 2,
        byRole: [
          { id: 'role-1', name: 'Backend', publishedCount: 4, draftCount: 1, totalCount: 5 },
        ],
        byLevel: [
          { id: 'level-1', name: 'Junior', publishedCount: 2, draftCount: 1, totalCount: 3 },
        ],
        byTechnology: [],
        byDifficulty: { EASY: 2, MEDIUM: 3, HARD: 1 },
        byType: { TECHNICAL: 6, BEHAVIORAL: 0, SYSTEM_DESIGN: 0, CODING: 0, SCENARIO: 0 },
        byLanguage: { vi: 6, en: 4, bilingual: 4 },
        gaps: [
          { dimension: 'ROLE', id: 'role-2', name: 'Frontend', publishedCount: 0, gapType: 'ZERO_COVERAGE' },
        ],
      });

      api.getAnalytics.mockResolvedValueOnce({
        summary: {
          totalQuestions: 10,
          totalVersions: 15,
          publishedVersions: 6,
          inReviewVersions: 3,
          draftVersions: 6,
        },
        lifecycleDistribution: { ACTIVE: 8, RETIRED: 2 },
        versionStatusDistribution: { DRAFT: 6, IN_REVIEW: 3, APPROVED: 0, PUBLISHED: 6, SUPERSEDED: 0 },
        originDistribution: { MANUAL: 8, IMPORTED: 2, AI_ASSISTED: 5 },
        difficultyDistribution: { EASY: 2, MEDIUM: 3, HARD: 1 },
        typeDistribution: { TECHNICAL: 6, BEHAVIORAL: 0, SYSTEM_DESIGN: 0, CODING: 0, SCENARIO: 0 },
        activityTimeline: [
          { date: '2026-09-10', submissions: 2, approvals: 1, changesRequested: 0, publishes: 1 },
        ],
      });

      render(
        <MemoryRouter>
          <QuestionAnalyticsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Độ phủ & Báo cáo Thống kê')).toBeInTheDocument();
      expect(await screen.findByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Chưa có câu hỏi')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();

      // Switch to analytics tab
      const analyticsTabButton = screen.getByRole('button', { name: /Thống kê Quản trị & Timeline/i });
      fireEvent.click(analyticsTabButton);

      expect(await screen.findByText('Lịch sử hoạt động theo ngày (Activity Timeline)')).toBeInTheDocument();
      expect(screen.getByText('2026-09-10')).toBeInTheDocument();
    });
  });

  describe('QuestionImportExportPage', () => {
    it('handles dry-run import and export flows', async () => {
      api.importQuestions.mockResolvedValueOnce({
        data: {
          dryRun: true,
          totalRecords: 2,
          validCount: 1,
          invalidCount: 1,
          errors: [{ row: 2, field: 'prompt', message: 'Thiếu prompt' }],
        },
      });

      render(
        <MemoryRouter>
          <QuestionImportExportPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Nhập & Xuất dữ liệu (Import / Export)')).toBeInTheDocument();

      const textarea = screen.getByLabelText(/Nội dung dữ liệu/i);
      fireEvent.change(textarea, {
        target: { value: JSON.stringify([{ prompt: { vi: 'test' } }, { prompt: {} }]) },
      });

      const importBtn = screen.getByRole('button', { name: /Kiểm thử dữ liệu \(Dry Run\)/i });
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(api.importQuestions).toHaveBeenCalled();
      });

      expect(await screen.findByText('Thiếu prompt')).toBeInTheDocument();

      // Switch to export tab
      const exportTab = screen.getByRole('button', { name: 'Xuất dữ liệu (Export)' });
      fireEvent.click(exportTab);

      api.exportQuestions.mockResolvedValueOnce({
        format: 'JSON',
        count: 1,
        total: 1,
        data: [{ code: 'QB-2026-000001' }],
      });

      const exportBtn = screen.getByRole('button', { name: 'Xuất dữ liệu ngay' });
      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(api.exportQuestions).toHaveBeenCalled();
      });

      expect(await screen.findByText(/QB-2026-000001/)).toBeInTheDocument();
    });
  });

  describe('QuestionAiAssistantPage', () => {
    it('generates structured AI draft and renders preview', async () => {
      api.generateAiDraft.mockResolvedValueOnce({
        data: {
          draft: {
            prompt: { vi: 'Câu hỏi AI', en: 'AI Question' },
            explanation: { vi: 'Giải thích AI', en: 'AI explanation' },
            referenceAnswer: { vi: 'Đáp án AI', en: 'AI answer' },
            learningObjective: { vi: 'Mục tiêu AI', en: 'AI objective' },
            estimatedTimeSeconds: 300,
            followUps: [],
            rubric: [
              {
                key: 'core',
                title: { vi: 'Khái niệm', en: 'Concept' },
                description: { vi: 'Mô tả', en: 'Desc' },
                weight: 100,
                levels: [],
              },
            ],
            topic: 'Docker Containers',
            tags: ['docker'],
          },
          persistedQuestion: {
            id: '64b000000000000000000099',
            code: 'QB-2026-000099',
            versionNumber: 1,
          },
        },
      });

      render(
        <MemoryRouter>
          <QuestionAiAssistantPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Trợ lý AI tạo bản nháp (AI Assistant)')).toBeInTheDocument();
      expect(screen.getByText(/Nguyên tắc Bất biến/i)).toBeInTheDocument();

      const topicInput = screen.getByLabelText(/Chủ đề câu hỏi/i);
      fireEvent.change(topicInput, { target: { value: 'Docker Containers' } });

      const persistCheckbox = screen.getByRole('checkbox', { name: /Tự động lưu vào Ngân hàng/i });
      fireEvent.click(persistCheckbox);

      const generateBtn = screen.getByRole('button', { name: 'Biên soạn bằng AI' });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(api.generateAiDraft).toHaveBeenCalledWith(
          expect.objectContaining({
            topic: 'Docker Containers',
            persistDraft: true,
          }),
          expect.any(String)
        );
      });

      expect(await screen.findByText(/QB-2026-000099 \(Phiên bản v1\)/)).toBeInTheDocument();
      expect(screen.getByText('Câu hỏi AI')).toBeInTheDocument();
      expect(screen.getByText('Đáp án AI')).toBeInTheDocument();
    });
  });
});
