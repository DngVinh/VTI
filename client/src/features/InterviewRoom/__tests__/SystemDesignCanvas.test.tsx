import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SystemDesignCanvas } from '../components/SystemDesignCanvas';

afterEach(() => {
  cleanup();
});

describe('SystemDesignCanvas (Micro-Task 4.6)', () => {
  it('renders architecture components toolbar and canvas area', () => {
    render(
      <SystemDesignCanvas
        nodes={[]}
        edges={[]}
        onAddNode={vi.fn()}
        onAddEdge={vi.fn()}
        onSubmitSnapshot={vi.fn()}
      />
    );

    expect(screen.getByText(/Bảng vẽ Kiến trúc Hệ thống/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm Database/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm Cache/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm Queue/i })).toBeInTheDocument();
  });

  it('triggers onAddNode when toolbar component button is clicked', () => {
    const onAddNodeMock = vi.fn();
    render(
      <SystemDesignCanvas
        nodes={[]}
        edges={[]}
        onAddNode={onAddNodeMock}
        onAddEdge={vi.fn()}
        onSubmitSnapshot={vi.fn()}
      />
    );

    const dbBtn = screen.getByRole('button', { name: /Thêm Database/i });
    fireEvent.click(dbBtn);

    expect(onAddNodeMock).toHaveBeenCalledWith('DATABASE', 'Database', expect.any(Number), expect.any(Number));
  });

  it('renders nodes on canvas with labels', () => {
    const nodes = [
      { id: 'n-1', type: 'LOAD_BALANCER', label: 'AWS ALB', x: 50, y: 50 },
      { id: 'n-2', type: 'DATABASE', label: 'Postgres Master', x: 250, y: 50 },
    ];

    render(
      <SystemDesignCanvas
        nodes={nodes}
        edges={[]}
        onAddNode={vi.fn()}
        onAddEdge={vi.fn()}
        onSubmitSnapshot={vi.fn()}
      />
    );

    expect(screen.getByText('AWS ALB')).toBeInTheDocument();
    expect(screen.getByText('Postgres Master')).toBeInTheDocument();
  });

  it('triggers onSubmitSnapshot when critique button is clicked', () => {
    const onSubmitMock = vi.fn();
    render(
      <SystemDesignCanvas
        nodes={[{ id: 'n-1', type: 'SERVICE', label: 'Core API', x: 100, y: 100 }]}
        edges={[]}
        onAddNode={vi.fn()}
        onAddEdge={vi.fn()}
        onSubmitSnapshot={onSubmitMock}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Phản biện kiến trúc/i });
    fireEvent.click(submitBtn);

    expect(onSubmitMock).toHaveBeenCalledOnce();
  });
});
