import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '../../../auth/authStore';
import type { ApiError } from '../../../auth/types';
import { questionBankApi, createIdempotencyKey, createVersionEtag } from '../api/questionBankApi';
import { hasQuestionBankCapability } from '../capabilities';
import type { QuestionReviewDetailDto } from '../types';
import { AppShell } from '../../../layouts/AppShell';

export const QuestionReviewDetailPage = () => {
  const { questionVersionId } = useParams();
  const role = useAuthStore((state) => state.user?.role);
  const [detail, setDetail] = useState<QuestionReviewDetailDto | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const keys = useRef<Record<string, string>>({});

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!questionVersionId) return;
    await Promise.resolve();
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const result = await questionBankApi.getReview(questionVersionId, signal);
      setDetail(result.data);
      setEtag(result.etag ?? createVersionEtag(result.data.snapshot));
      setConflict(false);
    } catch (caught) {
      if (!signal?.aborted) setError((caught as ApiError).message || 'Không thể tải review.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [questionVersionId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [load]);

  const mutate = async (action: 'APPROVE' | 'REQUEST_CHANGES' | 'PUBLISH') => {
    if (!detail || !etag || !questionVersionId) return;
    if (action === 'REQUEST_CHANGES' && reason.trim().length < 3) {
      setError('Hãy nhập lý do yêu cầu chỉnh sửa (ít nhất 3 ký tự).');
      return;
    }
    const label = action === 'APPROVE' ? 'phê duyệt' : action === 'PUBLISH' ? 'xuất bản' : 'trả về Draft';
    if (!window.confirm(`Xác nhận ${label} snapshot Version ${detail.snapshot.versionNumber}?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const keySlot = `${action}:${etag}`;
    keys.current[keySlot] ??= createIdempotencyKey();
    try {
      if (action === 'PUBLISH') {
        await questionBankApi.publishVersion(
          detail.question.id,
          detail.snapshot.versionNumber,
          etag,
          keys.current[keySlot],
          reason.trim() || undefined
        );
        setNotice('Snapshot đã được xuất bản.');
      } else {
        const result = await questionBankApi.decideReview(
          questionVersionId,
          action,
          reason.trim() || undefined,
          etag,
          keys.current[keySlot]
        );
        setDetail(result.data);
        setEtag(result.etag ?? createVersionEtag(result.data.snapshot));
        setNotice(action === 'APPROVE' ? 'Snapshot đã được phê duyệt.' : 'Snapshot đã được trả về Draft.');
      }
      setReason('');
      await load();
    } catch (caught) {
      const apiError = caught as ApiError;
      setConflict(apiError.status === 409);
      setError(apiError.message || 'Không thể hoàn tất quyết định.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="p-12 text-center" aria-live="polite" role="status">Đang tải review…</main>;
  if (!detail || error && !etag) return <main className="p-12 text-center" role="alert"><p>{error || 'Không tìm thấy review.'}</p><button className="mt-4 rounded-lg border px-4 py-2" onClick={() => void load()} type="button">Thử lại</button></main>;

  const canReview = hasQuestionBankCapability(role, 'QUESTION_REVIEW');
  const canPublish = hasQuestionBankCapability(role, 'QUESTION_PUBLISH');
  const actions = detail.allowedActions;

  return (
    <AppShell>
      <main className="px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link className="font-bold text-indigo-700 hover:underline" to="/admin/question-bank/reviews">← Review queue</Link>
          <h1 className="mt-2 text-3xl font-extrabold">{detail.question.code} · Version {detail.snapshot.versionNumber}</h1>
          <p className="mt-1 text-slate-600">Snapshot read-only · {detail.snapshot.status} · revision {detail.snapshot.revision}</p>
        </header>

        {detail.completenessErrors.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" aria-labelledby="completeness-heading">
            <h2 className="font-extrabold text-amber-950" id="completeness-heading">Completeness gate chưa đạt</h2>
            <ul className="mt-2 list-disc pl-5">{detail.completenessErrors.map((item) => <li key={`${item.field}:${item.message}`}><strong>{item.field}:</strong> {item.message}</li>)}</ul>
          </section>
        )}
        {error && <p className="rounded-xl border border-red-300 bg-red-50 p-4 font-bold text-red-800" role="alert">{error}</p>}
        {conflict && <button className="rounded-lg border px-4 py-2 font-bold" onClick={() => void load()} type="button">Tải revision mới nhất</button>}
        <p aria-live="polite" className="font-semibold text-emerald-700">{notice}</p>

        <section className="rounded-2xl border bg-white p-6" aria-labelledby="snapshot-heading">
          <h2 className="text-xl font-extrabold" id="snapshot-heading">Snapshot nội dung</h2>
          <p className="mt-4 whitespace-pre-wrap"><strong>Prompt VI:</strong> {detail.snapshot.content.prompt.vi || '—'}</p>
          <p className="mt-3 whitespace-pre-wrap"><strong>Prompt EN:</strong> {detail.snapshot.content.prompt.en || '—'}</p>
          <p className="mt-5 whitespace-pre-wrap"><strong>Reference answer VI:</strong> {detail.snapshot.answer.referenceAnswer.vi || '—'}</p>
          <p className="mt-3 whitespace-pre-wrap"><strong>Reference answer EN:</strong> {detail.snapshot.answer.referenceAnswer.en || '—'}</p>
          <h3 className="mt-5 font-extrabold">Rubric ({detail.snapshot.rubric.length})</h3>
          <ul className="mt-2 list-disc pl-5">{detail.snapshot.rubric.map((criterion) => <li key={criterion.key}>{criterion.title.vi || criterion.title.en || criterion.key} · {criterion.weight}%</li>)}</ul>
        </section>

        <section className="rounded-2xl border bg-white p-6" aria-labelledby="decision-heading">
          <h2 className="text-xl font-extrabold" id="decision-heading">Quyết định</h2>
          <label className="mt-4 block text-sm font-bold">Lý do / ghi chú
            <textarea className="mt-1 min-h-24 w-full rounded-lg border p-3" maxLength={5000} onChange={(event) => setReason(event.target.value)} value={reason} />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            {canReview && actions.includes('APPROVE') && <button className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy || detail.completenessErrors.length > 0} onClick={() => void mutate('APPROVE')} type="button">{busy ? 'Đang xử lý…' : 'Approve'}</button>}
            {canReview && actions.includes('REQUEST_CHANGES') && <button className="rounded-lg bg-amber-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => void mutate('REQUEST_CHANGES')} type="button">Request changes</button>}
            {canPublish && actions.includes('PUBLISH') && <button className="rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy || detail.completenessErrors.length > 0} onClick={() => void mutate('PUBLISH')} type="button">Publish</button>}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6" aria-labelledby="history-heading">
          <h2 className="text-xl font-extrabold" id="history-heading">Lịch sử quyết định</h2>
          {detail.history.length === 0 ? <p className="mt-3 text-slate-600">Chưa có quyết định.</p> : (
            <ol className="mt-3 space-y-3">{detail.history.map((item) => <li className="border-l-4 border-indigo-200 pl-3" key={item.id}><strong>{item.action}</strong> · {item.fromState} → {item.toState}<br /><span className="text-sm text-slate-600">{item.reason || 'Không có ghi chú'} · {new Date(item.createdAt).toLocaleString('vi-VN')}</span></li>)}</ol>
          )}
        </section>
      </div>
    </main>
  </AppShell>
);
};
