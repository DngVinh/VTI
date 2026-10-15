import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { publicQuestionApi } from '../services/api/publicQuestionApi';
import type { TaxonomyOption } from '../services/api/publicQuestionApi';
import { interviewApi } from '../services/api/interviewApi';
import { useAuthStore } from '../auth/authStore';
import type {
  PaginatedPublicQuestions,
  PublicQuestionFilters,
  PublicQuestionSummary,
} from '../features/QuestionLibrary/types';
import { AppShell } from '../layouts/AppShell';

type DifficultyFilter = NonNullable<PublicQuestionFilters['difficulty']>;

const isDifficultyFilter = (value: string | null): value is DifficultyFilter =>
  value === '' || value === 'EASY' || value === 'MEDIUM' || value === 'HARD';

export const QuestionLibraryListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState<PaginatedPublicQuestions>({
    items: [],
    total: 0,
    page: 1,
    limit: 9,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<TaxonomyOption[]>([]);
  const [levels, setLevels] = useState<TaxonomyOption[]>([]);
  const [technologies, setTechnologies] = useState<TaxonomyOption[]>([]);

  // Selection states for practicing specific questions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Local filter states synced with URL search params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedRole, setSelectedRole] = useState(searchParams.get('roleId') || '');
  const [selectedLevel, setSelectedLevel] = useState(searchParams.get('levelId') || '');
  const [selectedTech, setSelectedTech] = useState(searchParams.get('technologyId') || '');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>(() => {
    const value = searchParams.get('difficulty');
    return isDifficultyFilter(value) ? value : '';
  });
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page')) || 1
  );

  // Load filter options once on mount
  useEffect(() => {
    let mounted = true;
    publicQuestionApi.fetchTaxonomyFilters(selectedRole || undefined).then((res) => {
      if (mounted) {
        setRoles(res.roles);
        setLevels(res.levels);
        setTechnologies(res.technologies);
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch technologies dynamically when role changes (matching interview feature)
  const handleRoleChange = async (newRoleId: string) => {
    setSelectedRole(newRoleId);
    setCurrentPage(1);

    try {
      const res = await publicQuestionApi.fetchTaxonomyFilters(newRoleId || undefined);
      setTechnologies(res.technologies);
      if (selectedTech && !res.technologies.some((t) => t._id === selectedTech)) {
        setSelectedTech('');
      }
    } catch {
      // Ignore taxonomy load error
    }
  };

  // Sync active filters to URL search params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (selectedRole) params.roleId = selectedRole;
    if (selectedLevel) params.levelId = selectedLevel;
    if (selectedTech) params.technologyId = selectedTech;
    if (selectedDifficulty) params.difficulty = selectedDifficulty;
    if (currentPage > 1) params.page = String(currentPage);
    setSearchParams(params, { replace: true });
  }, [search, selectedRole, selectedLevel, selectedTech, selectedDifficulty, currentPage, setSearchParams]);

  // Fetch questions whenever filters or pagination changes (with debounce on search)
  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const query: PublicQuestionFilters = {
        page: currentPage,
        limit: 9,
        roleId: selectedRole || undefined,
        levelId: selectedLevel || undefined,
        technologyId: selectedTech || undefined,
        difficulty: selectedDifficulty || undefined,
        search: search.trim() || undefined,
      };

      publicQuestionApi
        .fetchPublicQuestions(query)
        .then((res) => {
          if (mounted) {
            setData(res);
            setLoading(false);
          }
        })
        .catch(() => {
          if (mounted) setLoading(false);
        });
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [currentPage, selectedRole, selectedLevel, selectedTech, selectedDifficulty, search]);

  const handleResetFilters = async () => {
    setSearch('');
    setSelectedRole('');
    setSelectedLevel('');
    setSelectedTech('');
    setSelectedDifficulty('');
    setCurrentPage(1);

    try {
      const res = await publicQuestionApi.fetchTaxonomyFilters();
      setTechnologies(res.technologies);
    } catch {
      // Keep existing technologies on error
    }
  };

  const handleToggleSelect = (id: string) => {
    setActionError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 5) {
        setActionError('Chỉ có thể chọn tối đa 5 câu hỏi cho một buổi phỏng vấn.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handlePracticeQuestions = async (ids: string[]) => {
    if (!useAuthStore.getState().user) {
      navigate('/login', { state: { from: '/questions' } });
      return;
    }
    if (ids.length === 0) return;
    setIsStartingPractice(true);
    setActionError(null);
    try {
      const session = await interviewApi.createSessionFromQuestions(ids);
      const sessionId = (session as any)._id || (session as any).id;
      navigate(`/interview/${sessionId}`);
    } catch (err: any) {
      setActionError(err.message || 'Không thể tạo phiên phỏng vấn. Vui lòng thử lại.');
      setIsStartingPractice(false);
    }
  };

  const getDifficultyBadge = (difficulty: string | null | undefined) => {
    switch (difficulty) {
      case 'EASY':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Dễ (Easy)
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Trung bình (Medium)
          </span>
        );
      case 'HARD':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Khó (Hard)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            Tổng hợp
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="pb-16">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white py-10 px-4 sm:px-6 lg:px-8 mb-8 shadow-xs">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Thư viện câu hỏi & Đáp án mẫu ôn tập
            </h1>
            <p className="mt-2 text-indigo-200 text-base sm:text-lg max-w-3xl">
              Tra cứu các câu hỏi phỏng vấn chuẩn hóa, xem phân tích đáp án lý tưởng và bảng tiêu chí đánh giá (Rubric) chi tiết của nhà tuyển dụng.
            </p>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                aria-label="Tìm kiếm câu hỏi"
                placeholder="Tìm kiếm câu hỏi, từ khóa, công nghệ..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm outline-none transition"
              />
            </div>

            {/* Role Filter */}
            <div className="md:col-span-2">
              <select
                aria-label="Vị trí ứng tuyển"
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm outline-none bg-white transition cursor-pointer"
              >
                <option value="">Tất cả vị trí (Role)</option>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div className="md:col-span-2">
              <select
                aria-label="Cấp độ"
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm outline-none bg-white transition cursor-pointer"
              >
                <option value="">Tất cả cấp độ (Level)</option>
                {levels.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Technology Filter */}
            <div className="md:col-span-2">
              <select
                aria-label="Công nghệ"
                value={selectedTech}
                onChange={(e) => {
                  setSelectedTech(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm outline-none bg-white transition cursor-pointer"
              >
                <option value="">
                  {selectedRole ? 'Tất cả công nghệ theo vị trí' : 'Tất cả công nghệ'}
                </option>
                {technologies.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="md:col-span-2">
              <select
                aria-label="Độ khó"
                value={selectedDifficulty}
                onChange={(e) => {
                  if (isDifficultyFilter(e.target.value)) {
                    setSelectedDifficulty(e.target.value);
                  }
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm outline-none bg-white transition"
              >
                <option value="">Tất cả độ khó</option>
                <option value="EASY">Dễ (Easy)</option>
                <option value="MEDIUM">Trung bình (Medium)</option>
                <option value="HARD">Khó (Hard)</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips & Clear Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div>
              Hiển thị <span className="font-bold text-indigo-700">{data.total}</span> câu hỏi chuẩn hóa
            </div>
            {(search || selectedRole || selectedLevel || selectedTech || selectedDifficulty) && (
              <button
                onClick={handleResetFilters}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline flex items-center gap-1"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3">
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

        {/* Content Section */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 h-64 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-24 h-5 bg-slate-200 rounded-md"></div>
                  <div className="w-full h-12 bg-slate-200 rounded-md"></div>
                </div>
                <div className="w-1/2 h-4 bg-slate-200 rounded-md"></div>
              </div>
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 max-w-lg mx-auto my-12 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Không tìm thấy câu hỏi phù hợp</h3>
            <p className="mt-2 text-sm text-slate-500">
              Hãy thử điều chỉnh lại bộ lọc hoặc nhập từ khóa tìm kiếm khác.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer"
            >
              Xem tất cả câu hỏi
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.items.map((q: PublicQuestionSummary) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl p-6 border shadow-xs transition-all flex flex-col justify-between group ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-slate-200/90 hover:shadow-md hover:border-indigo-200'
                  }`}
                >
                  <div>
                    {/* Top badges with Select Checkbox */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          aria-label={`Chọn câu hỏi ${q.code}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelect(q.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {q.code}
                        </span>
                      </label>
                      {getDifficultyBadge(q.difficulty)}
                    </div>

                    {/* Question Prompt */}
                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-3 group-hover:text-indigo-600 transition-colors">
                      {q.prompt.vi || q.prompt.en || 'Chưa cập nhật đề bài'}
                    </h3>

                    {/* English sub-preview if VI is present */}
                    {q.prompt.vi && q.prompt.en && (
                      <p className="mt-1.5 text-xs text-slate-500 italic line-clamp-2">
                        {q.prompt.en}
                      </p>
                    )}

                    {/* Taxonomy Tags */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {q.role?.name && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {q.role.name}
                        </span>
                      )}
                      {q.levels.map((l) => (
                        <span
                          key={l.id}
                          className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {l.name}
                        </span>
                      ))}
                      {q.technologies.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <Link
                      to={`/questions/${q.id}`}
                      className="flex-1 text-center py-2.5 px-3 rounded-xl text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
                    >
                      Xem đáp án & lời giải
                    </Link>
                    <button
                      type="button"
                      disabled={isStartingPractice}
                      onClick={() => handlePracticeQuestions([q.id])}
                      title="Luyện tập phỏng vấn ngay câu này với AI"
                      aria-label={`Luyện tập phỏng vấn câu ${q.code}`}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white transition cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Floating Selection Bar for Practice */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 inset-x-0 z-40 max-w-xl mx-auto px-4">
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-slate-700 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-inner">
                  {selectedIds.length}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100">
                    Đã chọn {selectedIds.length} / 5 câu hỏi
                  </div>
                  <div className="text-xs text-slate-300">
                    Chuyển sang phòng phỏng vấn AI để luyện tập
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  disabled={isStartingPractice}
                  onClick={() => handlePracticeQuestions(selectedIds)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  {isStartingPractice ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Đang vào phòng...</span>
                    </>
                  ) : (
                    <>
                      <span>Phỏng vấn ngay ({selectedIds.length})</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {data.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
            >
              Trang trước
            </button>
            <span className="text-sm font-medium text-slate-600 px-3">
              Trang <span className="font-bold text-slate-900">{currentPage}</span> / {data.totalPages}
            </span>
            <button
              disabled={currentPage >= data.totalPages}
              onClick={() => setCurrentPage((p) => Math.min(data.totalPages, p + 1))}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition"
            >
              Trang sau
            </button>
          </div>
        )}
      </main>
    </div>
  </AppShell>
);
};
