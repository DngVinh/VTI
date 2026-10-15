import React from 'react';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'slate';
  text?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  text,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  const colorStyles = {
    primary: 'border-indigo-100 border-t-indigo-600',
    white: 'border-white/30 border-t-white',
    slate: 'border-slate-200 border-t-slate-600',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
      {...props}
    >
      <div
        className={`animate-spin rounded-full ${sizeStyles[size]} ${colorStyles[color]}`}
        aria-hidden="true"
      />
      {text && <p className="text-sm font-medium text-slate-500">{text}</p>}
      <span className="sr-only">{text || 'Đang tải...'}</span>
    </div>
  );
};
