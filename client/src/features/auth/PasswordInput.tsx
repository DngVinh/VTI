import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';

interface PasswordInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
  visibilityLabel: string;
  wrapperClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { visibilityLabel, wrapperClassName = '', className = '', id, ...inputProps },
    ref,
  ) {
    const [isVisible, setIsVisible] = useState(false);
    const actionLabel = `${isVisible ? 'Ẩn' : 'Hiện'} ${visibilityLabel.toLowerCase()}`;

    return (
      <div className={`relative ${wrapperClassName}`}>
        <input
          aria-label={inputProps['aria-label'] || visibilityLabel}
          {...inputProps}
          id={id}
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          className={`${className} pr-12`}
        />
        <button
          type="button"
          aria-label={actionLabel}
          aria-controls={id}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          {isVisible ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.24A10.8 10.8 0 0112 4c5 0 8.27 4.11 9.36 6a2 2 0 010 2c-.46.8-1.31 2.02-2.54 3.1M6.23 6.23C4.49 7.43 3.3 9.05 2.64 10.2a2 2 0 000 2C3.73 14.09 7 18.2 12 18.2c.7 0 1.37-.08 2-.23"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.64 10.2C3.73 8.31 7 4.2 12 4.2s8.27 4.11 9.36 6a2 2 0 010 2C20.27 14.09 17 18.2 12 18.2s-8.27-4.11-9.36-6a2 2 0 010-2z"
              />
              <circle cx="12" cy="11.2" r="3" strokeWidth={2} />
            </svg>
          )}
        </button>
      </div>
    );
  },
);
