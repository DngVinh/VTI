import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiError } from '../../../auth/types';
import { createIdempotencyKey, createQuestionSummaryEtag, questionBankApi } from '../api/questionBankApi';
import { QuestionBankNav } from '../components/QuestionBankNav';
import { QuestionBankFilters } from '../components/QuestionBankFilters';
import { QuestionBankTable } from '../components/QuestionBankTable';
import { useQuestionBankList } from '../hooks/useQuestionBankList';
import type { QuestionSummaryDto } from '../types';
import { AppShell } from '../../../layouts/AppShell';

export const QuestionBankListPage = () => {
  const state = useQuestionBankList();
  const [lifecycleBusyId, setLifecycleBusyId] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const isEmptyDatabase = !state.isLoading && !state.error && state.pagination.total === 0 && !state.hasActiveFilters;
  const hasNoMatches = !state.isLoading && !state.error && state.pagination.total === 0 && state.hasActiveFilters;

  const handleLifecycleChange = async (question: QuestionSummaryDto) => {
    const action = question.lifecycleStatus === 'ACTIVE' ? 'retire' : 'restore';
    const label = action === 'retire' ? 'ẩn khỏi thư viện' : 'khôi phục';
    if (action === 'retire' && !window.confirm(`Ẩn ${question.code} khỏi thư viện? Dữ liệu vẫn được giữ trong Admin QB.`)) return;

    setLifecycleBusyId(question.id);
    setLifecycleError(null);
    try {
      await questionBankApi.transitionLifecycle(
        question.id,
        action,
        action === 'retire'
          ? `Admin ẩn ${question.code} khỏi thư viện`
          : `Admin khôi phục ${question.code} vào thư viện`,
        createQuestionSummaryEtag(question),
        createIdempotencyKey()
      );
      await state.retry();
    } catch (caught) {
      const error = caught as ApiError;
      setLifecycleError(error.message || `Không thể ${label} câu hỏi.`);
    } finally {
      setLifecycleBusyId(null);
    }
  };

  return (
    <AppShell>
      <main className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Admin · Question Bank</p>
              <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Quản lý câu hỏi</h1>
              <p className="mt-2 max-w-2xl text-slate-600">Tìm, mở và chỉnh sửa câu hỏi trong một màn hình gọn gàng.</p>
            </div>
            <Link className="rounded-xl bg-indigo-600 px-5 py-3 text-center font-bold text-white shadow-sm hover:bg-indigo-700" to="/admin/question-bank/questions/new">＋ Tạo câu hỏi mới</Link>
          </header>

          <QuestionBankNav />

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <QuestionBankFilters query={state.query} search={state.searchInput} onSearchChange={state.setSearchInput} onChange={state.setQueryValue} />
            {lifecycleError && <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700" role="alert">{lifecycleError}</div>}

            {state.isLoading && <p className="p-8 text-center text-slate-500" role="status">Đang tải câu hỏi…</p>}
            {!state.isLoading && state.error && (
              <div className="p-8 text-center" role="alert">
                <p className="font-semibold text-red-700">{state.error}</p>
                <button className="mt-3 rounded-lg bg-red-100 px-4 py-2 font-bold text-red-800" onClick={state.retry} type="button">Thử lại</button>
              </div>
            )}

            {isEmptyDatabase && <EmptyState title="Chưa có câu hỏi nào" detail="Tạo câu hỏi đầu tiên để bắt đầu xây dựng ngân hàng." />}
            {hasNoMatches && <EmptyState title="Không tìm thấy kết quả" detail="Hãy thay đổi từ khóa hoặc bộ lọc hiện tại." />}
            {!state.isLoading && !state.error && state.items.length > 0 && (
              <QuestionBankTable
                items={state.items}
                onLifecycleChange={handleLifecycleChange}
                busyQuestionId={lifecycleBusyId}
              />
            )}
            {!state.isLoading && !state.error && state.pagination.total > 0 && (
              <nav aria-label="Phân trang câu hỏi" className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
                <p className="text-sm text-slate-600">{state.pagination.total} câu hỏi · Trang {state.pagination.page}/{Math.max(1, state.pagination.totalPages)}</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-40" disabled={state.isLoading || state.pagination.page <= 1} onClick={() => state.setQueryValue('page', String(state.pagination.page - 1), false)} type="button">Trang trước</button>
                  <button className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-40" disabled={state.isLoading || state.pagination.page >= state.pagination.totalPages} onClick={() => state.setQueryValue('page', String(state.pagination.page + 1), false)} type="button">Trang sau</button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
};

const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
  <section className="p-12 text-center">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-600">{detail}</p>
  </section>
);
