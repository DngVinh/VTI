import React from 'react';
import { useFormContext } from 'react-hook-form';
import type { JDUploadFormData } from '../types';
import { useTranslation } from '../../../locales/I18nContext';

interface JdUploadTabProps {
  isLoading: boolean;
  onSubmit: (data: JDUploadFormData) => void;
}

export const JdUploadTab: React.FC<JdUploadTabProps> = ({
  isLoading,
  onSubmit,
}) => {
  const form = useFormContext<JDUploadFormData>();
  const { t } = useTranslation();
  const watchFile = form.watch('jdFile');
  const hasFile = watchFile && watchFile.length > 0;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 animate-in fade-in duration-300">
      {/* File Upload Area */}
      <div>
        <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1 uppercase tracking-wider">
          {t('setup.jdUploadTitle', 'Upload Job Description (JD)')}
        </label>
        <p className="text-xs sm:text-sm text-slate-500 mb-3">
          {t('setup.jdUploadDesc', 'Tải lên file JD (PDF, DOCX) của bạn. AI sẽ tự động phân tích và sinh ra các câu hỏi phỏng vấn phù hợp nhất.')}
        </p>
        
        <div className="relative">
          <input
            type="file"
            id="jdFile"
            accept=".pdf,.docx"
            {...form.register('jdFile', { required: t('setup.requiredJdFile', 'Vui lòng chọn file JD') })}
            className="sr-only"
            disabled={isLoading}
          />
          <label
            htmlFor="jdFile"
            className={`flex flex-col items-center justify-center w-full h-36 sm:h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              hasFile
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center py-4 px-4 text-center">
              {hasFile ? (
                <>
                  <svg className="w-10 h-10 mb-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p className="mb-1 text-xs sm:text-sm font-semibold text-indigo-700 max-w-xs truncate">
                    {t('setup.selectedFile', 'Đã chọn file:')} {watchFile[0].name}
                  </p>
                  <p className="text-[11px] text-indigo-500 font-medium">{t('setup.clickToChangeFile', 'Click để thay đổi file khác')}</p>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8 mb-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="mb-1 text-xs sm:text-sm text-slate-600 font-medium">
                    <span className="font-bold text-indigo-600">{t('setup.clickToUpload', 'Click để tải lên')}</span> {t('setup.orDragDrop', 'hoặc kéo thả file vào đây')}
                  </p>
                  <p className="text-[11px] text-slate-500">{t('setup.supportedFormats', 'Hỗ trợ định dạng: PDF, DOCX (Tối đa 5MB)')}</p>
                </>
              )}
            </div>
          </label>
        </div>
        {form.formState.errors.jdFile && (
          <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-red-500"></span> {form.formState.errors.jdFile.message as string}
          </p>
        )}
      </div>
    </form>
  );
};
