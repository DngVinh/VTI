import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CodeWorkspace } from '../components/CodeWorkspace';

afterEach(() => {
  cleanup();
});

describe('CodeWorkspace Runner & Console (Micro-Task 3.8)', () => {
  const defaultProps = {
    value: 'console.log("Hello");',
    onChange: vi.fn(),
    language: 'javascript' as const,
    onLanguageChange: vi.fn(),
  };

  it('renders "Chạy mã" button and triggers onRunCode when clicked', () => {
    const onRunMock = vi.fn();
    render(<CodeWorkspace {...defaultProps} onRunCode={onRunMock} />);

    const runBtn = screen.getByRole('button', { name: /Chạy mã/i });
    expect(runBtn).toBeInTheDocument();

    fireEvent.click(runBtn);
    expect(onRunMock).toHaveBeenCalledOnce();
  });

  it('triggers onRunCode on Ctrl+Enter keyboard shortcut', () => {
    const onRunMock = vi.fn();
    render(<CodeWorkspace {...defaultProps} onRunCode={onRunMock} />);

    const editor = screen.getByLabelText('Khung soạn thảo mã nguồn');
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

    expect(onRunMock).toHaveBeenCalledOnce();
  });

  it('shows loading state while code is running', () => {
    render(<CodeWorkspace {...defaultProps} isRunning={true} onRunCode={vi.fn()} />);

    const runBtn = screen.getByRole('button', { name: /Đang chạy/i });
    expect(runBtn).toBeDisabled();
  });

  it('displays console output stdout when executionResult is provided', () => {
    const executionResult = {
      stdout: 'Kết quả: 42\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 15,
      memoryKb: 1024,
    };

    render(
      <CodeWorkspace
        {...defaultProps}
        onRunCode={vi.fn()}
        executionResult={executionResult}
      />
    );

    expect(screen.getByText(/Kết quả: 42/i)).toBeInTheDocument();
    expect(screen.getByText(/0 ms|15 ms/i)).toBeInTheDocument();
  });

  it('displays error message when error is provided', () => {
    render(
      <CodeWorkspace
        {...defaultProps}
        onRunCode={vi.fn()}
        error="Lỗi biên dịch: SyntaxError"
      />
    );

    expect(screen.getByText(/Lỗi biên dịch: SyntaxError/i)).toBeInTheDocument();
  });
});
