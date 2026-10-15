import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ArchitectureCritiqueOverlay } from '../components/ArchitectureCritiqueOverlay';
import type { ArchitectureCritiqueData } from '../types';

afterEach(() => {
  cleanup();
});

describe('ArchitectureCritiqueOverlay (Micro-Task 4.7)', () => {
  const fakeCritique: ArchitectureCritiqueData = {
    detectedNodes: [
      { type: 'LOAD_BALANCER', label: 'ALB' },
      { type: 'DATABASE', label: 'Primary MySQL' },
    ],
    issues: [
      {
        type: 'SPOF',
        severity: 'HIGH',
        title: {
          vi: 'Điểm sập duy nhất tại Primary Database',
          en: 'SPOF at Primary Database',
        },
        description: {
          vi: 'Không có replica hoặc cụm failover.',
          en: 'No standby replica.',
        },
        targetBox: { x: 200, y: 150, width: 120, height: 80 },
        suggestedFix: {
          vi: 'Bổ sung Multi-AZ Standby.',
          en: 'Add Multi-AZ Standby.',
        },
      },
    ],
    tradeOffEvaluation: {
      vi: 'Cần cải thiện tính sẵn sàng Availability.',
      en: 'Needs improved Availability.',
    },
    score: 7.5,
  };

  it('renders overall score and Vietnamese evaluation summary', () => {
    render(<ArchitectureCritiqueOverlay critique={fakeCritique} onClose={vi.fn()} />);

    expect(screen.getByText(/7.5 \/ 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Cần cải thiện tính sẵn sàng Availability/i)).toBeInTheDocument();
  });

  it('renders bounding box marker for SPOF issue with high severity', () => {
    render(<ArchitectureCritiqueOverlay critique={fakeCritique} onClose={vi.fn()} />);

    expect(screen.getAllByText(/SPOF/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Điểm sập duy nhất tại Primary Database/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onCloseMock = vi.fn();
    render(<ArchitectureCritiqueOverlay critique={fakeCritique} onClose={onCloseMock} />);

    const closeBtn = screen.getByRole('button', { name: /Đóng/i });
    fireEvent.click(closeBtn);

    expect(onCloseMock).toHaveBeenCalledOnce();
  });
});
