import { useCallback, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { getProfile, logout, updateProfile, uploadAvatar } from '../auth/apiClient';
import { useAuthStore } from '../auth/authStore';
import {
  PROFILE_LEVEL_OPTIONS,
  profileSchema,
  type ProfileFormData,
} from '../auth/schemas';
import { toApiError, type ApiError } from '../auth/types';
import { AppShell } from '../layouts/AppShell';

const initialsFor = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)![0]}`.toUpperCase();
};

function ProfileAvatar({
  url,
  name,
  onUploadClick,
  onRemoveClick,
  isUploading,
}: {
  url: string;
  name: string;
  onUploadClick?: () => void;
  onRemoveClick?: () => void;
  isUploading?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedUrl(null);
  }, [url]);

  const initials = initialsFor(name);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div
        className="relative group cursor-pointer"
        onClick={onUploadClick}
        title="Nhấn để tải ảnh đại diện mới"
      >
        {url && failedUrl !== url ? (
          <img
            src={url}
            alt={`Ảnh đại diện của ${name}`}
            onError={() => setFailedUrl(url)}
            className="h-20 w-20 rounded-2xl border-2 border-white object-cover shadow-sm transition group-hover:opacity-85"
          />
        ) : (
          <div
            data-testid="avatar-fallback"
            aria-label={`Ảnh đại diện mặc định ${initials}`}
            className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white bg-indigo-600 text-2xl font-bold text-white shadow-sm transition group-hover:bg-indigo-700"
          >
            {initials}
          </div>
        )}

        {/* Hover overlay with camera icon */}
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col items-center sm:items-start gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Đang tải lên…</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Tải ảnh đại diện</span>
              </>
            )}
          </button>

          {url && (
            <button
              type="button"
              onClick={onRemoveClick}
              disabled={isUploading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Xóa ảnh</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500">Hỗ trợ JPG, PNG, WEBP, GIF tối đa 5MB</p>
      </div>
    </div>
  );
}


const emptyProfile: ProfileFormData = {
  fullName: '',
  avatarUrl: '',
  currentLevel: '',
  githubUrl: '',
  linkedinUrl: '',
  bio: '',
};

export function ProfilePage() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
  });

  const avatarUrl = useWatch({ control, name: 'avatarUrl' });
  const fullName = useWatch({ control, name: 'fullName' });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setAvatarError('Chỉ hỗ trợ tệp ảnh định dạng JPG, PNG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Dung lượng ảnh không được vượt quá 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setAvatarError(null);
    setSaved(false);
    try {
      const res = await uploadAvatar(file);
      setValue('avatarUrl', res.avatarUrl);
      setUser(res.user);
      setSaved(true);
    } catch (err) {
      setAvatarError(toApiError(err).message || 'Tải ảnh lên thất bại');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setValue('avatarUrl', '');
    setSaved(false);
    setAvatarError(null);
    try {
      const updated = await updateProfile({
        ...getValues(),
        avatarUrl: null,
      });
      setUser(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(toApiError(err));
    }
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getProfile();
      setUser(profile);
      reset({
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? '',
        currentLevel: profile.currentLevel ?? '',
        githubUrl: profile.githubUrl ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        bio: profile.bio ?? '',
      });
    } catch (error) {
      setLoadError(toApiError(error));
    } finally {
      setLoading(false);
    }
  }, [reset, setUser]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadProfile]);

  const submit = async (values: ProfileFormData) => {
    setSaved(false);
    setSaveError(null);
    try {
      const profile = await updateProfile({
        fullName: values.fullName.trim(),
        avatarUrl: values.avatarUrl?.trim() || null,
        currentLevel: values.currentLevel || null,
        githubUrl: values.githubUrl?.trim() || null,
        linkedinUrl: values.linkedinUrl?.trim() || null,
        bio: values.bio?.trim() || null,
      });
      setUser(profile);
      reset({
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? '',
        currentLevel: profile.currentLevel ?? '',
        githubUrl: profile.githubUrl ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        bio: profile.bio ?? '',
      });
      setSaved(true);
    } catch (error) {
      const apiError = toApiError(error);
      setSaveError(apiError);
      for (const [field, message] of Object.entries(apiError.fieldErrors ?? {})) {
        if (field in emptyProfile) {
          setError(field as keyof ProfileFormData, { type: 'server', message });
        }
      }
    }
  };

  const inputClass = (invalid: boolean) =>
    `mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
      invalid
        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-300 hover:border-slate-400 focus:border-indigo-500 focus:ring-indigo-100'
    }`;

  return (
    <AppShell>
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition"
          >
            ← Về trang chủ
          </Link>
          <button
            id="btn-logout"
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs" aria-labelledby="profile-title">
          <header className="flex flex-col items-center gap-5 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 p-6 sm:p-8 text-center sm:flex-row sm:text-left border-b border-slate-100">
            <ProfileAvatar
              url={typeof avatarUrl === 'string' ? avatarUrl : ''}
              name={fullName || authUser?.fullName || ''}
              onUploadClick={() => fileInputRef.current?.click()}
              onRemoveClick={handleRemoveAvatar}
              isUploading={uploadingAvatar}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Chọn tệp ảnh đại diện"
            />
            <div>
              <h1 id="profile-title" className="text-2xl sm:text-3xl font-extrabold text-slate-900">Hồ sơ cá nhân</h1>
              <p className="mt-1 text-sm text-slate-500">Thông tin dùng để cá nhân hóa trải nghiệm phỏng vấn và gợi ý lộ trình.</p>
            </div>
          </header>

          <div className="p-6 sm:p-8">
            {avatarError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                {avatarError}
              </div>
            )}

            {loading && <div role="status" aria-live="polite" className="py-12 text-center font-semibold text-slate-600">Đang tải hồ sơ…</div>}

            {!loading && loadError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-800">
                <p>{loadError.message}</p>
                <button type="button" onClick={() => void loadProfile()} className="mt-4 rounded-xl bg-red-700 px-4 py-2 font-bold text-white">Thử lại</button>
              </div>
            )}

            {!loading && !loadError && (
              <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
                {saved && <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800 text-sm">Cập nhật hồ sơ thành công</div>}
                {saveError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800 text-sm">{saveError.message}</div>}

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700">Email</label>
                    <input id="profile-email" type="email" value={authUser?.email ?? ''} disabled className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label htmlFor="profile-role" className="block text-xs font-bold uppercase tracking-wider text-slate-700">Vai trò</label>
                    <input id="profile-role" value={authUser?.role ?? ''} disabled className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500" />
                  </div>
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-slate-700">Họ và tên</label>
                  <input id="fullName" autoComplete="name" {...register('fullName')} aria-invalid={Boolean(errors.fullName)} className={inputClass(Boolean(errors.fullName))} />
                  {errors.fullName && <p role="alert" className="mt-1.5 text-xs text-red-600 font-medium">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label htmlFor="currentLevel" className="block text-xs font-bold uppercase tracking-wider text-slate-700">Trình độ hiện tại</label>
                  <select id="currentLevel" {...register('currentLevel')} aria-invalid={Boolean(errors.currentLevel)} className={inputClass(Boolean(errors.currentLevel))}>
                    <option value="">Chưa chọn</option>
                    {PROFILE_LEVEL_OPTIONS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                  </select>
                  {errors.currentLevel && <p role="alert" className="mt-1.5 text-xs text-red-600 font-medium">{errors.currentLevel.message}</p>}
                </div>

                {([
                  ['avatarUrl', 'Ảnh đại diện (URL)', 'https://example.com/avatar.jpg'],
                  ['githubUrl', 'GitHub URL', 'https://github.com/username'],
                  ['linkedinUrl', 'LinkedIn URL', 'https://linkedin.com/in/username'],
                ] as const).map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label htmlFor={field} className="block text-xs font-bold uppercase tracking-wider text-slate-700">{label}</label>
                    <input id={field} type="url" autoComplete="url" placeholder={placeholder} {...register(field)} aria-invalid={Boolean(errors[field])} className={inputClass(Boolean(errors[field]))} />
                    {errors[field] && <p role="alert" className="mt-1.5 text-xs text-red-600 font-medium">{errors[field]?.message}</p>}
                  </div>
                ))}

                <div>
                  <label htmlFor="bio" className="block text-xs font-bold uppercase tracking-wider text-slate-700">Giới thiệu bản thân</label>
                  <textarea
                    id="bio"
                    rows={3}
                    placeholder="Ví dụ: 3 năm kinh nghiệm backend, đam mê kiến trúc microservices…"
                    {...register('bio')}
                    aria-invalid={Boolean(errors.bio)}
                    className={`${inputClass(Boolean(errors.bio))} resize-none`}
                  />
                  {errors.bio && <p role="alert" className="mt-1.5 text-xs text-red-600 font-medium">{errors.bio.message}</p>}
                  <p className="mt-1 text-xs text-slate-500">Tối đa 500 ký tự. Hiển thị trong hồ sơ phỏng vấn của bạn.</p>
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to="/change-password"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 px-5 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100/70"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Đổi mật khẩu
                  </Link>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-sm text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
