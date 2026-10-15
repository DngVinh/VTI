import type { ApiError, AuthResponse, User } from './types';
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './session';
import { authBridge } from './authStore';

const configuredBase = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const apiRoot = configuredBase.endsWith('/api/v1') ? configuredBase : `${configuredBase}/api/v1`;
const normalizePath = (path: string) => path.replace(/^\/+/, '');
const endpoint = (path: string) => `${apiRoot}/${normalizePath(path)}`;
const AUTH_ENDPOINTS = new Set([
  'auth/register',
  'auth/login',
  'auth/google',
  'auth/refresh',
  'auth/logout',
  'auth/password/forgot',
  'auth/password/reset',
]);

let refreshPromise: Promise<AuthResponse> | null = null;

const invalidateSession = () => {
  clearSession();
  authBridge.clearAuth();
};

const parseError = async (response: Response): Promise<ApiError> => {
  const payload = await response.json().catch(() => ({}));
  const errors: Array<{ field?: string; message?: string }> = Array.isArray(payload?.errors)
    ? payload.errors
    : [];
  const fieldErrors = errors.reduce<Record<string, string>>((result, item) => {
    if (item.field && item.message) result[item.field] = item.message;
    return result;
  }, {});

  return {
    message: payload?.message ?? 'Yêu cầu thất bại',
    code: payload?.code,
    fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    status: response.status,
  };
};

const refresh = async (): Promise<AuthResponse> => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw { message: 'Phiên đăng nhập đã hết hạn', status: 401 } satisfies ApiError;

    const response = await fetch(endpoint('auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) throw await parseError(response);

    const result = (await response.json()) as { data: AuthResponse };
    setAccessToken(result.data.tokens.accessToken);
    setRefreshToken(result.data.tokens.refreshToken);
    authBridge.setUser(result.data.user);
    return result.data;
  } catch (error) {
    invalidateSession();
    throw error;
  }
};

export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = refresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export interface ApiResponseMetadata<T> {
  data: T;
  etag: string | null;
  requestId: string | null;
  status: number;
}

export const authenticatedFetch = async (
  path: string,
  init: RequestInit = {},
  canRetry = true
): Promise<Response> => {
  const headers = new Headers(init.headers);
  const accessToken = getAccessToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(endpoint(path), { ...init, headers });

  if (response.status === 401 && canRetry) {
    await refreshSession();
    return authenticatedFetch(path, init, false);
  }
  if (response.status === 401 && !canRetry) invalidateSession();
  return response;
};

export const requestWithMetadata = async <T>(
  path: string,
  init: RequestInit = {},
  canRetry = true
): Promise<ApiResponseMetadata<T>> => {
  const normalizedPath = normalizePath(path);
  const method = (init.method ?? 'GET').toUpperCase();
  const noRefresh = AUTH_ENDPOINTS.has(normalizedPath.toLowerCase());
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const accessToken = getAccessToken();
  if (accessToken && !noRefresh) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(endpoint(normalizedPath), { ...init, headers });
  if (response.ok) {
    if (response.status === 204) {
      return {
        data: undefined as T,
        etag: response.headers.get('ETag'),
        requestId: response.headers.get('X-Request-Id'),
        status: response.status,
      };
    }
    const body = (await response.json()) as { data?: T; requestId?: string };
    return {
      data: (body.data ?? body) as T,
      etag: response.headers.get('ETag'),
      requestId: body.requestId ?? response.headers.get('X-Request-Id'),
      status: response.status,
    };
  }

  if (response.status === 401 && canRetry && !noRefresh && method !== 'OPTIONS') {
    await refreshSession();
    return requestWithMetadata<T>(normalizedPath, init, false);
  }

  if (response.status === 401 && !canRetry && !noRefresh) invalidateSession();
  throw await parseError(response);
};

export const request = async <T>(path: string, init: RequestInit = {}, canRetry = true): Promise<T> => {
  const response = await requestWithMetadata<T>(path, init, canRetry);
  return response.data;
};

export const login = (body: unknown) =>
  request<AuthResponse>('auth/login', { method: 'POST', body: JSON.stringify(body) });

export const googleLogin = (body: { credential: string }) =>
  request<AuthResponse>('auth/google', { method: 'POST', body: JSON.stringify(body) });

export const register = (body: unknown) =>
  request<AuthResponse>('auth/register', { method: 'POST', body: JSON.stringify(body) });

export const logout = async () => {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await request<null>('auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    invalidateSession();
  }
};

export const forgotPassword = (body: unknown) =>
  request<null>('auth/password/forgot', { method: 'POST', body: JSON.stringify(body) });

export const resetPassword = (body: unknown) =>
  request<null>('auth/password/reset', { method: 'POST', body: JSON.stringify(body) });

export const changePassword = (body: unknown) =>
  request<null>('auth/password', { method: 'PATCH', body: JSON.stringify(body) });

export const getProfile = () => request<User>('profile');

export const updateProfile = (body: unknown) =>
  request<User>('profile', { method: 'PATCH', body: JSON.stringify(body) });

export const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return request<{ avatarUrl: string; user: User }>('profile/avatar', {
    method: 'POST',
    body: formData,
  });
};

