import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RadarScoreChart } from '../components/RadarScoreChart';

describe('RadarScoreChart', () => {
  it('renders empty state correctly for both languages', () => {
    const { rerender } = render(<RadarScoreChart dimensions={[]} language="vi" />);
    expect(screen.getByText('Chưa có dữ liệu đánh giá')).toBeInTheDocument();

    rerender(<RadarScoreChart dimensions={[]} language="en" />);
    expect(screen.getByText('No evaluation data available')).toBeInTheDocument();
  });

  it('renders translated dimension labels in VI', () => {
    const mockDimensions = [
      { name: 'TECHNICAL_ACCURACY', score: 8, reasoning: 'Tốt' },
      { name: 'Technical Depth', score: 7, reasoning: 'Khá' },
      { name: 'Technical Accuracy & Architecture', score: 9, reasoning: 'Rất tốt' },
    ];

    const { container } = render(<RadarScoreChart dimensions={mockDimensions} language="vi" />);
    expect(container).toBeInTheDocument();
  });

  it('renders reasoning for dimensions with legacy string format', () => {
    const mockDimensions = [
      { name: 'Technical Depth', score: 8, reasoning: 'Legacy reasoning string' },
    ];
    render(<RadarScoreChart dimensions={mockDimensions} language="vi" />);
    expect(screen.getByText(/Legacy reasoning string/)).toBeInTheDocument();
  });

  it('renders localized reasoning according to active language', () => {
    const mockDimensions = [
      {
        name: 'Technical Depth',
        score: 9,
        reasoning: {
          vi: 'Lý giải chuyên môn tiếng Việt',
          en: 'Technical depth English explanation',
        },
      },
    ];
    const { rerender } = render(<RadarScoreChart dimensions={mockDimensions} language="vi" />);
    expect(screen.getByText(/Lý giải chuyên môn tiếng Việt/)).toBeInTheDocument();

    rerender(<RadarScoreChart dimensions={mockDimensions} language="en" />);
    expect(screen.getByText(/Technical depth English explanation/)).toBeInTheDocument();
  });
});
