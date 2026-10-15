import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from '../locales/I18nContext';

interface AuthLayoutProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Subtle background ambient gradient */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="h-[400px] w-[600px] bg-gradient-to-tr from-indigo-100/40 via-purple-50/30 to-blue-100/40 rounded-full blur-3xl opacity-70" />
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-indigo-300 group-hover:bg-indigo-700 transition-colors">
            V
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-slate-900 text-base leading-none tracking-tight">
              VTI AI Interview
            </span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
              Pro Platform
            </span>
          </div>
        </Link>
      </div>

      {/* Centered Main Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 sm:px-8 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Card Title & Subtitle */}
          {(title || subtitle) && (
            <div className="mb-6 text-center">
              {title && (
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
              )}
            </div>
          )}

          {/* Form Content */}
          {children || <Outlet />}
        </div>

        {/* Back to Home Link */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('auth.backToHome', 'Về trang chủ')}
          </Link>
        </div>
      </div>
    </div>
  );
};
