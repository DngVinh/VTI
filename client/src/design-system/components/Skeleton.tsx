import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  circle = false,
  ...props
}) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 ${
        circle ? 'rounded-full' : 'rounded-md'
      } ${className}`}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="w-1/3 h-6" />
        <Skeleton className="w-16 h-5 rounded-full" />
      </div>
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-4/5 h-4" />
      <div className="pt-2 flex gap-2">
        <Skeleton className="w-20 h-8 rounded-lg" />
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div aria-hidden="true" className="w-full overflow-hidden border border-slate-200 rounded-xl">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-4">
                <Skeleton className="w-24 h-4" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="p-4">
                  <Skeleton className={`h-4 ${c === 0 ? 'w-36' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
