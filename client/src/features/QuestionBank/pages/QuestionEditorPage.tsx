import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApiError } from '../../../auth/types';
import { questionBankApi, createIdempotencyKey, createVersionEtag } from '../api/questionBankApi';
import { RubricEditor } from '../components/RubricEditor';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { enumLabel } from '../components/enumLabels';
import { useSerializedAutosave } from '../hooks/useSerializedAutosave';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { validateQuestionDraft, validateQuestionForLibrary } from '../schemas/questionBankSchemas';
import { AppShell } from '../../../layouts/AppShell';
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  emptyQuestionVersionInput,
  toVersionInput,
} from '../types';
import type {
  EditorConflict,
  QuestionAdminDetailDto,
  QuestionVersionInput,
} from '../types';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100';
const sectionClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const splitTags = (value: string) => value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

const standardRubric = (): QuestionVersionInput['rubric'] => [
  {
    key: 'core-accuracy',
    title: { vi: 'Độ chính xác & kiến thức cốt lõi', en: 'Accuracy & Core Knowledge' },
    description: { vi: 'Đánh giá mức độ đúng và đầy đủ của kiến thức chuyên môn.', en: 'Assesses the correctness and completeness of the technical knowledge.' },
    weight: 60,
    levels: [
      { score: 0, description: { vi: 'Không trả lời hoặc sai bản chất.', en: 'No answer or fundamentally incorrect.' } },
      { score: 1, description: { vi: 'Nêu được vài ý rời rạc, còn nhiều điểm sai.', en: 'Mentions isolated points with major inaccuracies.' } },
      { score: 2, description: { vi: 'Trả lời đúng ý chính nhưng còn thiếu chi tiết.', en: 'Covers the main idea but misses important details.' } },
      { score: 3, description: { vi: 'Giải thích đúng, có cấu trúc và ví dụ phù hợp.', en: 'Explains correctly with clear structure and suitable examples.' } },
      { score: 4, description: { vi: 'Phân tích sâu, chính xác và nêu được trade-off.', en: 'Provides a deep, accurate analysis and explains trade-offs.' } },
    ],
  },
  {
    key: 'reasoning-communication',
    title: { vi: 'Lập luận & trình bày', en: 'Reasoning & Communication' },
    description: { vi: 'Đánh giá cách tư duy, liên kết ý và truyền đạt câu trả lời.', en: 'Assesses reasoning, connections between ideas, and communication.' },
    weight: 40,
    levels: [
      { score: 0, description: { vi: 'Không thể hiện được cách tiếp cận.', en: 'Does not demonstrate an approach.' } },
      { score: 1, description: { vi: 'Trình bày khó theo dõi, thiếu mạch lạc.', en: 'Difficult to follow and lacks coherence.' } },
      { score: 2, description: { vi: 'Có cấu trúc cơ bản nhưng diễn giải còn hạn chế.', en: 'Has a basic structure but limited explanation.' } },
      { score: 3, description: { vi: 'Mạch lạc, có dẫn chứng và trả lời đúng trọng tâm.', en: 'Clear, supported by examples, and focused.' } },
      { score: 4, description: { vi: 'Rất rõ ràng, chủ động nêu giả định và hệ quả.', en: 'Exceptionally clear, stating assumptions and consequences.' } },
    ],
  },
];

const newQuestionVersionInput = (): QuestionVersionInput => {
  const draft = emptyQuestionVersionInput();
  draft.answer.estimatedTimeSeconds = 300;
  draft.rubric = standardRubric();
  return draft;
};

export const QuestionEditorPage = () => {
  const { questionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = location.pathname.endsWith('/new');
  const requestedEdit = location.pathname.endsWith('/edit');
  const [draft, setDraft] = useState<QuestionVersionInput>(newQuestionVersionInput);
  const [detail, setDetail] = useState<QuestionAdminDetailDto | null>(null);
  const etagRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newDirty, setNewDirty] = useState(false);
  const [conflict, setConflict] = useState<EditorConflict | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const versionIdempotencyKeyRef = useRef(createIdempotencyKey());
  const publishIdempotencyKeyRef = useRef(createIdempotencyKey());
  const activeVersion = detail?.draftVersion ?? detail?.currentPublishedVersion ?? null;
  const editable = (isNew || requestedEdit) && (!activeVersion || activeVersion.status === 'DRAFT');

  const saveExisting = useCallback(async (value: QuestionVersionInput) => {
    if (!questionId || !detail?.draftVersion || !etagRef.current) {
      throw { message: 'Không có Draft mutable hoặc ETag hợp lệ.', status: 409 } satisfies ApiError;
    }
    const result = await questionBankApi.updateDraft(
      questionId,
      detail.draftVersion.versionNumber,
      value,
      etagRef.current
    );
    const nextEtag = result.etag ?? createVersionEtag(result.data);
    etagRef.current = nextEtag;
    setDetail((current) => current ? { ...current, draftVersion: result.data } : current);
  }, [detail, questionId]);

  const autosave = useSerializedAutosave<QuestionVersionInput>({
    enabled: !isNew && editable,
    delayMs: 1_500,
    save: saveExisting,
  });
  const markSaved = autosave.markSaved;
  useUnsavedChangesGuard(isNew ? newDirty : autosave.dirty);

  const loadQuestion = useCallback(async (signal?: AbortSignal) => {
    if (!questionId || isNew) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await questionBankApi.getQuestion(questionId, signal);
      const version = result.data.draftVersion ?? result.data.currentPublishedVersion;
      if (!version) throw { message: 'Câu hỏi chưa có version để hiển thị.' } satisfies ApiError;
      const input = toVersionInput(version);
      const nextEtag = result.etag ?? createVersionEtag(version);
      setDetail(result.data);
      setDraft(input);
      etagRef.current = nextEtag;
      markSaved(input);
    } catch (caught) {
      if (!signal?.aborted) setLoadError((caught as ApiError).message || 'Không thể tải câu hỏi.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [isNew, markSaved, questionId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadQuestion(controller.signal));
    return () => controller.abort();
  }, [loadQuestion]);

  useEffect(() => {
    if (autosave.status !== 'conflict' || conflict || !questionId) return;
    const controller = new AbortController();
    void questionBankApi.getQuestion(questionId, controller.signal)
      .then((result) => setConflict({
        message: autosave.error || 'Draft đã được cập nhật ở phiên làm việc khác.',
        server: result.data,
        serverEtag: result.etag,
      }))
      .catch(() => setConflict({ message: autosave.error || 'Có xung đột phiên bản.', server: null, serverEtag: null }));
    return () => controller.abort();
  }, [autosave.error, autosave.status, conflict, questionId]);

  const changeDraft = (transform: (current: QuestionVersionInput) => QuestionVersionInput) => {
    if (!editable) return;
    const next = transform(draft);
    setDraft(next);
    if (isNew) setNewDirty(true);
    const validation = validateQuestionDraft(next, isNew);
    setValidationErrors(validation.errors);
    if (!isNew) autosave.schedule(next, validation.valid);
  };

  const handleSave = async () => {
    const validation = isNew
      ? validateQuestionForLibrary(draft)
      : validateQuestionDraft(draft);
    setValidationErrors(validation.errors);
    if (!validation.valid) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }
    setCreateError(null);
    if (!isNew) {
      try { await autosave.saveNow(); } catch { /* Hook exposes the safe error state. */ }
      return;
    }

    setIsCreating(true);
    try {
      const result = await questionBankApi.createQuestion(draft, idempotencyKeyRef.current);
      const createdDraft = result.data.draftVersion;
      setNewDirty(false);
      autosave.markSaved(draft);
      if (!createdDraft) throw { message: 'Server không trả về Draft vừa tạo.' } satisfies ApiError;
      await questionBankApi.publishVersion(
        result.data.question.id,
        createdDraft.versionNumber,
        result.etag ?? createVersionEtag(createdDraft),
        publishIdempotencyKeyRef.current,
        'Admin tạo câu hỏi và đưa vào thư viện',
        true
      );
      navigate(`/admin/question-bank/questions/${result.data.question.id}/edit`, { replace: true });
    } catch (caught) {
      setCreateError((caught as ApiError).message || 'Không thể tạo câu hỏi.');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePublishToLibrary = async () => {
    const version = detail?.draftVersion;
    if (!questionId || !version || !etagRef.current) return;
    const validation = validateQuestionForLibrary(draft);
    setValidationErrors(validation.errors);
    if (!validation.valid) {
      window.setTimeout(() => errorSummaryRef.current?.focus(), 0);
      return;
    }

    setCreateError(null);
    setIsPublishing(true);
    try {
      if (autosave.dirty) await autosave.saveNow();
      await questionBankApi.publishVersion(
        questionId,
        version.versionNumber,
        etagRef.current,
        publishIdempotencyKeyRef.current,
        'Admin đưa bản nháp vào thư viện',
        true
      );
      await loadQuestion();
    } catch (caught) {
      setCreateError((caught as ApiError).message || 'Không thể đưa câu hỏi vào thư viện.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCreateVersion = async () => {
    const published = detail?.currentPublishedVersion;
    if (!questionId || !published || !etagRef.current) return;
    setCreateError(null);
    setIsCreatingVersion(true);
    try {
      await questionBankApi.createVersion(
        questionId,
        { sourceVersionNumber: published.versionNumber },
        etagRef.current,
        versionIdempotencyKeyRef.current
      );
      await loadQuestion();
      navigate('/admin/question-bank/questions/' + questionId + '/edit', { replace: true });
    } catch (caught) {
      setCreateError((caught as ApiError).message || 'Không thể tạo Draft mới.');
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const loadServerCopy = () => {
    const serverDraft = conflict?.server?.draftVersion;
    if (!serverDraft) return;
    const serverInput = toVersionInput(serverDraft);
    setDraft(serverInput);
    const nextEtag = conflict?.serverEtag ?? createVersionEtag(serverDraft);
    etagRef.current = nextEtag;
    setDetail(conflict.server);
    setConflict(null);
    setValidationErrors({});
    autosave.markSaved(serverInput);
  };

  if (loading) return <main className="p-12 text-center" role="status" aria-live="polite">Đang tải Question Editor…</main>;
  if (loadError) return <main className="p-12 text-center" role="alert"><p className="font-bold text-red-700">{loadError}</p><button className="mt-4 rounded-lg border px-4 py-2" onClick={() => void loadQuestion()} type="button">Thử lại</button></main>;

  const hasPromptVi = Boolean(draft.content.prompt.vi.trim());
  const hasPromptEn = Boolean(draft.content.prompt.en.trim());

  return (
    <AppShell>
      <main className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm font-bold text-indigo-700 hover:underline" to="/admin/question-bank">← Quản lý câu hỏi</Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-indigo-700">{isNew ? 'Tạo mới' : 'Chỉnh sửa'}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-950">{isNew ? 'Tạo câu hỏi mới' : detail?.question.code ?? 'Câu hỏi'}</h1>
            <p className="mt-2 text-sm text-slate-600">{isNew ? 'Nhập thông tin cốt lõi rồi lưu để đưa ngay vào thư viện.' : 'Chỉnh sửa nội dung và thông tin chính của câu hỏi.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isNew && <SaveStatusIndicator status={autosave.status} />}
            {!isNew && !detail?.draftVersion && detail?.currentPublishedVersion && (
              <button
                className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-700 disabled:opacity-50"
                disabled={isCreatingVersion}
                onClick={() => void handleCreateVersion()}
                type="button"
              >
                {isCreatingVersion ? 'Đang tạo…' : 'Tạo bản nháp chỉnh sửa'}
              </button>
            )}
            {!isNew && detail?.draftVersion && (
              <button
                className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                disabled={isPublishing}
                onClick={() => void handlePublishToLibrary()}
                type="button"
              >
                {isPublishing ? 'Đang đưa vào…' : 'Đưa vào thư viện'}
              </button>
            )}
            {!requestedEdit && !isNew && detail?.draftVersion && <Link className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-700" to={`/admin/question-bank/questions/${questionId}/edit`}>Chỉnh sửa Draft</Link>}
            {editable && <button className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white shadow-sm disabled:opacity-50" disabled={isCreating || autosave.status === 'saving' || autosave.status === 'conflict' || isPublishing} onClick={() => void handleSave()} type="button">{isCreating ? 'Đang tạo…' : autosave.status === 'saving' ? 'Đang lưu…' : isNew ? 'Thêm vào thư viện' : 'Lưu thay đổi'}</button>}
          </div>
        </header>

        {!isNew && activeVersion && <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Phiên bản {activeVersion.versionNumber} · Revision {activeVersion.revision} · Trạng thái: <strong className="text-slate-900">{activeVersion.status}</strong></p>}
        {requestedEdit && !detail?.draftVersion && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-900" role="alert">Câu hỏi này chưa có bản nháp để chỉnh sửa. Hãy tạo bản nháp chỉnh sửa trước.</p>}
        {(Object.keys(validationErrors).length > 0 || createError || autosave.status === 'error') && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900" ref={errorSummaryRef} role="alert" tabIndex={-1}>
            <h2 className="font-extrabold">Không thể lưu vì có lỗi</h2>
            {createError && <p>{createError}</p>}
            {autosave.status === 'error' && <p>{autosave.error}</p>}
            <ul className="mt-2 list-disc pl-5">{Object.entries(validationErrors).map(([field, message]) => <li key={field}><strong>{field}:</strong> {message}</li>)}</ul>
          </div>
        )}
        {conflict && (
          <section aria-labelledby="conflict-heading" className="rounded-xl border-2 border-red-400 bg-red-50 p-5">
            <h2 className="text-lg font-extrabold text-red-950" id="conflict-heading">Xung đột chỉnh sửa — dữ liệu local đang được giữ nguyên</h2>
            <p className="mt-2 text-sm text-red-900">{conflict.message}</p>
            <p className="mt-2 text-sm"><strong>Server revision:</strong> {conflict.server?.draftVersion?.revision ?? 'không tải được'}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm"><strong>Server prompt VI:</strong> {conflict.server?.draftVersion?.content.prompt.vi || '—'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={!conflict.server?.draftVersion} onClick={loadServerCopy} type="button">Bỏ bản local và nạp bản server</button>
            </div>
          </section>
        )}

        <fieldset className={sectionClass} disabled={!editable}>
          <legend className="px-1 text-xl font-extrabold text-slate-900">Nội dung câu hỏi</legend>
          <p className="mt-1 text-sm text-slate-500">Viết câu hỏi và lời giải thích tương ứng; tiếng Anh có thể bổ sung sau.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextArea label="Câu hỏi (VI)" maxLength={5_000} required value={draft.content.prompt.vi} onChange={(vi) => changeDraft((current) => ({ ...current, content: { ...current.content, prompt: { ...current.content.prompt, vi } } }))} />
            <TextArea label="Câu hỏi (EN) — tùy chọn" maxLength={5_000} value={draft.content.prompt.en} onChange={(en) => changeDraft((current) => ({ ...current, content: { ...current.content, prompt: { ...current.content.prompt, en } } }))} />
            <TextArea label="Giải thích (VI)" maxLength={5_000} required={hasPromptVi} value={draft.content.explanation?.vi ?? ''} onChange={(vi) => changeDraft((current) => ({ ...current, content: { ...current.content, explanation: { vi, en: current.content.explanation?.en ?? '' } } }))} />
            <TextArea label="Giải thích (EN) — tùy chọn" maxLength={5_000} required={hasPromptEn} value={draft.content.explanation?.en ?? ''} onChange={(en) => changeDraft((current) => ({ ...current, content: { ...current.content, explanation: { vi: current.content.explanation?.vi ?? '', en } } }))} />
          </div>
        </fieldset>

        <fieldset className={sectionClass} disabled={!editable}>
          <legend className="px-1 text-xl font-extrabold text-slate-900">Thông tin nhanh</legend>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SelectField label="Loại câu hỏi" options={[...QUESTION_TYPES]} value={draft.classification.type ?? ''} onChange={(type) => changeDraft((current) => ({ ...current, classification: { ...current.classification, type: type || null } }))} />
            <SelectField label="Độ khó" options={[...DIFFICULTIES]} value={draft.classification.difficulty ?? ''} onChange={(difficulty) => changeDraft((current) => ({ ...current, classification: { ...current.classification, difficulty: difficulty || null } }))} />
            <Field label="Topic — tùy chọn" value={draft.classification.topic ?? ''} onChange={(topic) => changeDraft((current) => ({ ...current, classification: { ...current.classification, topic: topic.trim() || null } }))} />
            <Field label="Tags — phân cách bằng dấu phẩy" value={draft.classification.tags.join(', ')} onChange={(value) => changeDraft((current) => ({ ...current, classification: { ...current.classification, tags: splitTags(value) } }))} />
          </div>
        </fieldset>

        <fieldset className={sectionClass} disabled={!editable}>
          <legend className="px-1 text-xl font-extrabold text-slate-900">Đáp án & tiêu chí chấm điểm</legend>
          <p className="mt-1 text-sm text-slate-500">Các trường này giúp câu hỏi hiển thị đầy đủ như QB-2026-000001.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextArea label="Đáp án (VI)" maxLength={20_000} required={hasPromptVi} value={draft.answer.referenceAnswer.vi} onChange={(vi) => changeDraft((current) => ({ ...current, answer: { ...current.answer, referenceAnswer: { ...current.answer.referenceAnswer, vi } } }))} />
            <TextArea label="Đáp án (EN) — tùy chọn" maxLength={20_000} required={hasPromptEn} value={draft.answer.referenceAnswer.en} onChange={(en) => changeDraft((current) => ({ ...current, answer: { ...current.answer, referenceAnswer: { ...current.answer.referenceAnswer, en } } }))} />
            <TextArea label="Mục tiêu đánh giá (VI)" maxLength={1_000} required={hasPromptVi} value={draft.answer.learningObjective.vi} onChange={(vi) => changeDraft((current) => ({ ...current, answer: { ...current.answer, learningObjective: { ...current.answer.learningObjective, vi } } }))} />
            <TextArea label="Mục tiêu đánh giá (EN) — tùy chọn" maxLength={1_000} required={hasPromptEn} value={draft.answer.learningObjective.en} onChange={(en) => changeDraft((current) => ({ ...current, answer: { ...current.answer, learningObjective: { ...current.answer.learningObjective, en } } }))} />
            <label className="text-sm font-semibold text-slate-700">Thời gian dự kiến (giây)
              <input className={inputClass} max={3_600} min={30} onChange={(event) => changeDraft((current) => ({ ...current, answer: { ...current.answer, estimatedTimeSeconds: event.target.value ? Number(event.target.value) : null } }))} type="number" value={draft.answer.estimatedTimeSeconds ?? ''} />
            </label>
          </div>
          <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <p className="mb-4 text-sm text-indigo-900">Rubric 0–4 đã được điền sẵn 2 tiêu chí và đủ 5 mức điểm. Bạn chỉ cần tinh chỉnh cho sát câu hỏi nếu cần.</p>
            <RubricEditor onChange={(rubric) => changeDraft((current) => ({ ...current, rubric }))} value={draft.rubric} />
          </div>
        </fieldset>
      </div>
    </main>
  </AppShell>
);
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="text-sm font-semibold text-slate-700">{label}<input className={inputClass} onChange={(event) => onChange(event.target.value)} value={value} /></label>
);

const TextArea = ({ label, value, onChange, maxLength, disabled = false, required = false }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; disabled?: boolean; required?: boolean }) => (
  <label className="text-sm font-semibold text-slate-700">{label}<textarea aria-label={label} aria-required={required} className={`${inputClass} min-h-28`} disabled={disabled} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} required={required} value={value} /></label>
);

const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="text-sm font-semibold text-slate-700">{label}<select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}><option value="">Chưa chọn</option>{options.map((option) => <option key={option} value={option}>{enumLabel(option)}</option>)}</select></label>
);
