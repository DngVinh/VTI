import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '../auth/schemas';
import { resetPassword } from '../auth/apiClient';
import { toApiError, type ApiError } from '../auth/types';
import { PasswordInput } from '../features/auth/PasswordInput';
import { AuthLayout } from '../layouts/AuthLayout';
import { useTranslation } from '../locales/I18nContext';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: initialEmail,
      otp: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ResetPasswordInput) => {
    setServerError(null);
    try {
      await resetPassword({
        email: values.email,
        otp: values.otp,
        newPassword: values.newPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      const apiError = toApiError(err);
      setServerError(apiError);
      if (apiError.fieldErrors) {
        for (const [field, message] of Object.entries(apiError.fieldErrors)) {
          if (field === 'email' || field === 'otp' || field === 'newPassword' || field === 'confirmPassword') {
            setError(field as keyof ResetPasswordInput, { message });
          }
        }
      }
    }
  };

  return (
    <AuthLayout
      title={t('auth.resetPasswordTitle', 'Đặt lại mật khẩu')}
      subtitle={t('auth.resetPasswordSubtitle', 'Nhập mã OTP 6 chữ số và mật khẩu mới của bạn')}
    >
      <main aria-labelledby="reset-title">
        <h1 id="reset-title" className="sr-only">
          {t('auth.resetPasswordTitle', 'Đặt lại mật khẩu')}
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
                <p>{t('auth.resetSuccessNotice', 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.')}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700"
            >
              {t('auth.loginNow', 'Đăng nhập ngay')}
              <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
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

              <div>
                <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('auth.otpLabel', 'Mã xác thực (OTP)')}
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  aria-invalid={Boolean(errors.otp)}
                  aria-describedby={errors.otp ? 'otp-error' : undefined}
                  placeholder="123456"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal tracking-widest text-slate-900 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 shadow-xs ${
                    errors.otp
                      ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-300 bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                  }`}
                  {...register('otp')}
                />
                {errors.otp?.message && (
                  <p id="otp-error" role="alert" className="mt-1.5 flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    {errors.otp.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('auth.newPasswordLabel', 'Mật khẩu mới')}
                </label>
                <PasswordInput
                  id="newPassword"
                  visibilityLabel={t('auth.newPasswordLabel', 'Mật khẩu mới')}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 shadow-xs ${
                    errors.newPassword
                      ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-300 bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                  }`}
                  {...register('newPassword')}
                />
                {errors.newPassword?.message && (
                  <p id="newPassword-error" role="alert" className="mt-1.5 flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('auth.confirmNewPasswordLabel', 'Xác nhận mật khẩu mới')}
                </label>
                <PasswordInput
                  id="confirmPassword"
                  visibilityLabel={t('auth.confirmNewPasswordLabel', 'Xác nhận mật khẩu mới')}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 shadow-xs ${
                    errors.confirmPassword
                      ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-300 bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                  }`}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword?.message && (
                  <p id="confirmPassword-error" role="alert" className="mt-1.5 flex items-center gap-2 text-sm font-medium text-red-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    {errors.confirmPassword.message}
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
                    {t('auth.resettingPasswordBtn', 'Đang xử lý…')}
                  </>
                ) : (
                  <>
                    {t('auth.resetPasswordBtn', 'Đặt lại mật khẩu')}
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
          <Link to="/forgot-password" className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline">
            {t('auth.haventReceivedOtp', 'Chưa nhận được mã?')}
          </Link>
        </div>
      </main>
    </AuthLayout>
  );
}
