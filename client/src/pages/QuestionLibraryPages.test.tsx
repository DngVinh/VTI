import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QuestionLibraryListPage } from './QuestionLibraryListPage';
import { QuestionStudyDetailPage } from './QuestionStudyDetailPage';
import { publicQuestionApi } from '../services/api/publicQuestionApi';

describe('QuestionLibraryPages Component Tests', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('QuestionLibraryListPage', () => {
    it('renders list page with filter controls and question cards', async () => {
      vi.spyOn(publicQuestionApi, 'fetchTaxonomyFilters').mockResolvedValue({
        roles: [{ _id: 'r1', name: 'Backend Developer' }],
        levels: [{ _id: 'l1', name: 'Middle' }],
        technologies: [{ _id: 't1', name: 'Node.js' }],
      });

      vi.spyOn(publicQuestionApi, 'fetchPublicQuestions').mockResolvedValue({
        items: [
          {
            id: 'q1',
            code: 'QB-2026-000001',
            prompt: {
              vi: 'Giải thích cơ chế Event Loop trong Node.js.',
              en: 'Explain the Event Loop mechanism in Node.js.',
            },
            difficulty: 'MEDIUM',
            questionType: 'TECHNICAL',
            primaryRoleId: 'r1',
            role: { id: 'r1', name: 'Backend Developer' },
            levelIds: ['l1'],
            levels: [{ id: 'l1', name: 'Middle' }],
            technologies: [{ id: 't1', name: 'Node.js', relevance: 100 }],
            topic: 'Runtime',
            tags: ['nodejs', 'eventloop'],
            updatedAt: '2026-09-13T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 9,
        totalPages: 1,
      });

      render(
        <MemoryRouter initialEntries={['/questions']}>
          <Routes>
            <Route path="/questions" element={<QuestionLibraryListPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/Thư viện câu hỏi & Đáp án mẫu ôn tập/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Tìm kiếm câu hỏi/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('QB-2026-000001')).toBeInTheDocument();
        expect(screen.getByText(/Giải thích cơ chế Event Loop/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Trung bình/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Backend Developer/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Node.js').length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getByRole('link', { name: /xem đáp án & lời giải/i })).toHaveAttribute(
        'href',
        '/questions/q1'
      );
    });

    it('shows empty state when no questions match', async () => {
      vi.spyOn(publicQuestionApi, 'fetchTaxonomyFilters').mockResolvedValue({
        roles: [],
        levels: [],
        technologies: [],
      });

      vi.spyOn(publicQuestionApi, 'fetchPublicQuestions').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 9,
        totalPages: 0,
      });

      render(
        <MemoryRouter initialEntries={['/questions']}>
          <Routes>
            <Route path="/questions" element={<QuestionLibraryListPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Không tìm thấy câu hỏi phù hợp/i)).toBeInTheDocument();
      });
    });
  });

  describe('QuestionStudyDetailPage', () => {
    it('renders detail with prompt, model answer, rubric 0-4 and bilingual toggle', async () => {
      vi.spyOn(publicQuestionApi, 'fetchPublicQuestionById').mockResolvedValue({
        id: 'q1',
        code: 'QB-2026-000001',
        versionNumber: 1,
        prompt: {
          vi: 'Giải thích cơ chế Event Loop trong Node.js.',
          en: 'Explain Event Loop in Node.js.',
        },
        explanation: {
          vi: 'Lời giải thích chi tiết về các phase của libuv.',
          en: 'Detailed explanation regarding libuv phases.',
        },
        referenceAnswer: {
          vi: 'Đáp án chuẩn từ chuyên gia.',
          en: 'Standard expert answer.',
        },
        learningObjective: {
          vi: 'Mục tiêu nắm vững non-blocking I/O.',
          en: 'Understand non-blocking I/O.',
        },
        difficulty: 'MEDIUM',
        questionType: 'TECHNICAL',
        primaryRoleId: 'r1',
        role: { id: 'r1', name: 'Backend Developer' },
        levelIds: ['l1'],
        levels: [{ id: 'l1', name: 'Middle' }],
        technologies: [{ id: 't1', name: 'Node.js', relevance: 100 }],
        topic: 'Runtime',
        tags: ['nodejs'],
        estimatedTimeSeconds: 300,
        updatedAt: '2026-09-13T00:00:00.000Z',
        rubric: [
          {
            key: 'core-concepts',
            title: { vi: 'Khái niệm cốt lõi', en: 'Core Concepts' },
            description: { vi: 'Hiểu các phase', en: 'Understand phases' },
            weight: 60,
            levels: [
              { score: 0, description: { vi: 'Chưa đạt', en: 'Missing' } },
              { score: 1, description: { vi: 'Cơ bản', en: 'Basic' } },
              { score: 2, description: { vi: 'Đạt chuẩn', en: 'Adequate' } },
              { score: 3, description: { vi: 'Khá tốt', en: 'Good' } },
              { score: 4, description: { vi: 'Xuất sắc', en: 'Excellent' } },
            ],
          },
        ],
      });

      render(
        <MemoryRouter initialEntries={['/questions/q1']}>
          <Routes>
            <Route path="/questions/:id" element={<QuestionStudyDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('QB-2026-000001').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Giải thích cơ chế Event Loop/i)).toBeInTheDocument();
        expect(screen.getByText(/Đáp án chuẩn từ chuyên gia/i)).toBeInTheDocument();
        expect(screen.getByText(/Lời giải thích chi tiết về các phase/i)).toBeInTheDocument();
        expect(screen.getByText(/Khái niệm cốt lõi/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Xuất sắc/i).length).toBeGreaterThanOrEqual(1);
      });

      // Test Language Toggle to English
      const enBtn = screen.getByRole('button', { name: /english/i });
      fireEvent.click(enBtn);

      await waitFor(() => {
        expect(screen.getByText(/Standard expert answer/i)).toBeInTheDocument();
        expect(screen.getByText(/Detailed explanation regarding libuv phases/i)).toBeInTheDocument();
      });

      // Test CTA button exists
      expect(
        screen.getByRole('button', { name: /luyện phỏng vấn câu này với ai/i })
      ).toBeInTheDocument();
    });
  });
});
