import React from 'react';
import type { InterviewHistoryItem, InterviewHistoryStatus } from '../../services/api/interviewApi';
import { useTranslation } from '../../locales/I18nContext';

interface Props {
  items: InterviewHistoryItem[];
  roleNames: Map<string, string>;
  levelNames: Map<string, string>;
  technologyNames: Map<string, string>;
  onOpen: (item: InterviewHistoryItem) => void;
}

const statusClasses: Record<InterviewHistoryStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 border border-slate-200',
  GENERATING: 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 border border-purple-200 font-bold ring-2 ring-purple-100',
  EVALUATING: 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold',
  FAILED: 'bg-rose-50 text-rose-700 border border-rose-200',
};

const statusIcons: Record<InterviewHistoryStatus, React.ReactNode> = {
  PENDING: <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />,
  GENERATING: <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />,
  IN_PROGRESS: <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />,
  EVALUATING: <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />,
  COMPLETED: (
    <svg aria-hidden="true" className="h-3 w-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  FAILED: (
    <svg aria-hidden="true" className="h-3 w-3 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

const renderScoreBadge = (score: number | null) => {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        —
      </span>
    );
  }

  const formatted = `${score.toFixed(1)}/10`;
  let colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs';
  if (score < 5.0) {
    colorClass = 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs';
  } else if (score < 6.5) {
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs';
  } else if (score < 8.0) {
    colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs';
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-black tracking-tight ${colorClass}`}>
      {formatted}
    </span>
  );
};

export const HistoryTable = ({ items, roleNames, levelNames, technologyNames, onOpen }: Props) => {
  const { t, language } = useTranslation();

  const statusLabels: Record<InterviewHistoryStatus, string> = {
    PENDING: t('history.statusPending', 'Chờ xử lý'),
    GENERATING: t('history.statusGenerating', 'Đang tạo câu hỏi'),
    IN_PROGRESS: t('history.statusInProgress', 'Đang phỏng vấn'),
    EVALUATING: t('history.statusEvaluating', 'Đang đánh giá'),
    COMPLETED: t('history.statusCompleted', 'Hoàn thành'),
    FAILED: t('history.statusFailed', 'Thất bại'),
  };

  const displayName = (id: string | undefined, map: Map<string, string>) =>
    id ? (map.get(id) ?? t('history.unknown', 'Không xác định')) : '—';

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-2xs">
      <table className="min-w-[920px] w-full text-left">
        <caption className="sr-only">{t('history.tableCaption', 'Lịch sử các phiên phỏng vấn')}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-4">{t('history.colRole', 'Vai trò')}</th>
            <th scope="col" className="px-5 py-4">{t('history.colLevel', 'Cấp độ')}</th>
            <th scope="col" className="px-5 py-4">{t('history.colTech', 'Công nghệ')}</th>
            <th scope="col" className="px-5 py-4">{t('history.colScore', 'Điểm')}</th>
            <th scope="col" className="px-5 py-4">{t('history.colStatus', 'Trạng thái')}</th>
            <th scope="col" className="px-5 py-4">{t('history.colTime', 'Thời gian')}</th>
            <th scope="col" className="px-5 py-4 text-right">{t('history.colActions', 'Thao tác')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {items.map((item) => {
            const actionLabel =
              item.status === 'COMPLETED'
                ? t('history.viewResult', 'Xem kết quả')
                : item.status === 'FAILED'
                ? t('history.unavailable', 'Không khả dụng')
                : t('history.openSession', 'Mở phiên');

            return (
              <tr key={item.sessionId} className="group align-middle transition-colors hover:bg-slate-50/80">
                <td className="px-5 py-4 font-bold text-slate-900">
                  {displayName(item.role, roleNames)}
                </td>
                <td className="px-5 py-4 text-slate-700">
                  {displayName(item.level, levelNames)}
                </td>
                <td className="max-w-xs px-5 py-4 text-slate-700">
                  <div className="flex flex-wrap gap-1.5">
                    {item.technologies.length ? (
                      item.technologies.map((id) => (
                        <span
                          key={id}
                          className="rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {technologyNames.get(id) ?? t('history.unknown', 'Không xác định')}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {renderScoreBadge(item.score)}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusClasses[item.status]}`}>
                    {statusIcons[item.status]}
                    {statusLabels[item.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-xs font-medium text-slate-500">
                  {formatDate(item.createdAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    disabled={item.status === 'FAILED'}
                    onClick={() => onOpen(item)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all focus:outline-none focus:ring-4 ${
                      item.status === 'IN_PROGRESS'
                        ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-300 hover:bg-indigo-700 focus:ring-indigo-100'
                        : item.status === 'COMPLETED'
                        ? 'border border-indigo-200 bg-white text-indigo-700 shadow-2xs hover:bg-indigo-50 focus:ring-indigo-100'
                        : item.status === 'FAILED'
                        ? 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400'
                        : 'border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 focus:ring-slate-100'
                    }`}
                  >
                    {item.status === 'IN_PROGRESS' && (
                      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                    )}
                    {item.status === 'COMPLETED' && (
                      <svg aria-hidden="true" className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    )}
                    {actionLabel}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

