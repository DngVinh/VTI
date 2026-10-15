import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'elevated';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  hoverable = false,
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white border border-slate-200/80 shadow-xs',
    flat: 'bg-slate-50 border border-slate-200/60',
    elevated: 'bg-white border border-slate-100 shadow-md shadow-slate-200/50',
  };

  const hoverStyle = hoverable
    ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 cursor-pointer'
    : '';

  return (
    <div
      className={`rounded-2xl overflow-hidden ${variantStyles[variant]} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-6 border-b border-slate-100 ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`p-6 border-t border-slate-100 bg-slate-50/50 ${className}`}
    {...props}
  >
    {children}
  </div>
);
