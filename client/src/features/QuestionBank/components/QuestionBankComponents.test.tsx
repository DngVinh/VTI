import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CandidatePreview } from './CandidatePreview';
import { QuestionBankFilters } from './QuestionBankFilters';
import { QuestionBankTable } from './QuestionBankTable';
import { RubricEditor } from './RubricEditor';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { VersionHistory } from './VersionHistory';
import { enumLabel } from './enumLabels';
import { emptyQuestionVersionInput } from '../types';
import type { QuestionSummaryDto, QuestionVersionAdminDetailDto } from '../types';

const apiMocks = vi.hoisted(() => ({
  listVersions: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock('../api/questionBankApi', () => ({
  questionBankApi: apiMocks,
}));

describe('Question Bank authoring components', () => {
  afterEach(cleanup);

  beforeEach(() => {
    apiMocks.listVersions.mockReset();
    apiMocks.getVersion.mockReset();
  });

  it('candidate preview renders allowlisted prompt metadata without restricted answer or rubric', () => {
    const draft = emptyQuestionVersionInput();
    draft.content.prompt.vi = 'Prompt visible';
    draft.answer.referenceAnswer.vi = 'SECRET ANSWER';
    draft.rubric = [{ key: 'secret-rubric', title: { vi: 'SECRET RUBRIC', en: '' }, weight: 100, levels: [] }];
    render(<CandidatePreview classification={draft.classification} prompt={draft.content.prompt} />);
    expect(screen.getByText('Prompt visible')).toBeInTheDocument();
    expect(screen.queryByText('SECRET ANSWER')).not.toBeInTheDocument();
    expect(screen.queryByText('SECRET RUBRIC')).not.toBeInTheDocument();
  });

  it('creates a valid two-criterion rubric and supports removal and reordering controls', async () => {
    const user = userEvent.setup();
    let rubric = emptyQuestionVersionInput().rubric;
    const onChange = vi.fn((next) => { rubric = next; });
    const { rerender } = render(<RubricEditor onChange={onChange} value={rubric} />);
    await user.click(screen.getByRole('button', { name: 'Tạo rubric' }));
    expect(rubric).toHaveLength(2);
    rerender(<RubricEditor onChange={onChange} value={rubric} />);
    expect(screen.getByText('Tổng trọng số: 100/100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đưa tiêu chí 1 lên' })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Xóa' })[0]);
    expect(rubric).toHaveLength(1);
  });

  it('renders only the focused management filters', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onChange = vi.fn();
    render(
      <QuestionBankFilters
        onChange={onChange}
        onSearchChange={onSearchChange}
        query={{ page: 1, limit: 20, sortBy: 'updatedAt', sortOrder: 'desc' }}
        search=""
      />
    );

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'node' } });
    expect(onSearchChange).toHaveBeenLastCalledWith('node');
    await user.selectOptions(screen.getByLabelText('Độ khó'), 'HARD');
    expect(onChange).toHaveBeenCalledWith('difficulty', 'HARD');
    await user.selectOptions(screen.getByLabelText('Vòng đời'), 'RETIRED');
    expect(onChange).toHaveBeenLastCalledWith('lifecycleStatus', 'RETIRED');
    expect(screen.queryByLabelText('Role ID')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Technology ID')).not.toBeInTheDocument();
  });

  it('renders list fields with safe fallbacks and links', () => {
    const item: QuestionSummaryDto = {
      id: '507f1f77bcf86cd799439011',
      code: 'QB-2026-000001',
      lifecycleStatus: 'ACTIVE',
      revision: 0,
      promptPreview: { vi: 'Prompt VI', en: 'Prompt EN' },
      taxonomy: {
        primaryRoleId: '507f191e810c19729de860ea',
        additionalRoleIds: [],
        levelIds: ['507f191e810c19729de860eb'],
        technologyIds: [],
        technologyAgnostic: true,
        topic: 'Runtime',
        tags: [],
      },
      difficulty: 'MEDIUM',
      type: 'FUTURE_TYPE',
      origin: 'MANUAL',
      draftStatus: 'DRAFT',
      selectionStatus: 'UNAVAILABLE',
      latestVersionNumber: 1,
      draftVersionNumber: 1,
      currentPublishedVersionNumber: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    render(<MemoryRouter><QuestionBankTable items={[item]} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'QB-2026-000001' })).toHaveAttribute(
      'href',
      '/admin/question-bank/questions/507f1f77bcf86cd799439011'
    );
    expect(screen.getByText('Không xác định (FUTURE_TYPE)')).toBeInTheDocument();
    expect(screen.getByText('Runtime')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở QB-2026-000001' })).toHaveAttribute(
      'href',
      '/admin/question-bank/questions/507f1f77bcf86cd799439011/edit'
    );
  });

  it('renders every autosave state and enum fallback safely', () => {
    const { rerender } = render(<SaveStatusIndicator status="saved" />);
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu');
    for (const [status, label] of [
      ['unsaved', 'Có thay đổi chưa lưu'],
      ['saving', 'Đang lưu'],
      ['error', 'Lưu thất bại'],
      ['conflict', 'Xung đột phiên bản'],
    ] as const) {
      rerender(<SaveStatusIndicator status={status} />);
      expect(screen.getByRole('status')).toHaveTextContent(label);
    }
    expect(enumLabel(null)).toBe('—');
    expect(enumLabel('NEW_ENUM')).toBe('Không xác định (NEW_ENUM)');
  });

  it('loads and inspects immutable version history', async () => {
    const version = {
      ...emptyQuestionVersionInput(),
      id: '507f1f77bcf86cd799439012',
      questionId: '507f1f77bcf86cd799439011',
      versionNumber: 2,
      status: 'PUBLISHED',
      revision: 3,
      origin: 'MANUAL',
      provenance: { sourceVersionId: null, sourceReference: null },
      createdBy: '507f191e810c19729de860ea',
      updatedBy: '507f191e810c19729de860ea',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    } as QuestionVersionAdminDetailDto;
    apiMocks.listVersions.mockResolvedValue([version]);
    apiMocks.getVersion.mockResolvedValue(version);
    const user = userEvent.setup();
    render(<VersionHistory questionId={version.questionId} />);

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
    expect(await screen.findByText(/Version 2/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    await waitFor(() => expect(apiMocks.getVersion).toHaveBeenCalledWith(
      version.questionId,
      2,
      expect.any(AbortSignal)
    ));
    expect(await screen.findByText(/Reference answer VI:/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa khả dụng trong Phase 1/)).toBeInTheDocument();
  });
});

