import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AdaptiveDifficultyBadge } from '../components/AdaptiveDifficultyBadge';

afterEach(() => {
  cleanup();
});

describe('AdaptiveDifficultyBadge Component (Micro-Task 1.13)', () => {
  it('renders current difficulty label', () => {
    render(<AdaptiveDifficultyBadge difficulty="Medium" />);
    expect(screen.getByText(/Medium/i)).toBeInTheDocument();
  });

  it('renders upward trend indicator when adjustment is HARDER', () => {
    render(<AdaptiveDifficultyBadge difficulty="Medium" adjustment="HARDER" />);
    expect(screen.getByText(/Tăng/i)).toBeInTheDocument();
  });

  it('renders downward trend indicator when adjustment is EASIER', () => {
    render(<AdaptiveDifficultyBadge difficulty="Hard" adjustment="EASIER" />);
    expect(screen.getByText(/Hạ|Giảm/i)).toBeInTheDocument();
  });

  it('renders maintain indicator when adjustment is SAME', () => {
    render(<AdaptiveDifficultyBadge difficulty="Easy" adjustment="SAME" />);
    expect(screen.getByText(/Duy trì/i)).toBeInTheDocument();
  });
});
