import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebcamPreview } from '../components/WebcamPreview';

describe('WebcamPreview', () => {
  afterEach(() => {
    cleanup();
  });

  const createVideoRef = () => ({
    current: document.createElement('video'),
  });

  const defaultProps = {
    videoRef: createVideoRef(),
    isActive: true,
    isCameraOn: true,
    isMicOn: true,
    audioLevel: 45,
    onToggleCamera: vi.fn(),
    onToggleMic: vi.fn(),
    error: null,
  };

  it('renders video element when active and camera is on', () => {
    const { container } = render(<WebcamPreview {...defaultProps} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(screen.getByText('Camera ứng viên')).toBeInTheDocument();
  });

  it('renders "Camera đã tắt" overlay when isCameraOn=false', () => {
    render(<WebcamPreview {...defaultProps} isCameraOn={false} />);
    expect(screen.getByText('Camera đã tắt')).toBeInTheDocument();
  });

  it('renders error message when error is present', () => {
    render(<WebcamPreview {...defaultProps} error="Không tìm thấy thiết bị camera." />);
    expect(screen.getByText('Không tìm thấy thiết bị camera.')).toBeInTheDocument();
  });

  it('calls onToggleCamera when camera button is clicked', () => {
    const onToggleCameraMock = vi.fn();
    render(<WebcamPreview {...defaultProps} onToggleCamera={onToggleCameraMock} />);
    const camBtn = screen.getByRole('button', { name: /Tắt camera|Bật camera/i });
    fireEvent.click(camBtn);
    expect(onToggleCameraMock).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleMic when mic button is clicked', () => {
    const onToggleMicMock = vi.fn();
    render(<WebcamPreview {...defaultProps} onToggleMic={onToggleMicMock} />);
    const micBtn = screen.getByRole('button', { name: /Tắt mic|Bật mic/i });
    fireEvent.click(micBtn);
    expect(onToggleMicMock).toHaveBeenCalledTimes(1);
  });

  it('displays audio level meter with correct style width', () => {
    const { container } = render(<WebcamPreview {...defaultProps} audioLevel={75} />);
    const meter = container.querySelector('[data-testid="audio-level-meter"]');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveStyle({ width: '75%' });
  });
});
