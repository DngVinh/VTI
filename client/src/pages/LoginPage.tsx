import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '../features/auth/AuthForm';
import { GoogleSignInButton } from '../features/auth/GoogleSignInButton';
import { loginSchema, type LoginInput } from '../auth/schemas';
import { login } from '../auth/apiClient';
import { setAccessToken, setRefreshToken } from '../auth/session';
import { useAuthStore } from '../auth/authStore';
import { roleLanding } from '../auth/routePolicy';
import { toApiError, type ApiError, type AuthResponse } from '../auth/types';
import { AuthLayout } from '../layouts/AuthLayout';
import { useTranslation } from '../locales/I18nContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [error, setError] = useState<ApiError | null>(null);
  const returnPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const handleAuthSuccess = (result: AuthResponse) => {
    setAccessToken(result.tokens.accessToken);
    setRefreshToken(result.tokens.refreshToken);
    useAuthStore.getState().setUser(result.user);
    navigate(returnPath ?? roleLanding(result.user.role), { replace: true });
  };

  return (
    <AuthLayout
      title={t('auth.signInBtn', 'Đăng nhập')}
      subtitle={t('auth.loginSubtitle', 'Tiếp tục hành trình luyện phỏng vấn cùng AI')}
    >
      <main aria-labelledby="login-title">
        <h1 id="login-title" className="sr-only">{t('auth.signInBtn', 'Đăng nhập')}</h1>

        <AuthForm<LoginInput>
          schema={loginSchema}
          fields={[
            { name: 'email', label: t('auth.emailLabel', 'Email'), type: 'email', autoComplete: 'email' },
            { name: 'password', label: t('auth.passwordLabel', 'Mật khẩu'), type: 'password', autoComplete: 'current-password' },
          ]}
          submitLabel={t('auth.signInBtn', 'Đăng nhập')}
          serverError={error}
          onSubmit={async (values) => {
            setError(null);
            try {
              const result = await login(values);
              handleAuthSuccess(result);
            } catch (requestError) {
              const apiError = toApiError(requestError);
              setError(apiError);
              throw apiError;
            }
          }}
        />

        <div className="mt-4 text-right">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
          >
            {t('auth.forgotPassword', 'Quên mật khẩu?')}
          </Link>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-white px-3 font-semibold text-slate-500">{t('common.or', 'hoặc')}</span>
          </div>
        </div>

        <GoogleSignInButton
          mode="signin"
          onSuccess={handleAuthSuccess}
          onError={(err) => setError(err)}
        />

        <p className="mt-6 border-t border-slate-100 pt-6 text-center text-sm font-medium text-slate-500">
          {t('auth.noAccount', 'Chưa có tài khoản?')}{' '}
          <Link to="/register" className="font-bold text-indigo-600 transition hover:text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30">
            {t('auth.signUpBtn', 'Đăng ký')}
          </Link>
        </p>
      </main>
    </AuthLayout>
  );
}
