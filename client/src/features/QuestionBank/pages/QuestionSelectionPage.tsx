import { useState } from 'react';
import { QuestionBankNav } from '../components/QuestionBankNav';
import { questionBankApi } from '../api/questionBankApi';
import type { QuestionSelectionResult, Difficulty, QuestionType } from '../types';
import { enumLabel } from '../components/enumLabels';

export const QuestionSelectionPage = () => {
  const [count, setCount] = useState<number>(5);
  const [seed, setSeed] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionSelectionResult | null>(null);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await questionBankApi.selectQuestions({
        count: Number(count),
        seed: seed ? Number(seed) : undefined,
        difficulty: (difficulty || undefined) as Difficulty | undefined,
        type: (type || undefined) as QuestionType | undefined,
      });
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi thực hiện mô phỏng tuyển chọn';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Admin · Question Bank</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Mô phỏng tuyển chọn câu hỏi</h1>
          <p className="mt-2 text-slate-600">
            Kiểm tra thuật toán chọn lọc câu hỏi ngẫu nhiên tất định (Mulberry32 PRNG) và chẩn đoán độ sẵn sàng của pool câu hỏi.
          </p>
        </header>

        <QuestionBankNav />

        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <span className="font-bold">Ranh giới độc lập (Isolation Guarantee):</span> Tính năng này là công cụ mô phỏng tuyển chọn độc lập dành cho Quản trị viên, tuyệt đối không can thiệp hay thay thế luồng runtime tạo 5 câu hỏi hiện hữu của ứng viên.
        </div>

        <form onSubmit={handleSimulate} className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Tham số mô phỏng</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="select-count" className="block text-sm font-medium text-slate-700">Số lượng câu hỏi (1-50)</label>
              <input
                id="select-count"
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="select-seed" className="block text-sm font-medium text-slate-700">Seed PRNG (Tùy chọn)</label>
              <input
                id="select-seed"
                type="number"
                placeholder="vd: 42 (để kết quả tái lặp)"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="select-difficulty" className="block text-sm font-medium text-slate-700">Độ khó</label>
              <select
                id="select-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Tất cả độ khó</option>
                <option value="EASY">Dễ (Easy)</option>
                <option value="MEDIUM">Trung bình (Medium)</option>
                <option value="HARD">Khó (Hard)</option>
              </select>
            </div>
            <div>
              <label htmlFor="select-type" className="block text-sm font-medium text-slate-700">Loại câu hỏi</label>
              <select
                id="select-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Tất cả loại</option>
                <option value="TECHNICAL">Kỹ thuật</option>
                <option value="BEHAVIORAL">Hành vi</option>
                <option value="SYSTEM_DESIGN">Thiết kế hệ thống</option>
                <option value="CODING">Lập trình</option>
                <option value="SCENARIO">Tình huống</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Đang chạy mô phỏng…' : 'Chạy mô phỏng tuyển chọn'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p className="font-semibold">Lỗi tuyển chọn:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Chẩn đoán độ đầy đủ của pool (Diagnostics)</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Yêu cầu</p>
                  <p className="text-2xl font-black text-slate-900">{result.diagnostics.requestedCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Khả dụng trong pool</p>
                  <p className="text-2xl font-black text-slate-900">{result.diagnostics.availableCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Đã chọn thực tế</p>
                  <p className="text-2xl font-black text-slate-900">{result.diagnostics.selectedCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Trạng thái Pool</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    result.diagnostics.isPoolSufficient ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {result.diagnostics.isPoolSufficient ? 'Đủ điều kiện' : 'Thiếu câu hỏi'}
                  </span>
                </div>
              </div>
              {result.diagnostics.insufficientReason && (
                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <span className="font-semibold">Lý do thiếu câu hỏi: </span>
                  {result.diagnostics.insufficientReason}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                Danh sách câu hỏi được chọn ({result.selected.length})
              </h2>
              {result.selected.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Không có câu hỏi nào thỏa mãn tiêu chí tuyển chọn.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {result.selected.map((item, idx) => (
                    <div key={item.id} className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-sm font-bold text-indigo-600">{item.code}</span>
                          <span className="text-xs text-slate-400">v{item.versionNumber}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {enumLabel(item.type)}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {enumLabel(item.difficulty)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900">{item.prompt.vi || item.prompt.en}</p>
                      {item.prompt.en && item.prompt.vi && (
                        <p className="mt-1 text-xs text-slate-500 italic">{item.prompt.en}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
