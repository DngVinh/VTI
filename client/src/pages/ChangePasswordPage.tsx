import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '../auth/schemas';
import { changePassword } from '../auth/apiClient';
import { clearSession } from '../auth/session';
import { authBridge } from '../auth/authStore';
import { toApiError, type ApiError } from '../auth/types';
import { PasswordInput } from '../features/auth/PasswordInput';
import { AppShell } from '../layouts/AppShell';
import { useTranslation } from '../locales/I18nContext';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<ApiError | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    setServerError(null);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      // Clear local session and redirect to login
      clearSession();
      authBridge.clearAuth();
      navigate('/login', {
        replace: true,
        state: { message: t('auth.passwordChangedSuccess', 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.') },
      });
    } catch (err) {
      const apiError = toApiError(err);
      setServerError(apiError);
      if (apiError.fieldErrors) {
        for (const [field, message] of Object.entries(apiError.fieldErrors)) {
          if (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword') {
            setError(field as keyof ChangePasswordInput, { message });
          }
        }
      }
    }
  };

  return (
    <AppShell>
      <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <Link
          to="/profile"
          className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 transition hover:text-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {t('auth.backToProfile', 'Quay lại hồ sơ')}
        </Link>

        <section
          className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs"
          aria-labelledby="change-password-title"
        >
          <header className="bg-gradient-to-r from-indigo-50/60 to-purple-50/40 px-6 py-8 text-center sm:text-left border-b border-slate-100">
            <h1 id="change-password-title" className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {t('auth.changePasswordTitle', 'Đổi mật khẩu')}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t('auth.changePasswordSubtitle', 'Cập nhật mật khẩu để bảo vệ an toàn cho tài khoản của bạn')}
            </p>
          </header>

          <div className="p-6 sm:p-8">
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

              <fieldset disabled={isSubmitting} className="space-y-5 disabled:opacity-90">
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {t('auth.currentPasswordLabel', 'Mật khẩu hiện tại')}
                  </label>
                  <PasswordInput
                    id="currentPassword"
                    visibilityLabel={t('auth.currentPasswordLabel', 'Mật khẩu hiện tại')}
                    wrapperClassName="mt-1.5"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.currentPassword)}
                    aria-describedby={errors.currentPassword ? 'currentPassword-error' : undefined}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
                      errors.currentPassword
                        ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 bg-white focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                    {...register('currentPassword')}
                  />
                  {errors.currentPassword?.message && (
                    <p id="currentPassword-error" role="alert" className="mt-1.5 text-xs text-red-600 font-medium">
                      {errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {t('auth.newPasswordLabel', 'Mật khẩu mới')}
                  </label>
                  <PasswordInput
                    id="newPassword"
                    visibilityLabel={t('auth.newPasswordLabel', 'Mật khẩu mới')}
                    wrapperClassName="mt-1.5"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.newPassword)}
                    aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
                      errors.newPassword
                        ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 bg-white focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                    {...register('newPassword')}
                  />
                  {errors.newPassword?.message && (
                    <p id="newPassword-error" role="alert" className="mt-1.5 text-xs text-red-600 font-medium">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {t('auth.confirmNewPasswordLabel', 'Xác nhận mật khẩu mới')}
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    visibilityLabel={t('auth.confirmNewPasswordLabel', 'Xác nhận mật khẩu mới')}
                    wrapperClassName="mt-1.5"
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
                      errors.confirmPassword
                        ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 bg-white focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword?.message && (
                    <p id="confirmPassword-error" role="alert" className="mt-1.5 text-xs text-red-600 font-medium">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-sm text-white shadow-xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {isSubmitting ? t('auth.savingBtn', 'Đang lưu…') : t('auth.changePasswordBtn', 'Cập nhật mật khẩu')}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
