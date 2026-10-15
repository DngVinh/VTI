import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../locales/I18nContext';

interface InterviewLoadingScreenProps {
  isEvaluating?: boolean;
}

const PREPARATION_MESSAGES = {
  vi: [
    'Đang khởi tạo máy chủ AI...',
    'Đang phân tích thông tin hồ sơ của bạn...',
    'Đang nghiên cứu Job Description (JD)...',
    'Đang soạn bộ câu hỏi phù hợp với năng lực...',
    'Đang kiểm tra độ khó và phân loại câu hỏi...',
    'Sắp hoàn tất, vui lòng đợi thêm chút nữa...',
  ],
  en: [
    'Initializing AI engine...',
    'Analyzing your profile and background...',
    'Reviewing Job Description (JD)...',
    'Drafting questions matched to your competencies...',
    'Checking difficulty calibration and categories...',
    'Almost ready, please wait a moment...',
  ],
};

const EVALUATION_MESSAGES = {
  vi: [
    'Đang khởi tạo bộ chấm điểm AI...',
    'Đang đọc và phân tích các câu trả lời của bạn...',
    'Đang đối chiếu với đáp án chuẩn...',
    'Đang chấm điểm từng tiêu chí...',
    'Đang tổng hợp nhận xét và đề xuất cải thiện...',
    'Sắp có kết quả, vui lòng đợi thêm chút nữa...',
  ],
  en: [
    'Initializing AI evaluation engine...',
    'Analyzing your answers and code solutions...',
    'Comparing against technical benchmarks...',
    'Scoring across multiple dimensions...',
    'Synthesizing feedback and growth recommendations...',
    'Results almost ready, please wait a moment...',
  ],
};

export const InterviewLoadingScreen: React.FC<InterviewLoadingScreenProps> = ({ isEvaluating }) => {
  const { t, language } = useTranslation();
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const langKey = language === 'en' ? 'en' : 'vi';
  const messages = isEvaluating ? EVALUATION_MESSAGES[langKey] : PREPARATION_MESSAGES[langKey];
  const loadingTitle = isEvaluating
    ? t('interview.loadingEvaluatingTitle', 'Hệ thống AI đang chấm điểm...')
    : t('interview.loadingPreparingTitle', 'Hệ thống AI đang chuẩn bị...');

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(messageTimer);
    };
  }, [messages.length]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse" />
        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700/50 shadow-2xl relative z-10">
          <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">{loadingTitle}</h2>

      <div className="h-12 mb-6">
        <p className="text-indigo-300 max-w-md mx-auto text-lg leading-relaxed animate-pulse">
          {messages[messageIndex]}
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-full px-4 py-1.5 border border-slate-700/50">
        <p className="text-sm font-mono text-slate-400">
          {t('interview.elapsedTime', 'Thời gian chờ:')} {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  );
};
