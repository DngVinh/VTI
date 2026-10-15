import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { InterviewPreflightModal } from '../components/InterviewPreflightModal';

describe('InterviewPreflightModal', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onReady: vi.fn(),
  };

  it('renders modal with title and 3 device test items when open', () => {
    render(<InterviewPreflightModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Kiểm tra thiết bị/i })).toBeInTheDocument();
    expect(screen.getByText('Microphone')).toBeInTheDocument();
    expect(screen.getByText('Loa / Tai nghe')).toBeInTheDocument();
    expect(screen.getByText('Camera')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<InterviewPreflightModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Kiểm tra thiết bị/i)).not.toBeInTheDocument();
  });

  it('calls onReady when "Bắt đầu phỏng vấn" is clicked', () => {
    const onReadyMock = vi.fn();
    render(<InterviewPreflightModal {...defaultProps} onReady={onReadyMock} />);
    const startBtn = screen.getByRole('button', { name: /Bắt đầu phỏng vấn/i });
    fireEvent.click(startBtn);
    expect(onReadyMock).toHaveBeenCalledTimes(1);
  });

  it('calls onReady when "Bỏ qua" is clicked', () => {
    const onReadyMock = vi.fn();
    render(<InterviewPreflightModal {...defaultProps} onReady={onReadyMock} />);
    const skipBtn = screen.getByRole('button', { name: /Bỏ qua/i });
    fireEvent.click(skipBtn);
    expect(onReadyMock).toHaveBeenCalledTimes(1);
  });
});
