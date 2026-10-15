import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton, CardSkeleton, TableSkeleton } from '../Skeleton';

describe('Skeleton Components (Micro-Task 4.4)', () => {
  it('renders base skeleton with pulse animation class', () => {
    const { container } = render(<Skeleton className="w-32 h-6" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('bg-slate-200');
  });

  it('renders CardSkeleton with title, paragraph, and badge placeholders', () => {
    const { container } = render(<CardSkeleton />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThanOrEqual(3);
  });

  it('renders TableSkeleton with specified row count', () => {
    const { container } = render(<TableSkeleton rows={4} columns={3} />);
    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
  });
});
