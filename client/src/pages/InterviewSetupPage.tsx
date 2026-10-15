import React from 'react';
import { InterviewSetupForm } from '../features/InterviewSetup';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

export const InterviewSetupPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Studio Compact Header */}
        <div className="mb-4 sm:mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            {t('setup.badge', 'Studio Thiết Lập Phỏng Vấn AI')}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {t('setup.title', 'Khởi tạo phiên luyện tập phỏng vấn')}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl font-normal">
            {t('setup.subtitle', 'Tùy chọn kỹ năng mục tiêu hoặc tải lên JD công việc để AI thiết lập bộ đề chuẩn hóa theo tiêu chuẩn hội đồng kỹ thuật.')}
          </p>
        </div>

        <div>
          <InterviewSetupForm />
        </div>
      </div>
    </AppShell>
  );
};
