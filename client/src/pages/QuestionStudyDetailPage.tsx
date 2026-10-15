import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { publicQuestionApi } from '../services/api/publicQuestionApi';
import { interviewApi } from '../services/api/interviewApi';
import { useAuthStore } from '../auth/authStore';
import type { PublicQuestionDetail } from '../features/QuestionLibrary/types';
import { AppShell } from '../layouts/AppShell';

export const QuestionStudyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [question, setQuestion] = useState<PublicQuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [langMode, setLangMode] = useState<'VI' | 'EN' | 'BOTH'>('VI');
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      publicQuestionApi
        .fetchPublicQuestionById(id)
        .then((data) => {
          if (!mounted) return;
          setQuestion(data);
          setLoading(false);
        })
        .catch((err) => {
          if (!mounted) return;
          console.error('Failed to load question detail:', err);
          setError('Câu hỏi không tồn tại hoặc chưa được xuất bản.');
          setLoading(false);
        });
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  const getDifficultyBadge = (difficulty: string | null | undefined) => {
    switch (difficulty) {
      case 'EASY':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Dễ (Easy)
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Trung bình (Medium)
          </span>
        );
      case 'HARD':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Khó (Hard)
          </span>
        );
      default:
        return null;
    }
  };

  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstNewline = part.indexOf('\n');
        const lang = firstNewline > 3 ? part.slice(3, firstNewline).trim() : '';
        const code = firstNewline > 3 ? part.slice(firstNewline + 1, -3) : part.slice(3, -3);
        return (
          <div
            key={index}
            className="my-3 rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto border border-slate-800 shadow-inner"
          >
            {lang && (
              <div className="text-[10px] text-slate-300 font-bold uppercase mb-1.5 tracking-wider">
                {lang}
              </div>
            )}
            <pre className="whitespace-pre">{code}</pre>
          </div>
        );
      }
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  const renderBilingualText = (
    textObj: { vi?: string | null; en?: string | null } | undefined,
    fallback = 'Chưa cập nhật'
  ) => {
    if (!textObj) return <p className="text-slate-500 italic">{fallback}</p>;

    if (langMode === 'VI') {
      const text = textObj.vi || textObj.en || fallback;
      return <div className="text-slate-800 leading-relaxed">{renderFormattedContent(text)}</div>;
    }

    if (langMode === 'EN') {
      const text = textObj.en || textObj.vi || fallback;
      return <div className="text-slate-800 leading-relaxed">{renderFormattedContent(text)}</div>;
    }

    // BOTH (Song ngữ)
    return (
      <div className="space-y-3">
        {textObj.vi && (
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold uppercase text-indigo-700 block mb-1">
              🇻🇳 Tiếng Việt:
            </span>
            <div className="text-slate-800 leading-relaxed">
              {renderFormattedContent(textObj.vi)}
            </div>
          </div>
        )}
        {textObj.en && (
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold uppercase text-purple-700 block mb-1">
              🇬🇧 English:
            </span>
            <div className="text-slate-700 italic leading-relaxed">
              {renderFormattedContent(textObj.en)}
            </div>
          </div>
        )}
        {!textObj.vi && !textObj.en && (
          <p className="text-slate-500 italic">{fallback}</p>
        )}
      </div>
    );
  };

  const handleStartPractice = async () => {
    if (!question) return;
    if (!useAuthStore.getState().user) {
      navigate('/login', { state: { from: `/questions/${question.id}` } });
      return;
    }
    setIsStartingPractice(true);
    setActionError(null);
    try {
      const session = await interviewApi.createSessionFromQuestions([question.id]);
      const sessionId = (session as any)._id || (session as any).id;
      navigate(`/interview/${sessionId}`);
    } catch (err: any) {
      console.error('Lỗi khi bắt đầu phỏng vấn từ câu hỏi:', err);
      setActionError(err.message || 'Không thể tạo phiên phỏng vấn. Vui lòng thử lại.');
      setIsStartingPractice(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Đang tải câu hỏi và đáp án mẫu...</p>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Không tìm thấy câu hỏi</h2>
          <p className="mt-2 text-sm text-slate-500">
            {error || 'Câu hỏi này không tồn tại hoặc đã ngừng xuất bản.'}
          </p>
          <Link
            to="/questions"
            className="mt-6 inline-block w-full py-3 px-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition"
          >
            Quay lại thư viện câu hỏi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="pb-20">
        {/* Top Header & Breadcrumb */}
        <div className="bg-white border-b border-slate-200 shadow-xs mb-6">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-sm">
            <Link
              to="/questions"
              className="font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Thư viện câu hỏi</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-mono font-bold text-indigo-700">{question.code}</span>
          </div>

          {/* Bilingual Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setLangMode('VI')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                langMode === 'VI'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tiếng Việt
            </button>
            <button
              onClick={() => setLangMode('EN')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                langMode === 'EN'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLangMode('BOTH')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                langMode === 'BOTH'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Song ngữ
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Question Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                {question.code}
              </span>
              {getDifficultyBadge(question.difficulty)}
              {question.questionType && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  {question.questionType}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {question.role && (
                <span className="px-2.5 py-1 rounded-lg font-medium bg-slate-100 text-slate-700">
                  Vị trí: {question.role.name}
                </span>
              )}
              {question.levels.map((l) => (
                <span key={l.id} className="px-2.5 py-1 rounded-lg font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {l.name}
                </span>
              ))}
              {question.technologies.map((t) => (
                <span key={t.id} className="px-2.5 py-1 rounded-lg font-medium bg-purple-50 text-purple-700 border border-purple-100">
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
            {question.prompt.vi || question.prompt.en}
          </h1>

          {langMode !== 'VI' && question.prompt.en && question.prompt.vi && (
            <p className="mt-3 text-base text-slate-500 italic">
              {question.prompt.en}
            </p>
          )}
        </div>

        {/* Section 1: Standard Answer & Explanation */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              💡
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Đáp án chuẩn & Lời giải thích chi tiết
              </h2>
              <p className="text-xs text-slate-500">
                Tài liệu tham khảo chính thức giúp bạn tự tin trả lời đúng trọng tâm.
              </p>
            </div>
          </div>

          {/* Reference Answer */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-700 mb-2">
              Đáp án mẫu lý tưởng (Model Answer)
            </h3>
            <div className="bg-indigo-50/40 border border-indigo-100/80 rounded-2xl p-5">
              {renderBilingualText(question.referenceAnswer, 'Chưa có đáp án mẫu.')}
            </div>
          </div>

          {/* Explanation */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2">
              Phân tích & Lời giải thích chuyên sâu (Explanation)
            </h3>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
              {renderBilingualText(question.explanation, 'Chưa có lời giải thích.')}
            </div>
          </div>

          {/* Learning Objective */}
          {question.learningObjective && (question.learningObjective.vi || question.learningObjective.en) && (
            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Mục tiêu đánh giá năng lực
              </h3>
              <div className="text-sm text-slate-600">
                {renderBilingualText(question.learningObjective)}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Evaluation Rubric (0 to 4 Scale) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              📊
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Tiêu chí chấm điểm của Nhà tuyển dụng (Rubric 0–4)
              </h2>
              <p className="text-xs text-slate-500">
                Hiểu rõ các mức thang điểm để chuẩn bị câu trả lời đạt điểm tối đa (Level 4).
              </p>
            </div>
          </div>

          {question.rubric && question.rubric.length > 0 ? (
            <div className="space-y-6">
              {question.rubric.map((criterion, idx) => (
                <div
                  key={criterion.key || idx}
                  className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs"
                >
                  <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase text-purple-700 mr-2">
                        Tiêu chí {idx + 1}:
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {langMode === 'BOTH' ? (
                          <>
                            {criterion.title.vi && <span>{criterion.title.vi}</span>}
                            {criterion.title.en && criterion.title.vi && <span className="mx-1.5 text-slate-300 font-normal">/</span>}
                            {criterion.title.en && <span className="text-slate-600 font-medium italic">{criterion.title.en}</span>}
                          </>
                        ) : langMode === 'EN'
                          ? criterion.title.en || criterion.title.vi
                          : criterion.title.vi || criterion.title.en}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                      Trọng số: {criterion.weight}%
                    </span>
                  </div>

                  {criterion.description && (criterion.description.vi || criterion.description.en) && (
                    <div className="px-5 py-2.5 bg-slate-50/50 text-xs text-slate-600 border-b border-slate-100">
                      {langMode === 'BOTH' ? (
                        <div className="space-y-1">
                          {criterion.description.vi && <p>{criterion.description.vi}</p>}
                          {criterion.description.en && <p className="text-slate-500 italic">{criterion.description.en}</p>}
                        </div>
                      ) : langMode === 'EN'
                        ? criterion.description.en || criterion.description.vi
                        : criterion.description.vi || criterion.description.en}
                    </div>
                  )}

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {criterion.levels
                      .sort((a, b) => a.score - b.score)
                      .map((lvl) => {
                        const scoreColors = [
                          'bg-rose-50 border-rose-200 text-rose-700',
                          'bg-amber-50 border-amber-200 text-amber-700',
                          'bg-blue-50 border-blue-200 text-blue-700',
                          'bg-indigo-50 border-indigo-200 text-indigo-700',
                          'bg-emerald-50 border-emerald-200 text-emerald-700',
                        ];
                        const tierTitles = [
                          '0: Chưa đạt',
                          '1: Cơ bản',
                          '2: Đạt chuẩn',
                          '3: Tốt / Khá',
                          '4: Xuất sắc',
                        ];

                        return (
                          <div
                            key={lvl.score}
                            className={`p-3 rounded-xl border flex flex-col justify-between ${
                              scoreColors[lvl.score] || 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wider mb-1.5">
                                {tierTitles[lvl.score] || `Điểm ${lvl.score}`}
                              </div>
                              <div className="text-xs leading-relaxed">
                                {langMode === 'BOTH' ? (
                                  <div className="space-y-1">
                                    {lvl.description.vi && <p>{lvl.description.vi}</p>}
                                    {lvl.description.en && <p className="text-slate-500 italic">{lvl.description.en}</p>}
                                  </div>
                                ) : (
                                  <p>
                                    {langMode === 'EN'
                                      ? lvl.description.en || lvl.description.vi
                                      : lvl.description.vi || lvl.description.en}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Chưa có rubric đánh giá cụ thể.</p>
          )}
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 cursor-pointer underline"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Section 3: Call To Action - Practice With AI */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-8 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-2xl font-black tracking-tight">
              Sẵn sàng thử sức với câu hỏi này?
            </h3>
            <p className="text-indigo-100 text-sm sm:text-base max-w-xl">
              Vào phòng phỏng vấn mô phỏng với AI để trả lời câu hỏi, nhận điểm số theo thang Rubric 0–4 và nhận xét cải thiện tức thì.
            </p>
          </div>

          <button
            type="button"
            disabled={isStartingPractice}
            onClick={handleStartPractice}
            className="px-8 py-4 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
          >
            {isStartingPractice ? (
              <>
                <svg className="animate-spin h-5 w-5 text-indigo-700" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang tạo phòng...</span>
              </>
            ) : (
              <span>Luyện phỏng vấn câu này với AI →</span>
            )}
          </button>
        </div>
      </main>
    </div>
  </AppShell>
);
};
