import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { login, register } from '../../auth/apiClient';
import { useAuthStore } from '../../auth/authStore';
import { LoginPage } from '../../pages/LoginPage';
import { RegisterPage } from '../../pages/RegisterPage';

vi.mock('../../auth/apiClient', () => ({ login: vi.fn(), register: vi.fn(), googleLogin: vi.fn() }));

const candidate = {
  id: '1', email: 'candidate@example.com', fullName: 'Candidate', role: 'CANDIDATE' as const,
  status: 'ACTIVE' as const, createdAt: '',
};
const authResponse = {
  user: candidate,
  tokens: { accessToken: 'access', refreshToken: 'refresh' },
};

const renderPage = (path: '/login' | '/register') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/setup" element={<div>SETUP</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('auth pages', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    useAuthStore.setState({ user: null, bootstrapStatus: 'ready' });
  });

  it('shows accessible Login labels and client field errors without calling the API', async () => {
    const user = userEvent.setup();
    renderPage('/login');

    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('button', { name: /đăng nhập bằng google/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email không đúng định dạng')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu là bắt buộc')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('toggles Login password visibility without changing its value', async () => {
    const user = userEvent.setup();
    renderPage('/login');

    const passwordInput = screen.getByLabelText('Mật khẩu');
    await user.type(passwordInput, 'secret-password');

    expect(passwordInput).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveValue('secret-password');

    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('disables Login while submitting and sends Candidate to the role landing route', async () => {
    const user = userEvent.setup();
    let resolve!: (value: typeof authResponse) => void;
    vi.mocked(login).mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderPage('/login');

    await user.type(screen.getByLabelText('Email'), candidate.email);
    await user.type(screen.getByLabelText('Mật khẩu'), 'password');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();

    resolve(authResponse);
    expect(await screen.findByText('SETUP')).toBeInTheDocument();
  });

  it('shows Login server and canonical field errors', async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValue({
      message: 'Đăng nhập thất bại',
      fieldErrors: { email: 'Email không tồn tại' },
    });
    renderPage('/login');

    await user.type(screen.getByLabelText('Email'), candidate.email);
    await user.type(screen.getByLabelText('Mật khẩu'), 'password');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email không tồn tại')).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập thất bại')).toHaveAttribute('aria-live', 'polite');
  });

  it('validates Register fields and shows server field errors', async () => {
    const user = userEvent.setup();
    vi.mocked(register).mockRejectedValue({
      message: 'Đăng ký thất bại',
      fieldErrors: { email: 'Email đã được sử dụng' },
    });
    renderPage('/register');

    expect(screen.getByRole('button', { name: /đăng ký bằng google/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(await screen.findByText('Họ và tên phải có ít nhất 2 ký tự')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập lại mật khẩu')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Họ và tên'), 'A User');
    await user.type(screen.getByLabelText('Email'), candidate.email);
    await user.type(screen.getByLabelText('Mật khẩu'), 'password');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'password');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(await screen.findByText('Email đã được sử dụng')).toBeInTheDocument();
    expect(screen.getByText('Đăng ký thất bại')).toHaveAttribute('aria-live', 'polite');
  });

  it('blocks Register when password confirmation does not match', async () => {
    const user = userEvent.setup();
    renderPage('/register');

    await user.type(screen.getByLabelText('Họ và tên'), 'A User');
    await user.type(screen.getByLabelText('Email'), candidate.email);
    await user.type(screen.getByLabelText('Mật khẩu'), 'password');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(await screen.findByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('toggles Register password fields independently', async () => {
    const user = userEvent.setup();
    renderPage('/register');

    const passwordInput = screen.getByLabelText('Mật khẩu');
    const confirmationInput = screen.getByLabelText('Nhập lại mật khẩu');

    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmationInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Hiện nhập lại mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(confirmationInput).toHaveAttribute('type', 'text');
  });

  it('disables Register while submitting and navigates after success', async () => {
    const user = userEvent.setup();
    let resolve!: (value: typeof authResponse) => void;
    vi.mocked(register).mockImplementation(() => new Promise((done) => { resolve = done; }));
    renderPage('/register');

    await user.type(screen.getByLabelText('Họ và tên'), 'A User');
    await user.type(screen.getByLabelText('Email'), candidate.email);
    await user.type(screen.getByLabelText('Mật khẩu'), 'password');
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), 'password');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
    expect(register).toHaveBeenCalledWith({
      email: candidate.email,
      password: 'password',
      fullName: 'A User',
    });

    resolve(authResponse);
    expect(await screen.findByText('SETUP')).toBeInTheDocument();
  });

  it('provides navigation back home and between auth pages', () => {
    renderPage('/login');
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('href', '/register');

    cleanup();
    renderPage('/register');
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
  });

  it('renders English labels when I18nContext is English', async () => {
    const { I18nProvider } = await import('../../locales/I18nContext');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <I18nProvider defaultLocale="en">
          <LoginPage />
        </I18nProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign Up' })).toBeInTheDocument();
  });
});
