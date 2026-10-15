import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplexityMetricsBadge } from '../components/ComplexityMetricsBadge';

describe('ComplexityMetricsBadge (Micro-Task 3.9)', () => {
  it('renders O(1) complexity with optimal badge style', () => {
    render(
      <ComplexityMetricsBadge
        metrics={{
          estimatedTimeComplexity: 'O(1)',
          estimatedSpaceComplexity: 'O(1)',
          cyclomaticComplexity: 1,
          maxLoopNesting: 0,
          hasRecursion: false,
          detectedSmells: [],
        }}
      />
    );

    expect(screen.getByText('O(1)')).toBeInTheDocument();
    expect(screen.getByText(/Tối ưu/i)).toBeInTheDocument();
  });

  it('renders O(N^2) complexity with warning badge style and loop nesting count', () => {
    render(
      <ComplexityMetricsBadge
        metrics={{
          estimatedTimeComplexity: 'O(N^2)',
          estimatedSpaceComplexity: 'O(1)',
          cyclomaticComplexity: 4,
          maxLoopNesting: 2,
          hasRecursion: false,
          detectedSmells: [],
        }}
      />
    );

    expect(screen.getByText('O(N^2)')).toBeInTheDocument();
    expect(screen.getByText(/Cần tối ưu|Cảnh báo/i)).toBeInTheDocument();
    expect(screen.getByText(/Lặp lồng: 2/i)).toBeInTheDocument();
  });

  it('displays recursion flag when hasRecursion is true', () => {
    render(
      <ComplexityMetricsBadge
        metrics={{
          estimatedTimeComplexity: 'O(2^N)',
          estimatedSpaceComplexity: 'O(N)',
          cyclomaticComplexity: 3,
          maxLoopNesting: 0,
          hasRecursion: true,
          detectedSmells: [],
        }}
      />
    );

    expect(screen.getByText(/Đệ quy/i)).toBeInTheDocument();
  });
});
