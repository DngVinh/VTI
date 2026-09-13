import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ApiError } from '../../../auth/types';
import { questionBankApi, createIdempotencyKey, createQuestionEtag, createVersionEtag } from '../api/questionBankApi';
import { CandidatePreview } from '../components/CandidatePreview';
import { RubricEditor } from '../components/RubricEditor';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { VersionHistory } from '../components/VersionHistory';
import { TranslationModal } from '../components/TranslationModal';
import { SemanticDuplicatePanel } from '../components/SemanticDuplicatePanel';
import { useSerializedAutosave } from '../hooks/useSerializedAutosave';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { validateQuestionDraft } from '../schemas/questionBankSchemas';
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
const splitIds = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const formatTechnologies = (value: QuestionVersionInput['classification']['technologies']) =>
  value.map(({ technologyId, relevance }) => `${technologyId}${relevance === null ? '' : `:${relevance}`}`).join(', ');
const parseTechnologies = (value: string) => splitIds(value).map((item) => {
  const [technologyId, rawRelevance] = item.split(':');
  const relevance = rawRelevance === undefined || rawRelevance === '' ? null : Number(rawRelevance);
  return { technologyId, relevance: Number.isFinite(relevance) ? relevance : null };
});

export const QuestionEditorPage = () => {
  const { questionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = location.pathname.endsWith('/new');
  const requestedEdit = location.pathname.endsWith('/edit');
  const [draft, setDraft] = useState<QuestionVersionInput>(emptyQuestionVersionInput);
  const [detail, setDetail] = useState<QuestionAdminDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [newDirty, setNewDirty] = useState(false);
  const [conflict, setConflict] = useState<EditorConflict | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const versionIdempotencyKeyRef = useRef(createIdempotencyKey());
  const workflowKeysRef = useRef<Record<string, string>>({});
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
    setEtag(nextEtag);
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
      setEtag(nextEtag);
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
    const validation = validateQuestionDraft(draft, isNew);
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
      navigate(`/admin/question-bank/questions/${result.data.question.id}/edit`, { replace: true });
    } catch (caught) {
      setCreateError((caught as ApiError).message || 'Không thể tạo câu hỏi.');
    } finally {
      setIsCreating(false);
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

  const handleSubmitReview = async () => {
    if (!questionId || !detail?.draftVersion || !etagRef.current) return;
    if (!window.confirm(`Gửi ${detail.question.code} Version ${detail.draftVersion.versionNumber} vào review queue? Snapshot sẽ chuyển sang read-only.`)) return;
    setWorkflowBusy(true);
    setCreateError(null);
    setWorkflowNotice(null);
    const slot = `submit:${etagRef.current}`;
    workflowKeysRef.current[slot] ??= createIdempotencyKey();
    try {
      if (autosave.dirty) await autosave.saveNow();
      const result = await questionBankApi.submitReview(
        questionId,
        etagRef.current,
        workflowKeysRef.current[slot]
      );
      const nextEtag = result.etag ?? createVersionEtag(result.data);
      etagRef.current = nextEtag;
      setEtag(nextEtag);
      setDetail((current) => current ? { ...current, draftVersion: result.data } : current);
      setWorkflowNotice('Đã gửi Draft vào review queue.');
    } catch (caught) {
      const apiError = caught as ApiError;
      setCreateError(apiError.status === 409
        ? `${apiError.message} Hãy tải lại revision mới nhất.`
        : apiError.message || 'Không thể gửi review.');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleLifecycle = async (action: 'retire' | 'restore') => {
    if (!questionId || !detail || lifecycleReason.trim().length < 3) {
      setCreateError('Hãy nhập lý do lifecycle (ít nhất 3 ký tự).');
      return;
    }
    const label = action === 'retire' ? 'retire' : 'restore';
    if (!window.confirm(`Xác nhận ${label} ${detail.question.code}? Không có dữ liệu nào bị xóa.`)) return;
    setWorkflowBusy(true);
    setCreateError(null);
    setWorkflowNotice(null);
    const aggregateEtag = createQuestionEtag(detail.question);
    const slot = `${action}:${aggregateEtag}`;
    workflowKeysRef.current[slot] ??= createIdempotencyKey();
    try {
      const result = await questionBankApi.transitionLifecycle(
        questionId,
        action,
        lifecycleReason.trim(),
        aggregateEtag,
        workflowKeysRef.current[slot]
      );
      setDetail(result.data);
      setLifecycleReason('');
      setWorkflowNotice(action === 'retire' ? 'Câu hỏi đã được retire.' : 'Câu hỏi đã được restore.');
    } catch (caught) {
      const apiError = caught as ApiError;
      setCreateError(apiError.status === 409
        ? `${apiError.message} Hãy tải lại trước khi thử lại.`
        : apiError.message || `Không thể ${label} câu hỏi.`);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const loadServerCopy = () => {
    const serverDraft = conflict?.server?.draftVersion;
    if (!serverDraft) return;
    const serverInput = toVersionInput(serverDraft);
    setDraft(serverInput);
    const nextEtag = conflict?.serverEtag ?? createVersionEtag(serverDraft);
    setEtag(nextEtag);
    etagRef.current = nextEtag;
    setDetail(conflict.server);
    setConflict(null);
    setValidationErrors({});
    autosave.markSaved(serverInput);
  };

  const copyLocalDraft = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setCopyMessage('Đã sao chép bản local vào clipboard theo yêu cầu của bạn.');
    } catch {
      setCopyMessage('Trình duyệt không cho phép sao chép. Dữ liệu local vẫn được giữ nguyên trên form.');
    }
  };

  if (loading) return <main className="p-12 text-center" role="status" aria-live="polite">Đang tải Question Editor…</main>;
  if (loadError) return <main className="p-12 text-center" role="alert"><p className="font-bold text-red-700">{loadError}</p><button className="mt-4 rounded-lg border px-4 py-2" onClick={() => void loadQuestion()} type="button">Thử lại</button></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm font-bold text-indigo-700 hover:underline" to="/admin/question-bank">← Ngân hàng câu hỏi</Link>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">{isNew ? 'Tạo Draft mới' : `${detail?.question.code ?? 'Question'} · Version ${activeVersion?.versionNumber ?? '—'}`}</h1>
            {!isNew && <p className="mt-1 text-sm text-slate-600">Revision {activeVersion?.revision ?? '—'} · ETag {etag ?? 'không khả dụng'}</p>}
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
                {isCreatingVersion ? 'Đang tạo Draft…' : 'Tạo Draft từ bản Published'}
              </button>
            )}
            {!requestedEdit && !isNew && detail?.draftVersion && <Link className="rounded-lg border border-indigo-300 px-4 py-2 font-bold text-indigo-700" to={`/admin/question-bank/questions/${questionId}/edit`}>Chỉnh sửa Draft</Link>}
            {!isNew && detail?.draftVersion?.status === 'DRAFT' && (
              <button
                className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                disabled={workflowBusy}
                onClick={() => setIsTranslationOpen(true)}
                type="button"
              >
                AI Translate
              </button>
            )}
            {editable && <button className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white disabled:opacity-50" disabled={isCreating || autosave.status === 'saving' || autosave.status === 'conflict'} onClick={() => void handleSave()} type="button">{isCreating ? 'Đang tạo…' : autosave.status === 'saving' ? 'Đang lưu…' : 'Lưu ngay'}</button>}
            {!isNew && detail?.draftVersion?.status === 'DRAFT' && <button className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={workflowBusy || autosave.status === 'saving' || autosave.status === 'conflict'} onClick={() => void handleSubmitReview()} type="button">{workflowBusy ? 'Đang xử lý…' : 'Gửi review'}</button>}
          </div>
        </header>

        {!isNew && detail && (
          <section className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="lifecycle-heading">
            <h2 className="font-extrabold" id="lifecycle-heading">Lifecycle</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="min-w-64 flex-1 text-sm font-bold">Lý do
                <input className={inputClass} maxLength={5000} onChange={(event) => setLifecycleReason(event.target.value)} value={lifecycleReason} />
              </label>
              {detail.question.lifecycleStatus === 'ACTIVE'
                ? <button className="rounded-lg bg-slate-800 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={workflowBusy} onClick={() => void handleLifecycle('retire')} type="button">Retire</button>
                : <button className="rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={workflowBusy} onClick={() => void handleLifecycle('restore')} type="button">Restore</button>}
            </div>
          </section>
        )}
        {workflowNotice && <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-bold text-emerald-800" aria-live="polite">{workflowNotice}</p>}

        {requestedEdit && !detail?.draftVersion && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-900" role="alert">Không có active Draft. Published/Superseded là immutable trong Phase 1.</p>}
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
              <button className="rounded-lg border border-red-300 bg-white px-4 py-2 font-bold" onClick={() => void copyLocalDraft()} type="button">Sao chép bản local</button>
              <button className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={!conflict.server?.draftVersion} onClick={loadServerCopy} type="button">Bỏ bản local và nạp bản server</button>
            </div>
            {copyMessage && <p aria-live="polite" className="mt-2 text-sm">{copyMessage}</p>}
          </section>
        )}

        <fieldset className={sectionClass} disabled={!editable}>
          <legend className="px-1 text-xl font-extrabold text-slate-900">Content</legend>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <TextArea label="Prompt tiếng Việt" maxLength={5_000} value={draft.content.prompt.vi} onChange={(vi) => changeDraft((current) => ({ ...current, content: { ...current.content, prompt: { ...current.content.prompt, vi } } }))} />
            <TextArea label="Prompt English" maxLength={5_000} value={draft.content.prompt.en} onChange={(en) => changeDraft((current) => ({ ...current, content: { ...current.content, prompt: { ...current.content.prompt, en } } }))} />
            <TextArea label="Giải thích tiếng Việt (tùy chọn)" maxLength={5_000} value={draft.content.explanation?.vi ?? ''} onChange={(vi) => changeDraft((current) => ({ ...current, content: { ...current.content, explanation: { vi, en: current.content.explanation?.en ?? '' } } }))} />
            <TextArea label="Explanation English (optional)" maxLength={5_000} value={draft.content.explanation?.en ?? ''} onChange={(en) => changeDraft((current) => ({ ...current, content: { ...current.content, explanation: { vi: current.content.explanation?.vi ?? '', en } } }))} />
          </div>
        </fieldset>

        <fieldset className={sectionClass} disabled={!editable}>
          <legend className="px-1 text-xl font-extrabold text-slate-900">Classification</legend>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Primary role ID" value={draft.classification.primaryRoleId ?? ''} onChange={(primaryRoleId) => changeDraft((current) => ({ ...current, classification: { ...current.classification, primaryRoleId: primaryRoleId.trim() || null } }))} />
            <Field label="Additional role IDs (phân cách bằng dấu phẩy)" value={draft.classification.additionalRoleIds.join(', ')} onChange={(value) => changeDraft((current) => ({ ...current, classification: { ...current.classification, additionalRoleIds: splitIds(value) } }))} />
            <Field label="Level IDs (phân cách bằng dấu phẩy)" value={draft.classification.levelIds.join(', ')} onChange={(value) => changeDraft((current) => ({ ...current, classification: { ...current.classification, levelIds: splitIds(value) } }))} />
            <Field label="Technologies: ObjectId:relevance (phân cách bằng dấu phẩy)" value={formatTechnologies(draft.classification.technologies)} onChange={(value) => changeDraft((current) => ({ ...current, classification: { ...current.classification, technologies: parseTechnologies(value) } }))} />
            <Field label="Topic" value={draft.classification.topic ?? ''} onChange={(topic) => changeDraft((current) => ({ ...current, classification: { ...current.classification, topic: topic || null } }))} />
            <Field label="Tags kebab-case (phân cách bằng dấu phẩy)" value={draft.classification.tags.join(', ')} onChange={(value) => changeDraft((current) => ({ ...current, classification: { ...current.classification, tags: splitIds(value.toLowerCase()) } }))} />
            <SelectField label="Độ khó" options={[...DIFFICULTIES]} value={draft.classification.difficulty ?? ''} onChange={(difficulty) => changeDraft((current) => ({ ...current, classification: { ...current.classification, difficulty: difficulty || null } }))} />
            <SelectField label="Loại câu hỏi" options={[...QUESTION_TYPES]} value={draft.classification.type ?? ''} onChange={(type) => changeDraft((current) => ({ ...current, classification: { ...current.classification, type: type || null } }))} />
            <label className="flex items-center gap-2 font-semibold"><input checked={draft.classification.technologyAgnostic} onChange={(event) => changeDraft((current) => ({ ...current, classification: { ...current.classification, technologyAgnostic: event.target.checked } }))} type="checkbox" /> Technology-agnostic</label>
            <label className="flex items-center gap-2 font-semibold"><input checked={draft.classification.classificationComplete} onChange={(event) => changeDraft((current) => ({ ...current, classification: { ...current.classification, classificationComplete: event.target.checked } }))} type="checkbox" /> Đánh dấu classification hoàn tất</label>
          </div>
        </fieldset>

        <fieldset className={sectionClass} disabled={!editable}>
          <legend className="px-1 text-xl font-extrabold text-slate-900">Answer &amp; Rubric</legend>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <TextArea label="Reference answer VI" maxLength={20_000} value={draft.answer.referenceAnswer.vi} onChange={(vi) => changeDraft((current) => ({ ...current, answer: { ...current.answer, referenceAnswer: { ...current.answer.referenceAnswer, vi } } }))} />
            <TextArea label="Reference answer EN" maxLength={20_000} value={draft.answer.referenceAnswer.en} onChange={(en) => changeDraft((current) => ({ ...current, answer: { ...current.answer, referenceAnswer: { ...current.answer.referenceAnswer, en } } }))} />
            <TextArea label="Learning objective VI" maxLength={1_000} value={draft.answer.learningObjective.vi} onChange={(vi) => changeDraft((current) => ({ ...current, answer: { ...current.answer, learningObjective: { ...current.answer.learningObjective, vi } } }))} />
            <TextArea label="Learning objective EN" maxLength={1_000} value={draft.answer.learningObjective.en} onChange={(en) => changeDraft((current) => ({ ...current, answer: { ...current.answer, learningObjective: { ...current.answer.learningObjective, en } } }))} />
            <label className="text-sm font-semibold text-slate-700">Thời gian dự kiến (giây)
              <input className={inputClass} max={3600} min={30} onChange={(event) => changeDraft((current) => ({ ...current, answer: { ...current.answer, estimatedTimeSeconds: event.target.value ? Number(event.target.value) : null } }))} type="number" value={draft.answer.estimatedTimeSeconds ?? ''} />
            </label>
          </div>
          <div className="mt-5 space-y-3">
            <h3 className="font-extrabold text-slate-900">Follow-up questions ({draft.answer.followUps.length}/5)</h3>
            {draft.answer.followUps.map((followUp, index) => (
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]" key={index}>
                <Field label={`Follow-up ${index + 1} VI`} value={followUp.vi} onChange={(vi) => changeDraft((current) => ({ ...current, answer: { ...current.answer, followUps: current.answer.followUps.map((item, itemIndex) => itemIndex === index ? { ...item, vi } : item) } }))} />
                <Field label={`Follow-up ${index + 1} EN`} value={followUp.en} onChange={(en) => changeDraft((current) => ({ ...current, answer: { ...current.answer, followUps: current.answer.followUps.map((item, itemIndex) => itemIndex === index ? { ...item, en } : item) } }))} />
                {editable && <button className="self-end rounded-lg border border-red-200 px-3 py-2 font-bold text-red-700" onClick={() => changeDraft((current) => ({ ...current, answer: { ...current.answer, followUps: current.answer.followUps.filter((_, itemIndex) => itemIndex !== index) } }))} type="button">Xóa</button>}
              </div>
            ))}
            {editable && <button className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40" disabled={draft.answer.followUps.length >= 5} onClick={() => changeDraft((current) => ({ ...current, answer: { ...current.answer, followUps: [...current.answer.followUps, { vi: '', en: '' }] } }))} type="button">Thêm follow-up</button>}
          </div>
          <div className="mt-6"><RubricEditor disabled={!editable} onChange={(rubric) => changeDraft((current) => ({ ...current, rubric }))} value={draft.rubric} /></div>
        </fieldset>

        <section className={sectionClass}>
          <TextArea disabled={!editable} label="Change summary (tối đa 1.000 ký tự)" maxLength={1_000} value={draft.changeSummary} onChange={(changeSummary) => changeDraft((current) => ({ ...current, changeSummary }))} />
        </section>
        <SemanticDuplicatePanel
          questionId={questionId}
          versionNumber={activeVersion?.versionNumber}
          draft={draft}
        />
        <CandidatePreview classification={draft.classification} prompt={draft.content.prompt} />
        {!isNew && questionId && <VersionHistory questionId={questionId} />}

        {detail?.draftVersion && questionId && (
          <TranslationModal
            isOpen={isTranslationOpen}
            onClose={() => setIsTranslationOpen(false)}
            questionId={questionId}
            versionNumber={detail.draftVersion.versionNumber}
            currentDraft={draft}
            etag={etag}
            onApplied={(updated, newEtag) => {
              const nextInput = toVersionInput(updated);
              setDraft(nextInput);
              setEtag(newEtag);
              etagRef.current = newEtag;
              setDetail((curr) => (curr ? { ...curr, draftVersion: updated } : curr));
              setWorkflowNotice('Đã áp dụng bản dịch thành công.');
              autosave.markSaved(nextInput);
            }}
          />
        )}
      </div>
    </main>
  );
};

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="text-sm font-semibold text-slate-700">{label}<input className={inputClass} onChange={(event) => onChange(event.target.value)} value={value} /></label>
);

const TextArea = ({ label, value, onChange, maxLength, disabled = false }: { label: string; value: string; onChange: (value: string) => void; maxLength: number; disabled?: boolean }) => (
  <label className="text-sm font-semibold text-slate-700">{label}<textarea className={`${inputClass} min-h-28`} disabled={disabled} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} value={value} /></label>
);

const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) => (
  <label className="text-sm font-semibold text-slate-700">{label}<select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}><option value="">Chưa chọn</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
);
