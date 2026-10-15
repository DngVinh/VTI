import React, { useState } from 'react';
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { logout } from '../auth/apiClient';
import { Badge } from '../design-system';
import { useTranslation } from '../locales/I18nContext';

interface AppShellProps {
  children?: React.ReactNode;
}

interface NavItem {
  to: string;
  key: string;
  label: string;
  icon: React.ReactNode;
}

const CANDIDATE_NAV_ITEMS: NavItem[] = [
  {
    to: '/setup',
    key: 'practice',
    label: 'Luyện phỏng vấn',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/history',
    key: 'history',
    label: 'Lịch sử',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    key: 'analytics',
    label: 'Tiến độ',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/questions',
    key: 'questions',
    label: 'Ngân hàng câu hỏi',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    to: '/admin/metrics',
    key: 'adminDashboard',
    label: 'Dashboard',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    to: '/admin/users',
    key: 'adminUsers',
    label: 'Người dùng',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    to: '/admin/system-prompts',
    key: 'adminPrompts',
    label: 'Prompts',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/admin/question-bank',
    key: 'adminQuestionBank',
    label: 'Question Bank',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/questions',
    key: 'studyLibrary',
    label: 'Thư viện ôn tập',
    icon: (
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { locale, setLocale, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('')
    : 'U';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all [&>svg]:w-4 [&>svg]:h-4 ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-base font-medium transition-all [&>svg]:w-5 [&>svg]:h-5 ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  const activeNavItems = user?.role === 'ADMIN' ? ADMIN_NAV_ITEMS : CANDIDATE_NAV_ITEMS;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Sticky TopBar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-indigo-300 group-hover:bg-indigo-700 transition-colors">
                  V
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-slate-900 text-base leading-none tracking-tight">
                    VTI AI Interview
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    Pro Platform
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1.5 ml-4" aria-label="Main Navigation">
                {activeNavItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass}>
                    {item.icon}
                    {t('nav.' + item.key, item.label)}
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Right side: Language Switcher & User actions / Auth */}
            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200" role="group" aria-label="Language selection">
                <button
                  type="button"
                  onClick={() => setLocale('vi')}
                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                    locale === 'vi'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-label="Chuyển sang tiếng Việt"
                  aria-pressed={locale === 'vi'}
                >
                  🇻🇳 VI
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                    locale === 'en'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-label="Switch to English"
                  aria-pressed={locale === 'en'}
                >
                  🇬🇧 EN
                </button>
              </div>

              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-expanded={userDropdownOpen}
                    aria-label="Menu tài khoản"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="h-8 w-8 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {initials}
                      </div>
                    )}
                    <span className="hidden sm:block text-sm font-semibold text-slate-800 max-w-32 truncate">
                      {user.fullName}
                    </span>
                    <Badge variant={user.role === 'ADMIN' ? 'danger' : 'primary'} size="sm">
                      {user.role}
                    </Badge>
                  </button>

                  {/* Dropdown Menu */}
                  {userDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl shadow-slate-900/10 border border-slate-100 z-20 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-2 border-b border-slate-100 mb-1">
                          <p className="text-xs font-medium text-slate-500">{t('common.loginWith', 'Đăng nhập với')}</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
                        </div>
                        <Link
                          to="/profile"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <svg aria-hidden="true" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {t('nav.profile', 'Hồ sơ cá nhân')}
                        </Link>
                        <Link
                          to="/change-password"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <svg aria-hidden="true" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          {t('nav.changePassword', 'Đổi mật khẩu')}
                        </Link>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            void handleLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {t('nav.logout', 'Đăng xuất')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    {t('nav.login', 'Đăng nhập')}
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
                  >
                    {t('nav.register', 'Bắt đầu ngay')}
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                aria-expanded={mobileMenuOpen}
                aria-label="Menu"
              >
                <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Flyout Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 animate-in slide-in-from-top-2 duration-150">
            {activeNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={mobileNavLinkClass}
              >
                {item.icon}
                {t('nav.' + item.key, item.label)}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children || <Outlet />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">VTI AI Interview</span>
            <span>· Nền tảng luyện phỏng vấn kỹ thuật thông minh với AI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/questions" className="hover:text-indigo-600 transition-colors">
              Ngân hàng câu hỏi
            </Link>
            <Link to="/setup" className="hover:text-indigo-600 transition-colors">
              Phỏng vấn thử
            </Link>
            <span>© 2026 VTI Corporation</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
