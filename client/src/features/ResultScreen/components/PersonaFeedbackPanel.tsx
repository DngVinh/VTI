import React, { useState } from 'react';

export interface PersonaEvaluationClient {
  role: 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL' | 'JUDGE';
  score: number;
  strengths: Array<{ vi: string; en: string }>;
  weaknesses: Array<{ vi: string; en: string }>;
  specificFeedback: { vi: string; en: string };
  dimensionScores?: Record<string, number>;
}

export interface VarianceFlagClient {
  dimension: string;
  variance: number;
  arbiterResolution: { vi: string; en: string };
}

export interface PersonaFeedbackPanelProps {
  personaEvaluations?: PersonaEvaluationClient[];
  varianceFlags?: VarianceFlagClient[];
  overallScore?: number;
  currentLang?: 'vi' | 'en';
}

type TabType = 'all' | 'TECH_LEAD' | 'BAR_RAISER' | 'BEHAVIORAL';

export const PersonaFeedbackPanel: React.FC<PersonaFeedbackPanelProps> = ({
  personaEvaluations = [],
  varianceFlags = [],
  overallScore = 0,
  currentLang = 'vi',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const panelLabels = {
    vi: {
      title: 'Góc Nhìn Hội Đồng AI (Multi-Agent Panel)',
      subtitle: 'Đánh giá đa chiều độc lập từ 3 chuyên gia kỹ thuật và trọng tài hiệu chuẩn.',
      tabAria: 'Chọn góc nhìn chuyên gia',
      overview: 'Tổng quan',
      varianceDetected: 'Phát hiện độ lệch điểm giữa các chuyên gia',
      points: 'điểm',
      viewDetail: 'Xem chi tiết →',
      coreFeedback: 'Nhận xét trọng tâm',
      strengths: 'Thế mạnh ghi nhận',
      weaknesses: 'Điểm cần cải thiện',
      dimensionScores: 'Điểm số theo tiêu chí chuyên môn',
    },
    en: {
      title: 'AI Panel Perspectives (Multi-Agent Panel)',
      subtitle: 'Independent multi-dimensional evaluation from 3 technical experts and a calibration arbiter.',
      tabAria: 'Select expert perspective',
      overview: 'Overview',
      varianceDetected: 'Score variance detected between experts',
      points: 'points',
      viewDetail: 'View details →',
      coreFeedback: 'Core Feedback',
      strengths: 'Strengths',
      weaknesses: 'Areas for Improvement',
      dimensionScores: 'Scores by Technical Criterion',
    },
  } as const;
  const pt = panelLabels[currentLang];

  const getRoleTitle = (role: string) => {
    if (currentLang === 'en') {
      switch (role) {
        case 'TECH_LEAD':
          return 'Tech Lead: Architecture & Code';
        case 'BAR_RAISER':
          return 'Bar Raiser: Security & Boundary Analysis';
        case 'BEHAVIORAL':
          return 'HR: Communication & Professionalism';
        case 'JUDGE':
          return 'Consensus Panel Arbiter';
        default:
          return role;
      }
    }
    switch (role) {
      case 'TECH_LEAD':
        return 'Tech Lead: Kiến trúc & Code';
      case 'BAR_RAISER':
        return 'Bar Raiser: Bảo mật & Biên giới lỗi';
      case 'BEHAVIORAL':
        return 'HR: Tác phong & Giao tiếp';
      case 'JUDGE':
        return 'Chủ Tịch Hội Đồng Giám Khảo';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'TECH_LEAD':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'BAR_RAISER':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'BEHAVIORAL':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const selectedPersona =
    activeTab !== 'all'
      ? personaEvaluations.find((p) => p.role === activeTab)
      : null;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col gap-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {pt.title}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {pt.subtitle}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          role="tablist"
          aria-label={pt.tabAria}
          className="bg-slate-100 p-1.5 rounded-2xl inline-flex flex-wrap gap-1 border border-slate-200/60 self-start sm:self-auto"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {pt.overview} ({overallScore.toFixed(1)})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'TECH_LEAD'}
            onClick={() => setActiveTab('TECH_LEAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'TECH_LEAD'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tech Lead
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'BAR_RAISER'}
            onClick={() => setActiveTab('BAR_RAISER')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'BAR_RAISER'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bar Raiser
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'BEHAVIORAL'}
            onClick={() => setActiveTab('BEHAVIORAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'BEHAVIORAL'
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            HR
          </button>
        </div>
      </div>

      {/* Variance Alert Banner */}
      {varianceFlags.length > 0 && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-bold text-sm">
              {pt.varianceDetected} ({varianceFlags[0].variance} {pt.points})
            </span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed pl-7">
            {currentLang === 'en'
              ? varianceFlags[0].arbiterResolution.en
              : varianceFlags[0].arbiterResolution.vi}
          </p>
        </div>
      )}

      {/* Active Tab Content */}
      {activeTab === 'all' ? (
        /* Overall Consensus View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {personaEvaluations.map((persona) => (
            <div
              key={persona.role}
              className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getRoleBadgeColor(
                      persona.role
                    )}`}
                  >
                    {persona.role}
                  </span>
                  <span className="text-xl font-black text-slate-800">
                    {persona.score.toFixed(1)}
                    <span className="text-xs font-semibold text-slate-500">/10</span>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">
                  {getRoleTitle(persona.role)}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-3">
                  &ldquo;{currentLang === 'en'
                    ? (persona.specificFeedback?.en || persona.specificFeedback?.vi || '')
                    : (persona.specificFeedback?.vi || persona.specificFeedback?.en || '')}&rdquo;
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab(persona.role as TabType)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors self-start cursor-pointer"
              >
                {pt.viewDetail}
              </button>
            </div>
          ))}
        </div>
      ) : selectedPersona ? (
        /* Individual Persona Detailed View */
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
            <div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border mr-2.5 ${getRoleBadgeColor(
                  selectedPersona.role
                )}`}
              >
                {selectedPersona.role}
              </span>
              <span className="text-sm font-bold text-slate-800">
                {getRoleTitle(selectedPersona.role)}
              </span>
            </div>
            <span className="text-2xl font-black text-slate-800">
              {selectedPersona.score.toFixed(1)}
              <span className="text-xs font-semibold text-slate-500">/10</span>
            </span>
          </div>

          {/* Feedback Quote */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
            <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1.5">
              {pt.coreFeedback}
            </h5>
            <p className="text-sm text-indigo-950 leading-relaxed">
              {currentLang === 'en'
                ? (selectedPersona.specificFeedback?.en || selectedPersona.specificFeedback?.vi || '')
                : (selectedPersona.specificFeedback?.vi || selectedPersona.specificFeedback?.en || '')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Strengths */}
            <div className="flex flex-col gap-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {pt.strengths}
              </h5>
              <ul className="flex flex-col gap-2">
                {(selectedPersona.strengths ?? []).map((s, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-700 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 leading-relaxed"
                  >
                    {currentLang === 'en' ? (s?.en || s?.vi || '') : (s?.vi || s?.en || '')}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div className="flex flex-col gap-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {pt.weaknesses}
              </h5>
              <ul className="flex flex-col gap-2">
                {(selectedPersona.weaknesses ?? []).map((w, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-700 bg-rose-50/50 border border-rose-100 rounded-xl p-3 leading-relaxed"
                  >
                    {currentLang === 'en' ? (w?.en || w?.vi || '') : (w?.vi || w?.en || '')}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Dimension Scores if available */}
          {selectedPersona.dimensionScores &&
            Object.keys(selectedPersona.dimensionScores).length > 0 && (
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {pt.dimensionScores}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(selectedPersona.dimensionScores).map(([name, score]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/60 rounded-xl"
                    >
                      <span className="text-xs font-medium text-slate-700">{name}</span>
                      <span className="text-xs font-bold text-slate-900">{score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      ) : null}
    </div>
  );
};
