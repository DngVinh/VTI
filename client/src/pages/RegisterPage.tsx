import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '../features/auth/AuthForm';
import { GoogleSignInButton } from '../features/auth/GoogleSignInButton';
import { registerSchema, type RegisterInput } from '../auth/schemas';
import { register } from '../auth/apiClient';
import { setAccessToken, setRefreshToken } from '../auth/session';
import { useAuthStore } from '../auth/authStore';
import { roleLanding } from '../auth/routePolicy';
import { toApiError, type ApiError, type AuthResponse } from '../auth/types';
import { AuthLayout } from '../layouts/AuthLayout';
import { useTranslation } from '../locales/I18nContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<ApiError | null>(null);

  const handleAuthSuccess = (result: AuthResponse) => {
    setAccessToken(result.tokens.accessToken);
    setRefreshToken(result.tokens.refreshToken);
    useAuthStore.getState().setUser(result.user);
    navigate(roleLanding(result.user.role), { replace: true });
  };

  return (
    <AuthLayout
      title={t('auth.registerTitle', 'Đăng ký tài khoản')}
      subtitle={t('auth.registerSubtitle', 'Bắt đầu trải nghiệm luyện phỏng vấn thông minh cùng AI')}
    >
      <main aria-labelledby="register-title">
        <h1 id="register-title" className="sr-only">{t('auth.registerTitle', 'Đăng ký')}</h1>

        <AuthForm<RegisterInput>
          schema={registerSchema}
          fields={[
            { name: 'fullName', label: t('auth.fullNameLabel', 'Họ và tên'), type: 'text', autoComplete: 'name' },
            { name: 'email', label: t('auth.emailLabel', 'Email'), type: 'email', autoComplete: 'email' },
            { name: 'password', label: t('auth.passwordLabel', 'Mật khẩu'), type: 'password', autoComplete: 'new-password' },
            { name: 'confirmPassword', label: t('auth.confirmPasswordLabel', 'Nhập lại mật khẩu'), type: 'password', autoComplete: 'new-password' },
          ]}
          submitLabel={t('auth.signUpBtn', 'Đăng ký')}
          serverError={error}
          onSubmit={async (values) => {
            setError(null);
            try {
              const result = await register({
                email: values.email,
                password: values.password,
                fullName: values.fullName,
              });
              handleAuthSuccess(result);
            } catch (requestError) {
              const apiError = toApiError(requestError);
              setError(apiError);
              throw apiError;
            }
          }}
        />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-white px-3 font-semibold text-slate-500">{t('common.or', 'hoặc')}</span>
          </div>
        </div>

        <GoogleSignInButton
          mode="signup"
          onSuccess={handleAuthSuccess}
          onError={(err) => setError(err)}
        />

        <p className="mt-6 border-t border-slate-100 pt-6 text-center text-sm font-medium text-slate-500">
          {t('auth.haveAccount', 'Đã có tài khoản?')}{' '}
          <Link to="/login" className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30">
            {t('auth.signInBtn', 'Đăng nhập')}
          </Link>
        </p>
      </main>
    </AuthLayout>
  );
}
