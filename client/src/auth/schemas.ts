import { z } from 'zod';

const utf8Max72 = (value: string) => new TextEncoder().encode(value).length <= 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email không đúng định dạng')
  .max(255, 'Email không được vượt quá 255 ký tự');

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .refine(utf8Max72, 'Mật khẩu không được vượt quá 72 byte');

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Mật khẩu là bắt buộc')
    .refine(utf8Max72, 'Mật khẩu không được vượt quá 72 byte'),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
    fullName: z
      .string()
      .trim()
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
      .max(100, 'Họ và tên không được vượt quá 100 ký tự'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: z
      .string()
      .trim()
      .length(6, 'Mã xác thực phải gồm 6 chữ số')
      .regex(/^\d{6}$/, 'Mã xác thực chỉ chứa chữ số'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(8, 'Mật khẩu hiện tại phải có ít nhất 8 ký tự')
      .refine(utf8Max72, 'Mật khẩu không được vượt quá 72 byte'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại',
    path: ['newPassword'],
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const PROFILE_LEVELS = [
  'FRESHER',
  'JUNIOR',
  'MIDDLE',
  'SENIOR',
  'LEAD',
  'MANAGER',
] as const;

export const PROFILE_LEVEL_OPTIONS = [
  { value: 'FRESHER', label: 'Fresher / Intern' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'MIDDLE', label: 'Middle' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'MANAGER', label: 'Manager / Director' },
] as const;

const httpUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL không được vượt quá 2048 ký tự')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL phải là đường dẫn tuyệt đối bắt đầu bằng http:// hoặc https://');

const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL không được vượt quá 2048 ký tự')
  .refine((value) => {
    if (value.startsWith('/uploads/') && !value.includes('..')) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL phải là đường dẫn tuyệt đối bắt đầu bằng http:// hoặc https:// hoặc đường dẫn /uploads/');

const optionalProfileUrl = z.union([z.literal(''), httpUrlSchema]);
const optionalAvatarUrl = z.union([z.literal(''), avatarUrlSchema]);

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100, 'Họ và tên không được vượt quá 100 ký tự'),
  avatarUrl: optionalAvatarUrl,
  currentLevel: z.union([z.literal(''), z.enum(PROFILE_LEVELS)]),
  githubUrl: optionalProfileUrl,
  linkedinUrl: optionalProfileUrl,
  bio: z.string().trim().max(500, 'Giới thiệu không được vượt quá 500 ký tự').optional().or(z.literal('')),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
