import React, { Component, type ReactNode } from 'react';

export interface ChartErrorBoundaryProps {
  children: ReactNode;
  language?: 'vi' | 'en';
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ChartErrorBoundary caught error:', error, errorInfo);
  }

  public handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const isEn = this.props.language === 'en';
      const title =
        this.props.fallbackTitle ||
        (isEn ? 'Unable to render chart' : 'Không thể tải biểu đồ');
      const message =
        this.props.fallbackMessage ||
        (isEn
          ? 'An error occurred while rendering this visualization. Please try refreshing.'
          : 'Đã xảy ra lỗi khi kết xuất biểu đồ trực quan này. Vui lòng thử lại.');
      const retryText = isEn ? 'Try Again' : 'Thử lại';

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl min-h-[200px] w-full"
        >
          <div className="w-10 h-10 mb-3 text-amber-500 bg-amber-50 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5"
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
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">{title}</h4>
          <p className="text-xs text-slate-500 max-w-sm mb-4">{message}</p>
          <button
            type="button"
            onClick={this.handleReset}
            aria-label={retryText}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {retryText}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
