import { useState } from 'react';
import {
  get,
  useForm,
  type FieldPath,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { toApiError, type ApiError } from '../../auth/types';
import { PasswordInput } from './PasswordInput';

interface AuthField<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  type: string;
  autoComplete: string;
}

interface Props<T extends FieldValues> {
  schema: ZodType<T, T>;
  fields: Array<AuthField<T>>;
  submitLabel: string;
  onSubmit: (values: T) => Promise<void>;
  serverError?: ApiError | null;
}

export function AuthForm<T extends FieldValues>({
  schema,
  fields,
  submitLabel,
  onSubmit,
  serverError,
}: Props<T>) {
  const [loading, setLoading] = useState(false);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<T>({ resolver: zodResolver(schema) as Resolver<T> });

  const submit = async (values: T) => {
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = toApiError(error);
      Object.entries(apiError.fieldErrors ?? {}).forEach(([name, message]) => {
        setError(name as FieldPath<T>, { message });
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-busy={loading}
      className="space-y-6"
    >
      {serverError?.message && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/90 p-4 text-sm font-medium text-red-700"
        >
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {serverError.message}
        </div>
      )}

      <fieldset disabled={loading} className="space-y-4 disabled:opacity-90">
        {fields.map((field) => {
          const fieldError = get(errors, field.name);
          const errorId = `${field.name}-error`;
          const hasError = Boolean(fieldError);
          const isPassword = field.type === 'password';
          const inputClassName = `w-full rounded-xl border px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 shadow-xs ${
            hasError
              ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
              : 'border-slate-300 bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
          }`;

          return (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                {field.label}
              </label>
              {isPassword ? (
                <PasswordInput
                  id={field.name}
                  visibilityLabel={field.label}
                  autoComplete={field.autoComplete}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? errorId : undefined}
                  className={inputClassName}
                  {...registerField(field.name)}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? errorId : undefined}
                  className={inputClassName}
                  {...registerField(field.name)}
                />
              )}
              {fieldError?.message && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-1.5 flex items-center gap-2 text-sm font-medium text-red-600"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                  {String(fieldError.message)}
                </p>
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={loading}
          className={`flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 active:scale-[0.99] ${
            loading
              ? 'cursor-not-allowed bg-slate-400'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/50'
          }`}
        >
          {loading ? (
            <>
              <svg
                className="mr-3 h-5 w-5 animate-spin text-white"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang xử lý…
            </>
          ) : (
            <>
              {submitLabel}
              <svg
                className="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </fieldset>
    </form>
  );
}
