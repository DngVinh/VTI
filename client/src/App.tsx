import { Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { AuthBootstrap } from './auth/AuthBootstrap';
import {
  GuestRoute,
  ProtectedRoute
} from './auth/ProtectedRoute';

import { featureFlags } from './config/featureFlags';
import { ToastProvider } from './design-system';
import { I18nProvider } from './locales/I18nContext';

// Route-level code splitting for heavy sub-pages
const InterviewSetupPage = lazy(() => import('./pages/InterviewSetupPage').then(m => ({ default: m.InterviewSetupPage })));
const InterviewRoomPage = lazy(() => import('./pages/InterviewRoomPage').then(m => ({ default: m.InterviewRoomPage })));
const ResultPage = lazy(() => import('./pages/ResultPage').then(m => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminMetricsPage = lazy(() => import('./pages/AdminMetricsPage').then(m => ({ default: m.AdminMetricsPage })));
const AdminSystemPromptsPage = lazy(() => import('./pages/AdminSystemPromptsPage'));
const QuestionLibraryListPage = lazy(() => import('./pages/QuestionLibraryListPage').then(m => ({ default: m.QuestionLibraryListPage })));
const QuestionStudyDetailPage = lazy(() => import('./pages/QuestionStudyDetailPage').then(m => ({ default: m.QuestionStudyDetailPage })));
const QuestionBankListPage = lazy(() => import('./features/QuestionBank').then(m => ({ default: m.QuestionBankListPage })));
const QuestionEditorPage = lazy(() => import('./features/QuestionBank').then(m => ({ default: m.QuestionEditorPage })));

const RouteLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <Router>
      <I18nProvider>
        <ToastProvider>
        <AuthBootstrap>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
            <Route
              path="/"
              element={<HomePage />}
            />

            <Route
              path="/questions"
              element={<QuestionLibraryListPage />}
            />

            <Route
              path="/questions/:id"
              element={<QuestionStudyDetailPage />}
            />

            <Route element={<GuestRoute />}>
              <Route
                path="/login"
                element={<LoginPage />}
              />

              <Route
                path="/register"
                element={<RegisterPage />}
              />

              <Route
                path="/forgot-password"
                element={<ForgotPasswordPage />}
              />

              <Route
                path="/reset-password"
                element={<ResetPasswordPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[
                    'CANDIDATE',
                    'INTERVIEWER',
                    'ADMIN'
                  ]}
                />
              }
            >
              <Route
                path="/profile"
                element={<ProfilePage />}
              />

              <Route
                path="/change-password"
                element={<ChangePasswordPage />}
              />

              <Route
                path="/admin/users"
                element={<AdminUsersPage />}
              />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  allowedRoles={['ADMIN']}
                />
              }
            >
              <Route
                path="/admin/metrics"
                element={<AdminMetricsPage />}
              />

              <Route
                path="/admin/system-prompts"
                element={<AdminSystemPromptsPage />}
              />
              {featureFlags.questionBankAdminUi && (
                <>
                  <Route path="/admin/question-bank" element={<QuestionBankListPage />} />
                  <Route path="/admin/question-bank/questions/new" element={<QuestionEditorPage />} />
                  <Route path="/admin/question-bank/questions/:questionId" element={<QuestionEditorPage />} />
                  <Route path="/admin/question-bank/questions/:questionId/edit" element={<QuestionEditorPage />} />
                </>
              )}
            </Route>

            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[
                    'CANDIDATE',
                    'INTERVIEWER'
                  ]}
                />
              }
            >
              <Route
                path="/setup"
                element={<InterviewSetupPage />}
              />

              <Route
                path="/history"
                element={<HistoryPage />}
              />

              <Route
                path="/analytics"
                element={<AnalyticsPage />}
              />

              <Route
                path="/interview/:sessionId"
                element={<InterviewRoomPage />}
              />

              <Route
                path="/interview/:sessionId/result"
                element={<ResultPage />}
              />
            </Route>
          </Routes>
          </Suspense>
        </AuthBootstrap>
      </ToastProvider>
    </I18nProvider>
  </Router>
  );
}

export default App;
