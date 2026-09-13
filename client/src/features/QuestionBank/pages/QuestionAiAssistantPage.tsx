import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QuestionBankNav } from '../components/QuestionBankNav';
import { questionBankApi, createIdempotencyKey } from '../api/questionBankApi';
import { SemanticDuplicatePanel } from '../components/SemanticDuplicatePanel';
import type { QuestionAiDraftResult, Difficulty, QuestionType } from '../types';
import { enumLabel } from '../components/enumLabels';

export const QuestionAiAssistantPage = () => {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [type, setType] = useState<QuestionType>('TECHNICAL');
  const [language, setLanguage] = useState<'vi' | 'en' | 'both'>('both');
  const [instructions, setInstructions] = useState('');
  const [persistDraft, setPersistDraft] = useState(false);
  const [roleId, setRoleId] = useState('64b000000000000000000001'); // Default placeholder / will be validated
  const [levelId, setLevelId] = useState('64b000000000000000000002');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionAiDraftResult | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await questionBankApi.generateAiDraft(
        {
          topic,
          roleId,
          levelId,
          difficulty,
          type,
          language,
          additionalInstructions: instructions || undefined,
          persistDraft,
        },
        createIdempotencyKey()
      );
      setResult(res.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tạo bản nháp câu hỏi bằng AI';
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
          <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Trợ lý AI tạo bản nháp (AI Assistant)</h1>
          <p className="mt-2 text-slate-600">
            Hỗ trợ Quản trị viên nhanh chóng phác thảo cấu trúc câu hỏi đầy đủ gồm Đề bài, Đáp án chuẩn, Mục tiêu bài học và Rubric chấm điểm.
          </p>
        </header>

        <QuestionBankNav />

        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <span className="font-bold">Nguyên tắc Bất biến (Governance Invariants):</span> Toàn bộ nội dung do AI tạo chỉ dừng lại ở bước <span className="font-bold">Bản nháp (DRAFT)</span> mang nguồn gốc <span className="font-bold">AI_ASSISTED</span>. Hệ thống tuyệt đối <span className="font-bold">không tự động phê duyệt hoặc xuất bản</span>. Quản trị viên phải luôn rà soát nội dung trước khi đưa vào quy trình review 4-eyes.
        </div>

        <form onSubmit={handleGenerate} className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Cấu hình yêu cầu tạo câu hỏi</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
            <div className="sm:col-span-2">
              <label htmlFor="ai-topic" className="block text-sm font-medium text-slate-700">Chủ đề câu hỏi (Topic)</label>
              <input
                id="ai-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="vd: React Server Components, Docker Multi-stage Builds, Microservices Saga..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="ai-lang" className="block text-sm font-medium text-slate-700">Ngôn ngữ tạo</label>
              <select
                id="ai-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'vi' | 'en' | 'both')}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="both">Song ngữ (Việt & Anh)</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">Tiếng Anh</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor="ai-role" className="block text-sm font-medium text-slate-700">Role ID</label>
              <input
                id="ai-role"
                type="text"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                placeholder="24 ký tự hex ObjectId"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="ai-level" className="block text-sm font-medium text-slate-700">Level ID</label>
              <input
                id="ai-level"
                type="text"
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                placeholder="24 ký tự hex ObjectId"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor="ai-diff" className="block text-sm font-medium text-slate-700">Độ khó</label>
              <select
                id="ai-diff"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="EASY">Dễ (Easy)</option>
                <option value="MEDIUM">Trung bình (Medium)</option>
                <option value="HARD">Khó (Hard)</option>
              </select>
            </div>
            <div>
              <label htmlFor="ai-type" className="block text-sm font-medium text-slate-700">Loại câu hỏi</label>
              <select
                id="ai-type"
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="TECHNICAL">Kỹ thuật (Technical)</option>
                <option value="BEHAVIORAL">Hành vi (Behavioral)</option>
                <option value="SYSTEM_DESIGN">Thiết kế hệ thống (System Design)</option>
                <option value="CODING">Lập trình (Coding)</option>
                <option value="SCENARIO">Tình huống (Scenario)</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="ai-instructions" className="block text-sm font-medium text-slate-700">Chỉ dẫn bổ sung (Tùy chọn)</label>
            <textarea
              id="ai-instructions"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="vd: Tập trung hỏi về memory leak và best practices khi xử lý stream dữ liệu lớn..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={persistDraft}
                onChange={(e) => setPersistDraft(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Tự động lưu vào Ngân hàng câu hỏi dưới dạng Bản nháp (DRAFT)</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'AI đang biên soạn bản nháp…' : 'Biên soạn bằng AI'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            <p className="font-semibold">Lỗi AI:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {result.persistedQuestion && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center justify-between">
                <div>
                  <p className="font-bold">Đã lưu bản nháp thành công vào CSDL!</p>
                  <p className="text-sm font-mono mt-1">Mã câu hỏi: {result.persistedQuestion.code} (Phiên bản v{result.persistedQuestion.versionNumber})</p>
                </div>
                <Link
                  to={`/admin/question-bank/questions/${result.persistedQuestion.id}/edit`}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Mở trình soạn thảo để chỉnh sửa &rarr;
                </Link>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Bản xem trước đề bài phác thảo bởi AI</h2>
                  <p className="text-xs text-slate-500 mt-1">Chủ đề: {result.draft.topic} · Thời gian ước tính: {result.draft.estimatedTimeSeconds}s</p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                    {enumLabel(type)}
                  </span>
                  <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                    {enumLabel(difficulty)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Nội dung câu hỏi (Prompt):</h3>
                  <div className="mt-1 rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
                    {result.draft.prompt.vi && <p className="font-semibold text-slate-900"><span className="text-xs text-slate-500 uppercase mr-1">[VI]</span>{result.draft.prompt.vi}</p>}
                    {result.draft.prompt.en && <p className="text-slate-700 italic"><span className="text-xs text-slate-500 uppercase mr-1">[EN]</span>{result.draft.prompt.en}</p>}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700">Đáp án tham khảo (Reference Answer):</h3>
                  <div className="mt-1 rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
                    {result.draft.referenceAnswer.vi && <p className="text-slate-900"><span className="text-xs text-slate-500 uppercase mr-1">[VI]</span>{result.draft.referenceAnswer.vi}</p>}
                    {result.draft.referenceAnswer.en && <p className="text-slate-700 italic"><span className="text-xs text-slate-500 uppercase mr-1">[EN]</span>{result.draft.referenceAnswer.en}</p>}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-700">Mục tiêu bài học (Learning Objective):</h3>
                  <div className="mt-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
                    <p>{result.draft.learningObjective.vi || result.draft.learningObjective.en}</p>
                  </div>
                </div>

                {result.draft.rubric && result.draft.rubric.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-2">Tiêu chí chấm điểm (Rubric):</h3>
                    <div className="space-y-2">
                      {result.draft.rubric.map((crit, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <div className="flex justify-between font-bold text-slate-900">
                            <span>{crit.title.vi || crit.title.en}</span>
                            <span className="text-indigo-600">Trọng số: {crit.weight}%</span>
                          </div>
                          <p className="mt-1 text-slate-600">{crit.description?.vi || crit.description?.en}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200">
                  <SemanticDuplicatePanel
                    draft={{
                      content: {
                        prompt: result.draft.prompt,
                        explanation: result.draft.explanation,
                      },
                      classification: {
                        primaryRoleId: roleId,
                        additionalRoleIds: [],
                        levelIds: [levelId],
                        technologies: [],
                        technologyAgnostic: false,
                        classificationComplete: false,
                        topic: result.draft.topic,
                        tags: result.draft.tags,
                        difficulty,
                        type,
                      },
                      answer: {
                        referenceAnswer: result.draft.referenceAnswer,
                        learningObjective: result.draft.learningObjective,
                        estimatedTimeSeconds: result.draft.estimatedTimeSeconds,
                        followUps: result.draft.followUps,
                      },
                      rubric: result.draft.rubric,
                      changeSummary: 'AI generated draft duplicate check',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
