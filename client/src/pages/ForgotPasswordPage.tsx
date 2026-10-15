import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../auth/schemas';
import { forgotPassword } from '../auth/apiClient';
import { toApiError, type ApiError } from '../auth/types';
import { AuthLayout } from '../layouts/AuthLayout';
import { useTranslation } from '../locales/I18nContext';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setServerError(null);
    setIsSuccess(false);
    try {
      await forgotPassword(values);
      setSubmittedEmail(values.email);
      setIsSuccess(true);
    } catch (err) {
      setServerError(toApiError(err));
    }
  };

  return (
    <AuthLayout
      title={t('auth.forgotPasswordTitle', 'Quên mật khẩu')}
      subtitle={t('auth.forgotPasswordSubtitle', 'Nhập email của bạn để nhận mã xác thực đặt lại mật khẩu')}
    >
      <main aria-labelledby="forgot-title">
        <h1 id="forgot-title" className="sr-only">
          {t('auth.forgotPasswordTitle', 'Quên mật khẩu')}
        </h1>

        {isSuccess ? (
          <div className="space-y-6">
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm font-medium text-emerald-800"
            >
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>{t('auth.forgotSuccessNotice', 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác thực để đặt lại mật khẩu.')}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/reset-password', { state: { email: submittedEmail } })}
              className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700"
            >
              {t('auth.enterOtpToReset', 'Nhập mã xác thực để đặt lại mật khẩu')}
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="text-sm font-semibold text-slate-500 hover:text-indigo-600"
              >
                {t('auth.resendWithOtherEmail', 'Gửi lại yêu cầu với email khác')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting} className="space-y-5">
            {serverError?.message && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/90 p-4 text-sm font-medium text-red-700"
              >
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {serverError.message}
              </div>
            )}

            <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-90">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('auth.emailLabel', 'Email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  placeholder="name@example.com"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 shadow-xs ${
                    errors.email
                      ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-300 bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                  }`}
                  {...register('email')}
                />
                {errors.email?.message && (
                  <p id="email-error" role="alert" className="mt-1.5 flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 active:scale-[0.99] ${
                  isSubmitting
                    ? 'cursor-not-allowed bg-slate-400'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/50'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="mr-3 h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('auth.sendingOtpBtn', 'Đang gửi yêu cầu…')}
                  </>
                ) : (
                  <>
                    {t('auth.sendOtpBtn', 'Gửi mã xác thực')}
                    <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </fieldset>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6 text-sm font-medium text-slate-500">
          <Link to="/login" className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline">
            {t('auth.backToLogin', 'Quay lại đăng nhập')}
          </Link>
          <Link to="/reset-password" className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline">
            {t('auth.alreadyHaveOtp', 'Đã có mã xác thực?')}
          </Link>
        </div>
      </main>
    </AuthLayout>
  );
}
