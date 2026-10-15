import { useEffect, useRef, useState, useCallback } from 'react';
import type { AuthResponse, ApiError } from '../../auth/types';
import { toApiError } from '../../auth/types';
import { googleLogin } from '../../auth/apiClient';
import { initializeGoogleIdentity } from '../../auth/googleIdentity';

export interface GoogleSignInButtonProps {
  onSuccess?: (authResponse: AuthResponse) => void;
  onError?: (error: ApiError) => void;
  mode?: 'signin' | 'signup';
  disabled?: boolean;
  className?: string;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  mode = 'signin',
  disabled = false,
  className = '',
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isGisRendered, setIsGisRendered] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);

  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const buttonText = mode === 'signup' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google';

  const handleCredential = useCallback(
    async (credential: string) => {
      if (!credential) {
        const error: ApiError = {
          message: 'Không nhận được thông tin xác thực từ Google',
          status: 400,
        };
        setLocalError(error.message);
        onErrorRef.current?.(error);
        return;
      }

      setIsLoading(true);
      setLocalError(null);

      try {
        const result = await googleLogin({ credential });
        onSuccessRef.current?.(result);
      } catch (requestError) {
        const apiError = toApiError(requestError);
        setLocalError(apiError.message);
        onErrorRef.current?.(apiError);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!clientId) {
      return;
    }

    let cleanupGsi: (() => void) | undefined;
    let isCancelled = false;

    const init = async () => {
      try {
        cleanupGsi = await initializeGoogleIdentity({
          client_id: clientId,
          callback: (response) => {
            if (!isCancelled) {
              void handleCredential(response.credential ?? '');
            }
          },
        });

        if (isCancelled) {
          cleanupGsi?.();
          return;
        }

        if (buttonContainerRef.current && window.google?.accounts?.id) {
          window.google.accounts.id.renderButton(buttonContainerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: mode === 'signup' ? 'signup_with' : 'signin_with',
            shape: 'rectangular',
            width: '100%',
          });
          // Check if GIS injected an iframe into container
          if (buttonContainerRef.current.children.length > 0) {
            setIsGisRendered(true);
          }
        }
      } catch {
        // Nếu load script thất bại hoặc bị chặn, giữ nút fallback
      }
    };

    init();

    return () => {
      isCancelled = true;
      if (cleanupGsi) {
        cleanupGsi();
      }
    };
  }, [clientId, mode, handleCredential]);

  const handleManualClick = () => {
    if (disabled || isLoading || !clientId) {
      return;
    }

    setLocalError(null);
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch {
        // Bỏ qua lỗi prompt
      }
    }
  };

  if (!clientId) {
    return (
      <div className={`w-full ${className}`}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label={buttonText}
          title="Tính năng đăng nhập Google chưa được cấu hình"
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed opacity-60 shadow-xs"
        >
          <GoogleIcon />
          <span>{buttonText}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full">
        <div
          ref={buttonContainerRef}
          className="w-full flex justify-center"
          aria-hidden={isLoading}
        />
        {!isGisRendered && (
          <button
            type="button"
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            aria-label={buttonText}
            onClick={handleManualClick}
            className={`w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 ${
              isLoading ? 'opacity-70 cursor-wait' : ''
            }`}
          >
            <GoogleIcon />
            <span>{isLoading ? 'Đang xử lý…' : buttonText}</span>
          </button>
        )}
      </div>
      {localError && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 text-center text-sm font-medium text-rose-600"
        >
          {localError}
        </p>
      )}
    </div>
  );
}
