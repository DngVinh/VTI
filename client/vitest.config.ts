import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: join(tmpdir(), 'vti-ai-interview-client-coverage'),
      include: [
        'src/auth/**/*.{ts,tsx}',
        'src/features/auth/**/*.{ts,tsx}',
        'src/features/InterviewRoom/hooks/useInterviewSSE.ts',
        'src/services/api/interviewApi.ts',
        'src/pages/LoginPage.tsx',
        'src/pages/RegisterPage.tsx',
        'src/pages/ProfilePage.tsx',
        'src/pages/ForgotPasswordPage.tsx',
        'src/pages/ResetPasswordPage.tsx',
        'src/pages/ChangePasswordPage.tsx',
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
