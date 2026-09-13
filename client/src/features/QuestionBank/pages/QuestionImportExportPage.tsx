import { useState } from 'react';
import { QuestionBankNav } from '../components/QuestionBankNav';
import { questionBankApi, createIdempotencyKey } from '../api/questionBankApi';
import type { QuestionImportResult, QuestionExportResult, ExportFilterInput, QuestionImportInput, VersionStatus, Difficulty } from '../types';

export const QuestionImportExportPage = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  // Import state
  const [importFormat, setImportFormat] = useState<'JSON' | 'CSV'>('JSON');
  const [importDryRun, setImportDryRun] = useState<boolean>(true);
  const [importContent, setImportContent] = useState<string>('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<QuestionImportResult | null>(null);

  // Export state
  const [exportFormat, setExportFormat] = useState<'JSON' | 'CSV'>('JSON');
  const [exportStatus, setExportStatus] = useState<string>('');
  const [exportDifficulty, setExportDifficulty] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<QuestionExportResult | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      let payload: QuestionImportInput;
      if (importFormat === 'JSON') {
        const parsed = JSON.parse(importContent);
        payload = {
          format: 'JSON',
          dryRun: importDryRun,
          items: Array.isArray(parsed) ? parsed : [parsed],
        };
      } else {
        payload = {
          format: 'CSV',
          dryRun: importDryRun,
          csvContent: importContent,
        };
      }

      const res = await questionBankApi.importQuestions(payload, createIdempotencyKey());
      setImportResult(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi thực hiện import';
      setImportError(message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportLoading(true);
    setExportError(null);
    setExportResult(null);

    try {
      const filter: ExportFilterInput = {
        format: exportFormat,
        status: (exportStatus || undefined) as VersionStatus | undefined,
        difficulty: (exportDifficulty || undefined) as Difficulty | undefined,
      };
      const res = await questionBankApi.exportQuestions(filter);
      setExportResult(res);

      if (exportFormat === 'CSV' && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `question-bank-export-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi thực hiện export';
      setExportError(message);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm font-bold uppercase tracking-widest text-indigo-700">Admin · Question Bank</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Nhập & Xuất dữ liệu (Import / Export)</h1>
          <p className="mt-2 text-slate-600">
            Hỗ trợ nhập hàng loạt câu hỏi dưới dạng Bản nháp (Draft - Origin: IMPORTED) và xuất dữ liệu an toàn có chống CSV Formula Injection.
          </p>
        </header>

        <QuestionBankNav />

        {/* Tab switch */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`border-b-2 px-4 py-2 font-bold text-sm transition-colors ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhập dữ liệu (Import)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`border-b-2 px-4 py-2 font-bold text-sm transition-colors ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Xuất dữ liệu (Export)
          </button>
        </div>

        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <span className="font-bold">Quy tắc bảo mật Import:</span> Toàn bộ câu hỏi nhập vào sẽ được gán trạng thái <span className="font-bold">DRAFT</span> với nguồn gốc <span className="font-bold">IMPORTED</span>. Không bao giờ tự động duyệt hoặc publish. Hãy luôn bật chế độ Dry-run để kiểm thử cấu trúc trước khi lưu.
            </div>

            <form onSubmit={handleImport} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                <div>
                  <label htmlFor="import-format" className="block text-sm font-medium text-slate-700">Định dạng tệp</label>
                  <select
                    id="import-format"
                    value={importFormat}
                    onChange={(e) => setImportFormat(e.target.value as 'JSON' | 'CSV')}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="JSON">JSON Array</option>
                    <option value="CSV">CSV (RFC 4180)</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importDryRun}
                      onChange={(e) => setImportDryRun(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Chế độ kiểm thử (Dry Run) — Kiểm tra tính hợp lệ mà không ghi vào CSDL</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="import-content" className="block text-sm font-medium text-slate-700">
                  Nội dung dữ liệu ({importFormat})
                </label>
                <textarea
                  id="import-content"
                  rows={8}
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  placeholder={
                    importFormat === 'JSON'
                      ? '[\n  {\n    "prompt": { "vi": "Câu hỏi mẫu", "en": "Sample question" },\n    "referenceAnswer": { "vi": "Đáp án", "en": "Answer" },\n    "primaryRoleId": "64b000000000000000000001",\n    "levelIds": ["64b000000000000000000002"],\n    "type": "TECHNICAL",\n    "difficulty": "MEDIUM"\n  }\n]'
                      : 'prompt_vi,prompt_en,reference_answer_vi,reference_answer_en,primary_role_id,level_ids,type,difficulty\n"Câu hỏi 1","Question 1","Đáp án 1","Answer 1","64b000000000000000000001","64b000000000000000000002","TECHNICAL","MEDIUM"'
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-3 font-mono text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={importLoading || !importContent.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importLoading ? 'Đang xử lý import…' : importDryRun ? 'Kiểm thử dữ liệu (Dry Run)' : 'Thực hiện Import vào Ngân hàng'}
                </button>
              </div>
            </form>

            {importError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
                <p className="font-semibold">Lỗi import:</p>
                <p className="text-sm">{importError}</p>
              </div>
            )}

            {importResult && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Kết quả Import ({importResult.dryRun ? 'Kiểm thử - Dry Run' : 'Đã lưu CSDL'})</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Tổng số bản ghi</p>
                    <p className="text-2xl font-black text-slate-900">{importResult.totalRecords}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase text-emerald-700">Hợp lệ</p>
                    <p className="text-2xl font-black text-emerald-700">{importResult.validCount}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-xs font-semibold uppercase text-red-700">Lỗi</p>
                    <p className="text-2xl font-black text-red-700">{importResult.invalidCount}</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-bold text-red-800 mb-2">Chi tiết lỗi từng dòng:</h3>
                    <div className="overflow-x-auto rounded-xl border border-red-100 bg-red-50 p-4">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-red-200 font-bold text-red-900">
                            <th className="pb-2">Dòng</th>
                            <th className="pb-2">Trường</th>
                            <th className="pb-2">Nội dung lỗi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                          {importResult.errors.map((err, i) => (
                            <tr key={i}>
                              <td className="py-2 font-bold text-red-900">#{err.row}</td>
                              <td className="py-2 font-mono text-red-700">{err.field || '—'}</td>
                              <td className="py-2 text-red-800">{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importResult.createdQuestions && importResult.createdQuestions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">Câu hỏi đã tạo thành công ({importResult.createdQuestions.length}):</h3>
                    <div className="flex flex-wrap gap-2">
                      {importResult.createdQuestions.map((q) => (
                        <span key={q.id} className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-mono font-bold text-indigo-700">
                          {q.code} (v{q.versionNumber})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <span className="font-bold">Bảo vệ Formula Injection:</span> Tệp CSV xuất ra tự động áp dụng tiền tố bảo vệ dấu nháy đơn (<code className="font-mono">'</code>) cho các ô bắt đầu bằng ký tự công thức (<code className="font-mono">=, +, -, @, \t, \r</code>) để ngăn chặn tấn công thực thi mã khi mở trong Excel/Sheets.
            </div>

            <form onSubmit={handleExport} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
                <div>
                  <label htmlFor="export-format" className="block text-sm font-medium text-slate-700">Định dạng xuất</label>
                  <select
                    id="export-format"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'JSON' | 'CSV')}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="JSON">JSON</option>
                    <option value="CSV">CSV (RFC 4180 có chống Formula Injection)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="export-status" className="block text-sm font-medium text-slate-700">Trạng thái phiên bản</label>
                  <select
                    id="export-status"
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PUBLISHED">Chỉ PUBLISHED</option>
                    <option value="DRAFT">Chỉ DRAFT</option>
                    <option value="APPROVED">Chỉ APPROVED</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="export-diff" className="block text-sm font-medium text-slate-700">Độ khó</label>
                  <select
                    id="export-diff"
                    value={exportDifficulty}
                    onChange={(e) => setExportDifficulty(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Tất cả độ khó</option>
                    <option value="EASY">Dễ</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HARD">Khó</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={exportLoading}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {exportLoading ? 'Đang kết xuất dữ liệu…' : 'Xuất dữ liệu ngay'}
                </button>
              </div>
            </form>

            {exportError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
                <p className="font-semibold">Lỗi export:</p>
                <p className="text-sm">{exportError}</p>
              </div>
            )}

            {exportResult && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-2">Kết quả xuất ({exportResult.count} câu hỏi)</h2>
                {exportResult.format === 'JSON' && exportResult.data && (
                  <pre className="max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
                    {JSON.stringify(exportResult.data, null, 2)}
                  </pre>
                )}
                {exportResult.format === 'CSV' && (
                  <p className="text-sm text-emerald-700 font-semibold">Tệp CSV đã được tự động tải xuống thiết bị của bạn.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
