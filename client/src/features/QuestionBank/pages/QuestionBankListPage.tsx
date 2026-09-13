import { Link } from 'react-router-dom';
import { QuestionBankNav } from '../components/QuestionBankNav';
import { QuestionBankFilters } from '../components/QuestionBankFilters';
import { QuestionBankTable } from '../components/QuestionBankTable';
import { useQuestionBankList } from '../hooks/useQuestionBankList';

export const QuestionBankListPage = () => {
  const state = useQuestionBankList();
  const isEmptyDatabase = !state.isLoading && !state.error && state.pagination.total === 0 && !state.hasActiveFilters;
  const hasNoMatches = !state.isLoading && !state.error && state.pagination.total === 0 && state.hasActiveFilters;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Admin · Question Bank</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Ngân hàng câu hỏi</h1>
            <p className="mt-2 text-slate-600">Quản lý câu hỏi, phiên bản, quy trình review 4-eyes, mô phỏng tuyển chọn và báo cáo phân tích.</p>
          </div>
          <Link className="rounded-xl bg-indigo-600 px-5 py-3 text-center font-bold text-white hover:bg-indigo-700" to="/admin/question-bank/questions/new">Tạo Draft mới</Link>
        </header>

        <QuestionBankNav />

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <QuestionBankFilters query={state.query} search={state.searchInput} onSearchChange={state.setSearchInput} onChange={state.setQueryValue} />
          {state.isLoading && <div aria-live="polite" className="p-12 text-center font-semibold text-slate-600" role="status">Đang tải danh sách câu hỏi…</div>}
          {state.error && (
            <div className="p-12 text-center" role="alert">
              <p className="font-semibold text-red-700">{state.error}</p>
              <button className="mt-4 rounded-lg border border-slate-300 px-4 py-2 font-bold" onClick={state.retry} type="button">Thử lại</button>
            </div>
          )}
          {isEmptyDatabase && <EmptyState title="Chưa có câu hỏi nào" detail="Tạo Draft đầu tiên để bắt đầu xây dựng ngân hàng câu hỏi." />}
          {hasNoMatches && <EmptyState title="Không tìm thấy kết quả" detail="Hãy thay đổi từ khóa hoặc bộ lọc hiện tại." />}
          {!state.isLoading && !state.error && state.items.length > 0 && <QuestionBankTable items={state.items} />}
          {!state.isLoading && !state.error && state.pagination.total > 0 && (
            <nav aria-label="Phân trang câu hỏi" className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-600">Trang {state.pagination.page}/{Math.max(1, state.pagination.totalPages)} · {state.pagination.total} câu hỏi</p>
              <div className="flex gap-2">
                <button className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-40" disabled={state.isLoading || state.pagination.page <= 1} onClick={() => state.setQueryValue('page', String(state.pagination.page - 1), false)} type="button">Trang trước</button>
                <button className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-40" disabled={state.isLoading || state.pagination.page >= state.pagination.totalPages} onClick={() => state.setQueryValue('page', String(state.pagination.page + 1), false)} type="button">Trang sau</button>
              </div>
            </nav>
          )}
        </div>
      </div>
    </main>
  );
};

const EmptyState = ({ title, detail }: { title: string; detail: string }) => (
  <section className="p-12 text-center">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-600">{detail}</p>
  </section>
);

