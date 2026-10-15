import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LearningPathView } from '../components/LearningPathView';

describe('LearningPathView', () => {
  const mockPath = [
    {
      topic: { vi: 'Hệ thống phân tán', en: 'Distributed Systems' },
      priority: 'high',
      suggestion: { vi: 'Học Kafka', en: 'Learn Kafka' },
    },
  ];

  it('renders correctly in Vietnamese', () => {
    render(<LearningPathView learningPath={mockPath} language="vi" />);
    expect(screen.getByText('Lộ trình học tập đề xuất')).toBeInTheDocument();
    expect(screen.getByText('Hệ thống phân tán')).toBeInTheDocument();
    expect(screen.getByText(/Ưu tiên: Cao/)).toBeInTheDocument();
  });

  it('renders correctly in English without Vietnamese priority leak', () => {
    render(<LearningPathView learningPath={mockPath} language="en" />);
    expect(screen.getByText('Recommended Learning Path')).toBeInTheDocument();
    expect(screen.getByText('Distributed Systems')).toBeInTheDocument();
    expect(screen.getByText(/Priority: High/)).toBeInTheDocument();
  });
});
