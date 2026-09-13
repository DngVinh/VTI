import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TranslationModal } from '../components/TranslationModal';
import { SemanticDuplicatePanel } from '../components/SemanticDuplicatePanel';
import type { QuestionVersionInput } from '../types';

const api = vi.hoisted(() => ({
  previewTranslation: vi.fn(),
  applyTranslation: vi.fn(),
  detectSemanticDuplicates: vi.fn(),
}));

vi.mock('../api/questionBankApi', () => ({
  questionBankApi: api,
  createIdempotencyKey: () => 'qb-test-idempotency-key-002',
  createVersionEtag: (v: { id: string; revision: number }) => `W/"question-version:${v.id}:${v.revision}"`,
}));

const mockDraft: QuestionVersionInput = {
  content: {
    prompt: { vi: 'Câu hỏi tiếng Việt', en: '' },
    explanation: { vi: 'Giải thích', en: '' },
  },
  classification: {
    primaryRoleId: '64b000000000000000000001',
    additionalRoleIds: [],
    levelIds: ['64b000000000000000000002'],
    technologies: [],
    technologyAgnostic: false,
    classificationComplete: false,
    topic: 'Node.js',
    tags: ['nodejs'],
    difficulty: 'MEDIUM',
    type: 'TECHNICAL',
  },
  answer: {
    referenceAnswer: { vi: 'Đáp án', en: '' },
    learningObjective: { vi: 'Mục tiêu', en: '' },
    estimatedTimeSeconds: 120,
    followUps: [],
  },
  rubric: [],
  changeSummary: 'Init draft',
};

describe('AIP-65 Phase 4 Frontend Components', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('TranslationModal', () => {
    it('renders and previews translations with side-by-side diff', async () => {
      api.previewTranslation.mockResolvedValueOnce({
        sourceLocale: 'vi',
        targetLocale: 'en',
        fields: [
          {
            field: 'prompt',
            sourceText: 'Câu hỏi tiếng Việt',
            proposedText: 'Vietnamese question translated to EN',
            hasExistingTarget: false,
            wouldOverwrite: false,
          },
        ],
        proposed: {
          prompt: 'Vietnamese question translated to EN',
        },
        diffSummary: {
          totalFields: 1,
          newFields: 1,
          overwritingFields: 0,
        },
      });

      render(
        <TranslationModal
          isOpen={true}
          onClose={vi.fn()}
          questionId="64b000000000000000000010"
          versionNumber={1}
          currentDraft={mockDraft}
          etag='W/"question-version:64b000000000000000000010:0"'
          onApplied={vi.fn()}
        />
      );

      expect(screen.getByText(/AI-Assisted Bilingual Translation/i)).toBeInTheDocument();

      const previewBtn = screen.getByRole('button', { name: /Xem trước bản dịch/i });
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(api.previewTranslation).toHaveBeenCalledWith(
          '64b000000000000000000010',
          1,
          expect.objectContaining({
            sourceLocale: 'vi',
            targetLocale: 'en',
          })
        );
      });

      expect(await screen.findByText('Vietnamese question translated to EN')).toBeInTheDocument();
      expect(screen.getByText('Nội dung mới')).toBeInTheDocument();
    });

    it('requires confirmOverwrite checkbox when target field has existing text', async () => {
      api.previewTranslation.mockResolvedValueOnce({
        sourceLocale: 'vi',
        targetLocale: 'en',
        fields: [
          {
            field: 'prompt',
            sourceText: 'Câu hỏi VI',
            proposedText: 'Proposed EN',
            hasExistingTarget: true,
            wouldOverwrite: true,
          },
        ],
        proposed: { prompt: 'Proposed EN' },
        diffSummary: { totalFields: 1, newFields: 0, overwritingFields: 1 },
      });

      api.applyTranslation.mockResolvedValueOnce({
        data: {
          id: 'ver-1',
          versionNumber: 1,
          revision: 1,
          content: { prompt: { vi: 'Câu hỏi VI', en: 'Proposed EN' } },
        },
        etag: 'W/"question-version:ver-1:1"',
      });

      const onApplied = vi.fn();
      const onClose = vi.fn();

      render(
        <TranslationModal
          isOpen={true}
          onClose={onClose}
          questionId="64b000000000000000000010"
          versionNumber={1}
          currentDraft={mockDraft}
          etag='W/"question-version:64b000000000000000000010:0"'
          onApplied={onApplied}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Xem trước bản dịch/i }));

      expect(await screen.findByText(/Sẽ ghi đè nội dung hiện có/i)).toBeInTheDocument();

      const applyBtn = screen.getByRole('button', { name: /Áp dụng bản dịch/i });
      expect(applyBtn).toBeDisabled();

      // Check the confirm overwrite checkbox
      const checkbox = screen.getByRole('checkbox', {
        name: /Tôi đồng ý ghi đè nội dung hiện có/i,
      });
      fireEvent.click(checkbox);

      expect(applyBtn).not.toBeDisabled();
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(api.applyTranslation).toHaveBeenCalledWith(
          '64b000000000000000000010',
          1,
          expect.objectContaining({
            confirmOverwrite: true,
            fields: ['prompt'],
          }),
          'W/"question-version:64b000000000000000000010:0"',
          'qb-test-idempotency-key-002'
        );
        expect(onApplied).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('SemanticDuplicatePanel', () => {
    it('renders check button and displays advisory results with badges and links', async () => {
      api.detectSemanticDuplicates.mockResolvedValueOnce({
        matches: [
          {
            questionId: '64b000000000000000000099',
            versionNumber: 2,
            code: 'QB-2026-000099',
            title: { vi: 'Câu hỏi trùng lặp', en: 'Duplicate question' },
            similarityScore: 0.98,
            matchReason: 'EXACT_FINGERPRINT',
            taxonomyOverlap: 1.0,
            status: 'PUBLISHED',
          },
        ],
        totalMatches: 1,
        thresholdUsed: 0.75,
      });

      render(
        <MemoryRouter>
          <SemanticDuplicatePanel
            questionId="64b000000000000000000010"
            versionNumber={1}
            draft={mockDraft}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(/Kiểm tra trùng lặp ngữ nghĩa/i)).toBeInTheDocument();

      const checkBtn = screen.getByRole('button', { name: /Kiểm tra trùng lặp/i });
      fireEvent.click(checkBtn);

      await waitFor(() => {
        expect(api.detectSemanticDuplicates).toHaveBeenCalledWith(
          expect.objectContaining({
            target: 'EXISTING',
            questionId: '64b000000000000000000010',
            versionNumber: 1,
          })
        );
      });

      expect(await screen.findByText(/Trùng khớp chính xác/i)).toBeInTheDocument();
      expect(screen.getByText('QB-2026-000099 · v2')).toBeInTheDocument();
      expect(screen.getByText(/Taxonomy overlap: 100%/i)).toBeInTheDocument();
      expect(screen.getByText('Xem câu hỏi đối chứng ↗')).toBeInTheDocument();
    });

    it('displays green badge when no duplicates found', async () => {
      api.detectSemanticDuplicates.mockResolvedValueOnce({
        matches: [],
        totalMatches: 0,
        thresholdUsed: 0.75,
      });

      render(
        <MemoryRouter>
          <SemanticDuplicatePanel draft={mockDraft} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /Kiểm tra trùng lặp/i }));

      expect(
        await screen.findByText(/Không phát hiện câu hỏi trùng lặp/i)
      ).toBeInTheDocument();
    });
  });
});
