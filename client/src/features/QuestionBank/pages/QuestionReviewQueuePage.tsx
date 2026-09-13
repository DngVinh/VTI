import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiError } from '../../../auth/types';
import { questionBankApi } from '../api/questionBankApi';
import type { QuestionReviewQueueItemDto, ReviewQueueResponse } from '../types';
import { QuestionBankNav } from '../components/QuestionBankNav';

const emptyResult: ReviewQueueResponse = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

export const QuestionReviewQueuePage = () => {
  const [status, setStatus] = useState<'' | 'IN_REVIEW' | 'APPROVED'>('');
  const [result, setResult] = useState<ReviewQueueResponse>(emptyResult);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    await Promise.resolve();
    if (signal.aborted) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await questionBankApi.listReviews({
        page: 1,
        limit: 20,
        ...(status ? { status } : {}),
      }, signal));
    } catch (caught) {
      if (!signal.aborted) {
        setError((caught as ApiError).message || 'Không thể tải review queue.');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [load, retryKey]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link className="font-bold text-indigo-700 hover:underline" to="/admin/question-bank">← Question Bank</Link>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Review queue</h1>
            <p className="mt-1 text-slate-600">Snapshot trong danh sách chỉ hiển thị tóm tắt an toàn.</p>
          </div>
          <label className="text-sm font-bold text-slate-700">
            Trạng thái
            <select
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
              onChange={(event) => setStatus(event.target.value as typeof status)}
              value={status}
            >
              <option value="">Tất cả</option>
              <option value="IN_REVIEW">Đang review</option>
              <option value="APPROVED">Đã duyệt</option>
            </select>
          </label>
        </header>

        <QuestionBankNav />

        {loading && <p aria-live="polite" role="status">Đang tải review queue…</p>}
        {error && (
          <section className="rounded-xl border border-red-300 bg-red-50 p-4" role="alert">
            <p className="font-bold text-red-800">{error}</p>
            <button className="mt-3 rounded-lg border bg-white px-4 py-2 font-bold" onClick={() => setRetryKey((value) => value + 1)} type="button">Thử lại</button>
          </section>
        )}
        {!loading && !error && result.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Không có snapshot phù hợp.</p>
        )}
        {!loading && !error && result.items.length > 0 && (
          <ul className="space-y-3">
            {result.items.map((item: QuestionReviewQueueItemDto) => (
              <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-extrabold text-slate-950">{item.code} · Version {item.versionNumber}</p>
                    <p className="mt-1 text-sm font-semibold text-indigo-700">{item.status}</p>
                    <p className="mt-3 whitespace-pre-wrap text-slate-700">{item.promptPreview.vi || item.promptPreview.en || 'Chưa có prompt'}</p>
                  </div>
                  <Link className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white" to={`/admin/question-bank/reviews/${item.id}`}>Mở review</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};
