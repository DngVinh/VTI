import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { ChartErrorBoundary } from '../ChartErrorBoundary';

afterEach(() => {
  cleanup();
});

const BombComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Canvas render crashed');
  }
  return <div>Biểu đồ hiển thị bình thường</div>;
};

describe('ChartErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ChartErrorBoundary>
        <BombComponent shouldThrow={false} />
      </ChartErrorBoundary>
    );
    expect(screen.getByText('Biểu đồ hiển thị bình thường')).toBeInTheDocument();
  });

  it('catches render error and displays bilingual fallback', () => {
    // Suppress console.error in test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChartErrorBoundary language="vi">
        <BombComponent shouldThrow={true} />
      </ChartErrorBoundary>
    );

    expect(screen.getByText('Không thể tải biểu đồ')).toBeInTheDocument();
    expect(screen.getByText(/Đã xảy ra lỗi khi kết xuất/)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('displays English fallback when language is en', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ChartErrorBoundary language="en">
        <BombComponent shouldThrow={true} />
      </ChartErrorBoundary>
    );

    expect(screen.getByText('Unable to render chart')).toBeInTheDocument();
    expect(screen.getByText(/An error occurred while rendering/)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('supports retry recovery when user clicks retry button', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestParent = () => {
      const [hasError, setHasError] = useState(true);
      return (
        <ChartErrorBoundary language="vi" onReset={() => setHasError(false)}>
          <BombComponent shouldThrow={hasError} />
        </ChartErrorBoundary>
      );
    };

    render(<TestParent />);
    expect(screen.getByText('Không thể tải biểu đồ')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);

    expect(screen.getByText('Biểu đồ hiển thị bình thường')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
