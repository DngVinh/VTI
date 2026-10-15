import React from 'react';
import { SetupMode } from '../types';
import { useTranslation } from '../../../locales/I18nContext';

interface SessionBriefCardProps {
  activeMode: SetupMode;
  selectedRoleName?: string;
  selectedLevelName?: string;
  selectedTechNames: string[];
  jdFileName?: string;
  isLoading: boolean;
  disabled: boolean;
  onSubmit: () => void;
  submitButtonText: string;
}

export const SessionBriefCard: React.FC<SessionBriefCardProps> = ({
  activeMode,
  selectedRoleName,
  selectedLevelName,
  selectedTechNames,
  jdFileName,
  isLoading,
  disabled,
  onSubmit,
  submitButtonText,
}) => {
  const { t } = useTranslation();
  const isJdMode = activeMode === SetupMode.JD_UPLOAD;

  return (
    <div className="bg-gradient-to-b from-white to-slate-50/90 rounded-3xl p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 flex flex-col justify-between h-full relative overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="space-y-5 relative z-10">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
              Live Preview
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              {t('setup.specsTitle', 'Thông số phiên phỏng vấn')}
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            {isJdMode ? t('setup.badgeJd', 'Theo bản JD') : t('setup.badgeStandard', 'Vị trí chuẩn hóa')}
          </span>
        </div>

        {/* Specs Details */}
        <div className="space-y-3.5 text-sm">
          {/* Role / Target */}
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500 font-medium">{t('setup.roleLabel', 'Vị trí:')}</span>
            <span className="text-slate-800 font-bold text-right max-w-[210px] truncate">
              {isJdMode
                ? jdFileName || <span className="text-slate-500 italic font-normal">{t('setup.noJdFile', 'Chưa chọn tệp JD')}</span>
                : selectedRoleName || <span className="text-slate-500 italic font-normal">{t('setup.unselected', 'Chưa chọn')}</span>}
            </span>
          </div>

          {/* Level */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 font-medium">{t('setup.levelLabel', 'Cấp độ:')}</span>
            <span className="text-slate-800 font-bold">
              {isJdMode ? (
                <span className="text-indigo-600 font-semibold">{t('setup.autoJdLevel', 'Tự động phân tích từ JD')}</span>
              ) : (
                selectedLevelName || <span className="text-slate-500 italic font-normal">{t('setup.unselected', 'Chưa chọn')}</span>
              )}
            </span>
          </div>

          {/* Tech Stacks */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-slate-500 font-medium">{t('setup.targetSkillsLabel', 'Kỹ năng mục tiêu:')}</span>
              <span className="text-xs text-indigo-600 font-bold">
                {isJdMode ? t('setup.byJdReq', 'Theo yêu cầu JD') : `${selectedTechNames.length} ${t('setup.technologiesCount', 'công nghệ')}`}
              </span>
            </div>
            {!isJdMode && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedTechNames.length > 0 ? (
                  selectedTechNames.map((name) => (
                    <span
                      key={name}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/50"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">
                    {t('setup.noTechSelected', 'Chưa chọn công nghệ nào')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Interview Format Standard */}
          <div className="pt-3 border-t border-slate-200/70 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('setup.standardFormat', 'Quy chuẩn đề:')}</span>
              <span className="font-semibold text-slate-800">{t('setup.standardFormatDetail', '5 câu hỏi kỹ thuật • ~20 phút')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('setup.langLabel', 'Ngôn ngữ:')}</span>
              <span className="font-semibold text-slate-800">{t('setup.langBilingual', 'Song ngữ (Tiếng Việt & English)')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('setup.evalPanelLabel', 'Hội đồng chấm:')}</span>
              <span className="font-semibold text-indigo-700">Multi-Agent (Tech Lead & Bar Raiser)</span>
            </div>
          </div>
        </div>

        {/* Realistic Readiness Preflight Notice */}
        <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/60 flex items-start gap-2.5 text-xs text-amber-800">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-bold block text-amber-900">{t('setup.prepNoticeTitle', 'Chuẩn bị trước khi vào:')}</span>
            <span className="text-amber-700/90 leading-tight block mt-0.5">
              {t('setup.prepNoticeDesc', 'Micro & Camera sẽ được kiểm tra thực tế tại bước kế tiếp trước khi bắt đầu.')}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Unified CTA Action Button */}
      <div className="pt-5 mt-5 border-t border-slate-200/80 relative z-10">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          aria-label={isLoading ? t('setup.initializing', 'Đang khởi tạo...') : submitButtonText}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
            disabled
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 cursor-pointer'
          }`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('setup.initializing', 'Đang khởi tạo...')}
            </>
          ) : (
            <>
              {submitButtonText}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
