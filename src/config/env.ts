import { z } from 'zod';
import dotenv from 'dotenv';

export const isPlaceholder = (value: string): boolean =>
  /replace[-_ ]?with|change[-_ ]?me|placeholder|default[_-]|your[-_ ]|example|dummy|^test(?:[-_ ]|$)/i.test(value) ||
  /^(.)\1+$/.test(value);

const placeholderSecrets = new Set([
  'replace-with-at-least-32-random-characters',
  'replace-with-another-at-least-32-random-characters',
  'replace-with-password-reset-secret-at-least-32-chars',
]);

const placeholderSmtpValues = new Set([
  'smtp.example.com',
  'replace-with-smtp-user',
  'replace-with-smtp-password',
  'no-reply@example.com',
]);

const expiresInRegex = /^(\d+)(ms|s|m|h|d|w|y)?$/i;
const byteSizeRegex = /^(\d+)(b|kb|mb)$/i;

const booleanFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .default(defaultValue)
    .transform((value) => value === 'true' || value === '1');

const byteSizeSchema = (name: string, defaultValue: string, maxBytes: number) =>
  z
    .string()
    .trim()
    .regex(byteSizeRegex, `${name} must use a size such as 256kb or 1mb`)
    .optional()
    .default(defaultValue)
    .transform((value) => {
      const match = byteSizeRegex.exec(value);
      if (!match) {
        return 0;
      }

      const amount = Number(match[1]);
      const unit = match[2].toLowerCase();
      const multiplier = unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1;
      return amount * multiplier;
    })
    .refine((value) => value >= 1024 && value <= maxBytes, {
      message: `${name} must be between 1kb and ${
        maxBytes >= 1024 * 1024 ? `${maxBytes / (1024 * 1024)}mb` : `${maxBytes / 1024}kb`
      }`,
    });

const corsAllowedOriginsSchema = z
  .string()
  .optional()
  .default('')
  .transform((rawValue, ctx) => {
    const origins = rawValue
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const normalizedOrigins: string[] = [];

    for (const origin of origins) {
      if (origin.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CORS_ALLOWED_ORIGINS does not support wildcard origins',
        });
        continue;
      }

      try {
        const parsed = new URL(origin);
        const hasUnexpectedParts =
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.username !== '' ||
          parsed.password !== '' ||
          parsed.pathname !== '/' ||
          parsed.search !== '' ||
          parsed.hash !== '';

        if (hasUnexpectedParts) {
          throw new Error('invalid origin');
        }

        normalizedOrigins.push(parsed.origin);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `CORS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`,
        });
      }
    }

    return [...new Set(normalizedOrigins)];
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ALLOWED_ORIGINS: corsAllowedOriginsSchema,
    JSON_BODY_LIMIT: byteSizeSchema('JSON_BODY_LIMIT', '256kb', 2 * 1024 * 1024),
    FORM_BODY_LIMIT: byteSizeSchema('FORM_BODY_LIMIT', '64kb', 512 * 1024),
    TRUST_PROXY_HOPS: z
      .string()
      .optional()
      .default('0')
      .transform((value) => Number(value))
      .refine((value) => Number.isInteger(value) && value >= 0 && value <= 5, {
        message: 'TRUST_PROXY_HOPS must be an integer between 0 and 5',
      }),
    PORT: z
      .string()
      .optional()
      .default('3000')
      .transform((val) => {
        const port = parseInt(val, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error('PORT must be a valid port number between 1 and 65535');
        }
        return port;
      }),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .default('mongodb://127.0.0.1:27017/ai_interview_practice'),
    GEMINI_API_KEY: z.string().optional().default(''),
    RETENTION_MUTATION_ENABLED: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
    RETENTION_APPROVAL_ID: z.string().regex(/^(?:|POLICY-[A-Z0-9-]{3,60})$/).default(''),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .regex(expiresInRegex, 'JWT_ACCESS_EXPIRES_IN must be a valid duration (e.g. 15m, 1h, 7d)')
      .default('1d'),
    JWT_REFRESH_EXPIRES_IN: z
      .string()
      .regex(expiresInRegex, 'JWT_REFRESH_EXPIRES_IN must be a valid duration (e.g. 7d, 30d, 1y)')
      .default('7d'),
    BCRYPT_SALT_ROUNDS: z
      .string()
      .optional()
      .default('12')
      .transform((val) => {
        const rounds = parseInt(val, 10);
        if (isNaN(rounds) || rounds < 10 || rounds > 14) {
          throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 14');
        }
        return rounds;
      }),
    PASSWORD_RESET_SECRET: z
      .string()
      .min(32, 'PASSWORD_RESET_SECRET must be at least 32 characters long')
      .default('default_password_reset_secret_key_at_least_32_characters_long_12345'),
    GOOGLE_CLIENT_ID: z.string().trim().optional().default(''),
    SMTP_HOST: z.string().trim().min(1, 'SMTP_HOST cannot be empty').optional().default('localhost'),
    SMTP_PORT: z
      .string()
      .optional()
      .default('587')
      .transform((val) => {
        const port = parseInt(val, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error('SMTP_PORT must be a valid port number between 1 and 65535');
        }
        return port;
      }),
    SMTP_SECURE: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .default('false')
      .transform((val) => val === 'true' || val === '1'),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    SMTP_FROM: z.string().trim().min(1, 'SMTP_FROM cannot be empty').optional().default('no-reply@vti.com.vn'),

    // QUO-01: Daily interview quota
    DAILY_INTERVIEW_QUOTA: z
      .string()
      .optional()
      .default('5')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('DAILY_INTERVIEW_QUOTA must be a positive integer');
        }
        return limit;
      }),
    QUOTA_TIMEZONE: z
      .string()
      .trim()
      .min(1, 'QUOTA_TIMEZONE cannot be empty')
      .default('Asia/Ho_Chi_Minh'),

    // QUO-01: Technical rate limiting
    RATE_LIMIT_LOGIN_MAX: z
      .string()
      .optional()
      .default('10')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('RATE_LIMIT_LOGIN_MAX must be a positive integer');
        }
        return limit;
      }),
    RATE_LIMIT_LOGIN_WINDOW_MS: z
      .string()
      .optional()
      .default('60000')
      .transform((val) => {
        const window = parseInt(val, 10);
        if (isNaN(window) || window < 1000) {
          throw new Error('RATE_LIMIT_LOGIN_WINDOW_MS must be at least 1000');
        }
        return window;
      }),

    RATE_LIMIT_REGISTER_MAX: z
      .string()
      .optional()
      .default('5')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('RATE_LIMIT_REGISTER_MAX must be a positive integer');
        }
        return limit;
      }),
    RATE_LIMIT_REGISTER_WINDOW_MS: z
      .string()
      .optional()
      .default('600000')
      .transform((val) => {
        const window = parseInt(val, 10);
        if (isNaN(window) || window < 1000) {
          throw new Error('RATE_LIMIT_REGISTER_WINDOW_MS must be at least 1000');
        }
        return window;
      }),

    RATE_LIMIT_CREATE_INTERVIEW_MAX: z
      .string()
      .optional()
      .default('10')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('RATE_LIMIT_CREATE_INTERVIEW_MAX must be a positive integer');
        }
        return limit;
      }),
    RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS: z
      .string()
      .optional()
      .default('600000')
      .transform((val) => {
        const window = parseInt(val, 10);
        if (isNaN(window) || window < 1000) {
          throw new Error('RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS must be at least 1000');
        }
        return window;
      }),

    RATE_LIMIT_AI_MAX: z
      .string()
      .optional()
      .default('5')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('RATE_LIMIT_AI_MAX must be a positive integer');
        }
        return limit;
      }),
    RATE_LIMIT_AI_WINDOW_MS: z
      .string()
      .optional()
      .default('60000')
      .transform((val) => {
        const window = parseInt(val, 10);
        if (isNaN(window) || window < 1000) {
          throw new Error('RATE_LIMIT_AI_WINDOW_MS must be at least 1000');
        }
        return window;
      }),

    RATE_LIMIT_SUBMIT_MAX: z
      .string()
      .optional()
      .default('10')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('RATE_LIMIT_SUBMIT_MAX must be a positive integer');
        }
        return limit;
      }),
    RATE_LIMIT_SUBMIT_WINDOW_MS: z
      .string()
      .optional()
      .default('60000')
      .transform((val) => {
        const window = parseInt(val, 10);
        if (isNaN(window) || window < 1000) {
          throw new Error('RATE_LIMIT_SUBMIT_WINDOW_MS must be at least 1000');
        }
        return window;
      }),

    RATE_LIMIT_PROGRESS_MAX: z
      .string()
      .optional()
      .default('30')
      .transform((val) => {
        const limit = parseInt(val, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('RATE_LIMIT_PROGRESS_MAX must be a positive integer');
        }
        return limit;
      }),
    RATE_LIMIT_PROGRESS_WINDOW_MS: z
      .string()
      .optional()
      .default('60000')
      .transform((val) => {
        const window = parseInt(val, 10);
        if (isNaN(window) || window < 1000) {
          throw new Error('RATE_LIMIT_PROGRESS_WINDOW_MS must be at least 1000');
        }
        return window;
      }),

    // Question Bank rollout and provider policy. All operational features are
    // disabled by default and must be enabled explicitly per environment.
    QUESTION_BANK_ADMIN_API_ENABLED: booleanFlag('false'),
    QUESTION_BANK_ADMIN_UI_ENABLED: booleanFlag('false'),
    QUESTION_BANK_REVIEW_FOUR_EYES: booleanFlag('true'),
    QUESTION_BANK_AI_TRANSLATION_ENABLED: booleanFlag('false'),
    QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED: booleanFlag('false'),
    QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED: booleanFlag('false'),
    QUESTION_BANK_AI_PROVIDER: z.enum(['gemini', 'mock']).optional().default('gemini'),
    QUESTION_BANK_AI_MODEL: z.string().trim().min(1).optional().default('gemini-2.5-flash'),
    QUESTION_BANK_TRANSLATION_MODEL: z.string().trim().min(1).optional().default('gemini-2.5-flash'),
    QUESTION_BANK_EMBEDDING_MODEL: z.string().trim().min(1).optional().default('text-embedding-004'),
    QUESTION_BANK_EMBEDDING_DIMENSIONS: z
      .string()
      .optional()
      .default('768')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0 && val <= 4096, {
        message: 'QUESTION_BANK_EMBEDDING_DIMENSIONS must be an integer between 1 and 4096',
      }),
    QUESTION_BANK_AI_TIMEOUT_MS: z
      .string()
      .optional()
      .default('10000')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1000 && val <= 60000, {
        message: 'QUESTION_BANK_AI_TIMEOUT_MS must be between 1000ms and 60000ms',
      }),
    QUESTION_BANK_AI_MAX_RETRIES: z
      .string()
      .optional()
      .default('2')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 0 && val <= 5, {
        message: 'QUESTION_BANK_AI_MAX_RETRIES must be between 0 and 5',
      }),
    QUESTION_BANK_SEMANTIC_THRESHOLD: z
      .string()
      .optional()
      .default('0.75')
      .transform((val) => parseFloat(val))
      .refine((val) => !isNaN(val) && val >= 0.5 && val <= 0.99, {
        message: 'QUESTION_BANK_SEMANTIC_THRESHOLD must be a float between 0.5 and 0.99',
      }),
    QUESTION_BANK_DUPLICATE_TOP_K: z
      .string()
      .optional()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 20, {
        message: 'QUESTION_BANK_DUPLICATE_TOP_K must be an integer between 1 and 20',
      }),
    INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED: booleanFlag('false'),
    INTERVIEW_QUESTION_SOURCE_MODE: z
      .enum(['AI_ONLY', 'SHADOW', 'BANK_ONLY', 'HYBRID'])
      .optional()
      .default('AI_ONLY'),
    INTERVIEW_QUESTION_COUNT: z
      .string()
      .optional()
      .default('5')
      .transform((val) => parseInt(val, 10))
      .refine((val) => val === 5, {
        message: 'INTERVIEW_QUESTION_COUNT must be 5 in Phase 5',
      }),
    INTERVIEW_QUESTION_BANK_POLICY_VERSION: z.string().optional().default('v1'),
    INTERVIEW_QUESTION_BANK_MIN_AVAILABLE: z
      .string()
      .optional()
      .default('5')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 50, {
        message: 'INTERVIEW_QUESTION_BANK_MIN_AVAILABLE must be between 1 and 50',
      }),
    INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT: z
      .string()
      .optional()
      .default('2')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 5, {
        message: 'INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT must be between 1 and 5',
      }),
    INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS: z
      .string()
      .optional()
      .default('3000')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 10 && val <= 30000, {
        message: 'INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS must be between 10 and 30000',
      }),
    INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI: booleanFlag('true'),
    INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT: z
      .string()
      .optional()
      .default('100')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 0 && val <= 100, {
        message: 'INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT must be an integer between 0 and 100',
      }),
    INTERVIEW_QUESTION_BANK_ROLLOUT_SALT: z.string().trim().min(1).optional().default('qb-rollout-salt'),
    QUESTION_SOURCING_TELEMETRY_ENABLED: booleanFlag('true'),
    QUESTION_SOURCING_EVENT_RETENTION_DAYS: z
      .string()
      .optional()
      .default('90')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 7 && val <= 365, {
        message: 'QUESTION_SOURCING_EVENT_RETENTION_DAYS must be between 7 and 365 days',
      }),

    // AI Interview Upgrade (AIU) Configuration
    AIU_FOLLOW_UP_ENABLED: booleanFlag('true'),
    AIU_MAX_FOLLOW_UPS_PER_QUESTION: z
      .string()
      .optional()
      .default('3')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 5, {
        message: 'AIU_MAX_FOLLOW_UPS_PER_QUESTION must be between 1 and 5',
      }),
    AIU_FOLLOW_UP_TIMEOUT_MS: z
      .string()
      .optional()
      .default('15000')
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val >= 1000 && val <= 60000, {
        message: 'AIU_FOLLOW_UP_TIMEOUT_MS must be between 1000 and 60000',
      }),
    AIU_MULTI_AGENT_EVALUATION_ENABLED: booleanFlag('false'),
    AIU_SANDBOX_ENABLED: booleanFlag('false'),
    AIU_VISION_ANALYSIS_ENABLED: booleanFlag('false'),
    AIU_GEMINI_LIVE_ENABLED: booleanFlag('false'),
  })
  .superRefine((data, ctx) => {
    if (data.RETENTION_MUTATION_ENABLED && !data.RETENTION_APPROVAL_ID) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['RETENTION_APPROVAL_ID'], message: 'Approved Product/Legal policy reference required' });
    }
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
        path: ['JWT_REFRESH_SECRET'],
      });
    }

    if (data.PASSWORD_RESET_SECRET === data.JWT_ACCESS_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASSWORD_RESET_SECRET and JWT_ACCESS_SECRET must be different',
        path: ['PASSWORD_RESET_SECRET'],
      });
    }

    if (data.PASSWORD_RESET_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASSWORD_RESET_SECRET and JWT_REFRESH_SECRET must be different',
        path: ['PASSWORD_RESET_SECRET'],
      });
    }

    if (data.NODE_ENV === 'production') {
      let mongoPassword = '';
      try {
        const uri = new URL(data.MONGODB_URI);
        mongoPassword = decodeURIComponent(uri.password);
        if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol) || !uri.username || !mongoPassword ||
            uri.pathname === '/' || !uri.pathname || isPlaceholder(uri.username) || isPlaceholder(mongoPassword) ||
            ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname)) throw new Error();
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MONGODB_URI'],
          message: 'MONGODB_URI must specify a production database and non-placeholder runtime credentials' });
      }
      const credentials: Record<string, string> = {
        JWT_ACCESS_SECRET: data.JWT_ACCESS_SECRET, JWT_REFRESH_SECRET: data.JWT_REFRESH_SECRET,
        PASSWORD_RESET_SECRET: data.PASSWORD_RESET_SECRET, SMTP_PASS: data.SMTP_PASS,
        GEMINI_API_KEY: data.GEMINI_API_KEY, MONGODB_URI: mongoPassword,
      };
      const used = new Set<string>();
      for (const [name, value] of Object.entries(credentials)) {
        if (!value.trim() || isPlaceholder(value) || value !== value.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: `${name} requires a non-placeholder production secret` });
        }
        if (value && used.has(value)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: 'Production credentials must be different for every purpose' });
        }
        used.add(value);
      }
      if (data.CORS_ALLOWED_ORIGINS.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CORS_ALLOWED_ORIGINS must contain at least one origin in production',
          path: ['CORS_ALLOWED_ORIGINS'],
        });
      }

      for (const origin of data.CORS_ALLOWED_ORIGINS) {
        const parsedOrigin = new URL(origin);
        const hostname = parsedOrigin.hostname.toLowerCase();
        if (parsedOrigin.protocol !== 'https:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CORS_ALLOWED_ORIGINS must use HTTPS in production',
            path: ['CORS_ALLOWED_ORIGINS'],
          });
        }
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CORS_ALLOWED_ORIGINS cannot contain loopback origins in production',
            path: ['CORS_ALLOWED_ORIGINS'],
          });
        }
      }

      if (placeholderSecrets.has(data.JWT_ACCESS_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_ACCESS_SECRET cannot use default placeholder in production',
          path: ['JWT_ACCESS_SECRET'],
        });
      }

      if (placeholderSecrets.has(data.JWT_REFRESH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_REFRESH_SECRET cannot use default placeholder in production',
          path: ['JWT_REFRESH_SECRET'],
        });
      }

      if (
        placeholderSecrets.has(data.PASSWORD_RESET_SECRET) ||
        data.PASSWORD_RESET_SECRET === 'default_password_reset_secret_key_at_least_32_characters_long_12345'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PASSWORD_RESET_SECRET cannot use default placeholder in production',
          path: ['PASSWORD_RESET_SECRET'],
        });
      }

      if (!data.SMTP_HOST || data.SMTP_HOST === 'localhost') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_HOST is required in production',
          path: ['SMTP_HOST'],
        });
      }

      if (!data.SMTP_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_USER is required in production',
          path: ['SMTP_USER'],
        });
      }

      if (!data.SMTP_PASS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_PASS is required in production',
          path: ['SMTP_PASS'],
        });
      }

      if (!data.SMTP_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_FROM is required in production',
          path: ['SMTP_FROM'],
        });
      }

      if (placeholderSmtpValues.has(data.SMTP_HOST)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_HOST cannot use an example placeholder in production',
          path: ['SMTP_HOST'],
        });
      }

      if (placeholderSmtpValues.has(data.SMTP_USER)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_USER cannot use an example placeholder in production',
          path: ['SMTP_USER'],
        });
      }

      if (placeholderSmtpValues.has(data.SMTP_PASS)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_PASS cannot use an example placeholder in production',
          path: ['SMTP_PASS'],
        });
      }

      if (placeholderSmtpValues.has(data.SMTP_FROM)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_FROM cannot use an example placeholder in production',
          path: ['SMTP_FROM'],
        });
      }
    }
  });

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  CORS_ALLOWED_ORIGINS: string[];
  JSON_BODY_LIMIT: number;
  FORM_BODY_LIMIT: number;
  TRUST_PROXY_HOPS: number;
  PORT: number;
  MONGODB_URI: string;
  GEMINI_API_KEY: string;
  RETENTION_MUTATION_ENABLED: boolean;
  RETENTION_APPROVAL_ID: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
  PASSWORD_RESET_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;

  // QUO-01: Daily quota
  DAILY_INTERVIEW_QUOTA: number;
  QUOTA_TIMEZONE: string;

  // QUO-01: Rate limiting
  RATE_LIMIT_LOGIN_MAX: number;
  RATE_LIMIT_LOGIN_WINDOW_MS: number;

  RATE_LIMIT_REGISTER_MAX: number;
  RATE_LIMIT_REGISTER_WINDOW_MS: number;

  RATE_LIMIT_CREATE_INTERVIEW_MAX: number;
  RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS: number;

  RATE_LIMIT_AI_MAX: number;
  RATE_LIMIT_AI_WINDOW_MS: number;

  RATE_LIMIT_SUBMIT_MAX: number;
  RATE_LIMIT_SUBMIT_WINDOW_MS: number;

  RATE_LIMIT_PROGRESS_MAX: number;
  RATE_LIMIT_PROGRESS_WINDOW_MS: number;

  QUESTION_BANK_ADMIN_API_ENABLED: boolean;
  QUESTION_BANK_ADMIN_UI_ENABLED: boolean;
  QUESTION_BANK_REVIEW_FOUR_EYES: boolean;
  QUESTION_BANK_AI_TRANSLATION_ENABLED: boolean;
  QUESTION_BANK_SEMANTIC_DUPLICATES_ENABLED: boolean;
  QUESTION_BANK_EMBEDDING_BACKFILL_ENABLED: boolean;
  QUESTION_BANK_AI_PROVIDER: 'gemini' | 'mock';
  QUESTION_BANK_AI_MODEL: string;
  QUESTION_BANK_TRANSLATION_MODEL: string;
  QUESTION_BANK_EMBEDDING_MODEL: string;
  QUESTION_BANK_EMBEDDING_DIMENSIONS: number;
  QUESTION_BANK_AI_TIMEOUT_MS: number;
  QUESTION_BANK_AI_MAX_RETRIES: number;
  QUESTION_BANK_SEMANTIC_THRESHOLD: number;
  QUESTION_BANK_DUPLICATE_TOP_K: number;
  INTERVIEW_QUESTION_BANK_INTEGRATION_ENABLED: boolean;
  INTERVIEW_QUESTION_SOURCE_MODE: 'AI_ONLY' | 'SHADOW' | 'BANK_ONLY' | 'HYBRID';
  INTERVIEW_QUESTION_COUNT: number;
  INTERVIEW_QUESTION_BANK_POLICY_VERSION: string;
  INTERVIEW_QUESTION_BANK_MIN_AVAILABLE: number;
  INTERVIEW_QUESTION_BANK_HYBRID_BANK_COUNT: number;
  INTERVIEW_QUESTION_BANK_SHADOW_TIMEOUT_MS: number;
  INTERVIEW_QUESTION_BANK_ALLOW_FALLBACK_TO_AI: boolean;
  INTERVIEW_QUESTION_BANK_ROLLOUT_PERCENT: number;
  INTERVIEW_QUESTION_BANK_ROLLOUT_SALT: string;
  QUESTION_SOURCING_TELEMETRY_ENABLED: boolean;
  QUESTION_SOURCING_EVENT_RETENTION_DAYS: number;

  // AI Interview Upgrade (AIU) Configuration
  AIU_FOLLOW_UP_ENABLED: boolean;
  AIU_MAX_FOLLOW_UPS_PER_QUESTION: number;
  AIU_FOLLOW_UP_TIMEOUT_MS: number;
  AIU_MULTI_AGENT_EVALUATION_ENABLED: boolean;
  AIU_SANDBOX_ENABLED: boolean;
  AIU_VISION_ANALYSIS_ENABLED: boolean;
  AIU_GEMINI_LIVE_ENABLED: boolean;
}

let dotenvLoaded = false;
export const getEnv = (): AppEnv => {
  if (!dotenvLoaded && !['production', 'test'].includes(process.env.NODE_ENV ?? '')) {
    dotenv.config({ quiet: true });
    dotenvLoaded = true;
  }
  if (process.env.NODE_ENV === 'production') {
    const forbidden = ['MONGODB_MIGRATION_URI', 'MONGO_MIGRATION_PASSWORD', 'DEPLOY_TOKEN', 'DEPLOY_SSH_KEY',
      'SERVER_SSH_KEY', 'SERVER_PASSWORD', 'GITHUB_TOKEN', 'GH_TOKEN', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
      'AZURE_CLIENT_SECRET', 'GOOGLE_APPLICATION_CREDENTIALS'];
    if (forbidden.some(key => Boolean(process.env[key]))) {
      throw new Error('Environment validation failed: deploy/migration credentials must not enter the application process');
    }
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorMessages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Environment validation failed: ${errorMessages}`);
  }
  return result.data as AppEnv;
};
