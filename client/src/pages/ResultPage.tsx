import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { interviewApi, type BaseEntity } from '../services/api/interviewApi';
import type { InterviewSession } from '../features/InterviewRoom/types';
import { RadarScoreChart } from '../features/ResultScreen/components/RadarScoreChart';
import { FeedbackList } from '../features/ResultScreen/components/FeedbackList';
import { LearningPathView } from '../features/ResultScreen/components/LearningPathView';
import { PersonaFeedbackPanel } from '../features/ResultScreen/components/PersonaFeedbackPanel';
import { AppShell } from '../layouts/AppShell';
import { Spinner, Card, CardContent, ChartErrorBoundary, Skeleton, CardSkeleton } from '../design-system';
import { useTranslation } from '../locales/I18nContext';

const resultLabels = {
  vi: {
    loading: 'Đang tải kết quả đánh giá...',
    loadError: 'Không thể tải kết quả đánh giá.',
    loadErrorTitle: 'Không thể tải kết quả',
    noSession: 'Dữ liệu phiên phỏng vấn không tồn tại.',
    backHome: 'Về trang chủ',
    unknown: 'Không xác định',
    completedBadge: 'Phiên phỏng vấn hoàn tất',
    reportTitle: 'Báo cáo đánh giá năng lực',
    position: 'Vị trí',
    level: 'Cấp độ',
    overallScore: 'Điểm tổng quan',
    historyLink: '← Xem toàn bộ lịch sử',
    radarTitle: 'Phân tích đa chiều (Radar Chart)',
    detailedFeedbackTitle: 'Chi tiết nhận xét từng câu hỏi',
    detailedFeedbackDesc: 'Xem lại câu trả lời và đánh giá chuyên môn từ AI',
  },
  en: {
    loading: 'Loading evaluation results...',
    loadError: 'Unable to load evaluation results.',
    loadErrorTitle: 'Unable to load results',
    noSession: 'Interview session data not found.',
    backHome: 'Back to Home',
    unknown: 'Unknown',
    completedBadge: 'Interview Completed',
    reportTitle: 'Competency Assessment Report',
    position: 'Position',
    level: 'Level',
    overallScore: 'Overall Score',
    historyLink: '← View full history',
    radarTitle: 'Multi-Dimensional Analysis (Radar Chart)',
    detailedFeedbackTitle: 'Detailed Feedback per Question',
    detailedFeedbackDesc: 'Review candidate responses and professional AI evaluation',
  },
} as const;

export const ResultPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { locale: globalLocale } = useTranslation();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [roles, setRoles] = useState<BaseEntity[]>([]);
  const [levels, setLevels] = useState<BaseEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'vi' | 'en'>(() => (globalLocale === 'en' ? 'en' : 'vi'));
  const t = resultLabels[language];

  useEffect(() => {
    const fetchResult = async () => {
      if (!sessionId) return;
      try {
        setIsLoading(true);
        const [data, fetchedRoles, fetchedLevels] = await Promise.all([
          interviewApi.fetchInterviewSession(sessionId),
          interviewApi.fetchRoles(),
          interviewApi.fetchLevels()
        ]);
        if (data.status !== 'COMPLETED') {
          navigate(`/interview/${sessionId}`);
          return;
        }
        setSession(data);
        setRoles(fetchedRoles);
        setLevels(fetchedLevels);
      } catch {
        setError('Không thể tải kết quả đánh giá.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchResult();
  }, [sessionId, navigate]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-8" aria-busy="true" aria-live="polite">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="w-64 h-8" />
              <Skeleton className="w-40 h-4" />
            </div>
            <Skeleton className="w-28 h-10 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="flex justify-center py-4">
            <Spinner size="md" text={t.loading} />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !session) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xs border border-slate-200 text-center max-w-md w-full">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{t.loadErrorTitle}</h2>
            <p className="text-slate-500 mb-6 text-sm">{error || t.noSession}</p>
            <Link to="/" className="inline-block px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl text-sm hover:bg-indigo-700 transition">
              {t.backHome}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const roleName = roles.find(r => r._id === session?.setupData?.jobPosition)?.name || t.unknown;
  const levelName = levels.find(l => l._id === session?.setupData?.level)?.name || t.unknown;

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {t.completedBadge}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{t.reportTitle}</h1>
            <p className="text-slate-500 text-sm">
              {t.position}: <span className="font-semibold text-slate-800">{roleName}</span> · {t.level}: <span className="font-semibold text-slate-800">{levelName}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-8 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">{t.overallScore}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-black text-indigo-600">{session.overallScore ?? 'N/A'}</span>
                <span className="text-lg font-bold text-slate-500">/10</span>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center bg-slate-100 rounded-xl p-1" role="group" aria-label="Language selection">
                <button 
                  type="button"
                  onClick={() => setLanguage('vi')}
                  aria-label="Tiếng Việt"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${language === 'vi' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🇻🇳 Tiếng Việt
                </button>
                <button 
                  type="button"
                  onClick={() => setLanguage('en')}
                  aria-label="English"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🇬🇧 English
                </button>
              </div>

              <Link
                to="/history"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                {t.historyLink}
              </Link>
            </div>
          </div>
        </header>

        {/* Radar Chart & Learning Path Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardContent className="flex flex-col h-full">
              <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">{t.radarTitle}</h3>
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                <ChartErrorBoundary language={language}>
                  <RadarScoreChart dimensions={session.dimensions || []} language={language} />
                </ChartErrorBoundary>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col">
            <LearningPathView learningPath={session.learningPath} language={language} />
          </div>
        </div>

        {/* Multi-Agent Panel Breakdown */}
        <PersonaFeedbackPanel
          personaEvaluations={session.personaEvaluations}
          varianceFlags={session.varianceFlags}
          overallScore={session.overallScore}
          currentLang={language}
        />

        {/* Detailed Feedback Section */}
        <div>
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{t.detailedFeedbackTitle}</h3>
            <p className="text-sm text-slate-500">{t.detailedFeedbackDesc}</p>
          </div>
          <FeedbackList questions={session.questions || []} language={language} />
        </div>

      </div>
    </AppShell>
  );
};
