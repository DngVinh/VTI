import React from 'react';
import { useInterviewSetup } from './useInterviewSetup';
import { FormProvider } from 'react-hook-form';
import { SetupMode } from './types';
import { ManualSetupTab } from './components/ManualSetupTab';
import { JdUploadTab } from './components/JdUploadTab';
import { SessionBriefCard } from './components/SessionBriefCard';
import { useTranslation } from '../../locales/I18nContext';

export const InterviewSetupForm: React.FC = () => {
  const { t } = useTranslation();
  const {
    manualForm,
    jdForm,
    activeMode,
    setActiveMode,
    isLoading,
    isFetchingData,
    error,
    roles,
    levels,
    technologies,
    onSubmitManual,
    onSubmitJd,
  } = useInterviewSetup();

  // Watch manual form values for live preview
  const watchedRoleId = manualForm.watch('jobPosition');
  const watchedLevelId = manualForm.watch('level');
  const watchedTechIds = manualForm.watch('techStacks') || [];

  const selectedRole = roles.find((r) => r._id === watchedRoleId);
  const selectedLevel = levels.find((l) => l._id === watchedLevelId);
  const selectedTechNames = technologies
    .filter((t) => watchedTechIds.includes(t._id))
    .map((t) => t.name);

  // Watch JD form values for live preview
  const watchedJdFile = jdForm.watch('jdFile');
  const jdFileName = watchedJdFile && watchedJdFile.length > 0 ? watchedJdFile[0].name : undefined;

  // Validation & disabled state for the unified CTA in SessionBriefCard
  const isSubmitDisabled =
    activeMode === SetupMode.MANUAL
      ? isLoading
      : isLoading || !jdFileName;

  const submitButtonText =
    activeMode === SetupMode.MANUAL
      ? t('setup.startInterview', 'Bắt Đầu Phỏng Vấn Ngay')
      : t('setup.analyzeJdAndStart', 'Phân Tích JD & Bắt Đầu Phỏng Vấn');

  const handleBriefSubmit = () => {
    if (activeMode === SetupMode.MANUAL) {
      manualForm.handleSubmit(onSubmitManual)();
    } else {
      jdForm.handleSubmit(onSubmitJd)();
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-5 p-4 bg-red-50/90 border border-red-200/80 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in zoom-in duration-300 shadow-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {isFetchingData ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
          </div>
          <p className="text-slate-500 font-medium mt-4 text-sm">{t('setup.loadingConfig', 'Đang tải cấu hình hệ thống...')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Configuration Workspace (col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200/60 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveMode(SetupMode.MANUAL)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeMode === SetupMode.MANUAL
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('setup.manualTab', 'Tùy Chỉnh Thủ Công')}
              </button>
              <button
                type="button"
                onClick={() => setActiveMode(SetupMode.JD_UPLOAD)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeMode === SetupMode.JD_UPLOAD
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t('setup.jdTab', 'Tải Lên JD')}
              </button>
            </div>

            {/* Active Mode Form Container */}
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/70 relative">
              {activeMode === SetupMode.MANUAL ? (
                <FormProvider {...manualForm}>
                  <ManualSetupTab
                    isLoading={isLoading}
                    roles={roles}
                    levels={levels}
                    technologies={technologies}
                    onSubmit={onSubmitManual}
                  />
                </FormProvider>
              ) : (
                <FormProvider {...jdForm}>
                  <JdUploadTab
                    isLoading={isLoading}
                    onSubmit={onSubmitJd}
                  />
                </FormProvider>
              )}
            </div>
          </div>

          {/* Right Column: Live Session Brief Card (col-span-5) */}
          <div className="lg:col-span-5 lg:sticky lg:top-6">
            <SessionBriefCard
              activeMode={activeMode}
              selectedRoleName={selectedRole?.name}
              selectedLevelName={selectedLevel?.name}
              selectedTechNames={selectedTechNames}
              jdFileName={jdFileName}
              isLoading={isLoading}
              disabled={isSubmitDisabled}
              onSubmit={handleBriefSubmit}
              submitButtonText={submitButtonText}
            />
          </div>
        </div>
      )}
    </div>
  );
};

