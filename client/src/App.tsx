import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';

import { HomePage } from './pages/HomePage';
import { InterviewSetupPage } from './pages/InterviewSetupPage';
import { InterviewRoomPage } from './pages/InterviewRoomPage';

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

import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminMetricsPage } from './pages/AdminMetricsPage';
import { ResultPage } from './pages/ResultPage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import AdminSystemPromptsPage from './pages/AdminSystemPromptsPage';
import { QuestionLibraryListPage } from './pages/QuestionLibraryListPage';
import { QuestionStudyDetailPage } from './pages/QuestionStudyDetailPage';
import {
  QuestionAiAssistantPage,
  QuestionAnalyticsPage,
  QuestionBankListPage,
  QuestionEditorPage,
  QuestionImportExportPage,
  QuestionReviewDetailPage,
  QuestionReviewQueuePage,
  QuestionSelectionPage,
} from './features/QuestionBank';
import { featureFlags } from './config/featureFlags';

function App() {
  return (
    <Router>
      <AuthBootstrap>
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
                <Route path="/admin/question-bank/reviews" element={<QuestionReviewQueuePage />} />
                <Route path="/admin/question-bank/reviews/:questionVersionId" element={<QuestionReviewDetailPage />} />
                <Route path="/admin/question-bank/selection" element={<QuestionSelectionPage />} />
                <Route path="/admin/question-bank/analytics" element={<QuestionAnalyticsPage />} />
                <Route path="/admin/question-bank/import-export" element={<QuestionImportExportPage />} />
                <Route path="/admin/question-bank/ai-assistant" element={<QuestionAiAssistantPage />} />
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
      </AuthBootstrap>
    </Router>
  );
}

export default App;
