import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LiveAiInterviewerAvatar } from '../components/LiveAiInterviewerAvatar';

describe('LiveAiInterviewerAvatar (Micro-Task 5.8)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders avatar in idle state when AI is not speaking', () => {
    render(<LiveAiInterviewerAvatar isAiSpeaking={false} status="IDLE" />);

    expect(screen.getByTestId('live-ai-avatar')).toBeDefined();
    expect(screen.getByText('Sẵn sàng')).toBeDefined();
    expect(screen.queryByTestId('interrupt-button')).toBeNull();
  });

  it('renders speaking state and displays interrupt button when AI is speaking', () => {
    const onInterrupt = vi.fn();
    render(
      <LiveAiInterviewerAvatar
        isAiSpeaking={true}
        status="SPEAKING"
        onInterrupt={onInterrupt}
      />
    );

    expect(screen.getByText('AI đang nói...')).toBeDefined();
    const interruptBtn = screen.getByTestId('interrupt-button');
    expect(interruptBtn).toBeDefined();

    fireEvent.click(interruptBtn);
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it('renders listening state when candidate is speaking', () => {
    render(
      <LiveAiInterviewerAvatar
        isAiSpeaking={false}
        isCandidateSpeaking={true}
        status="LISTENING"
      />
    );

    expect(screen.getByText('Đang lắng nghe ứng viên...')).toBeDefined();
  });

  it('renders thinking state when AI status is THINKING', () => {
    render(
      <LiveAiInterviewerAvatar
        isAiSpeaking={false}
        status="THINKING"
      />
    );

    expect(screen.getByText('Đang suy nghĩ...')).toBeDefined();
  });

  it('renders dynamic waveform bars reflecting audio level', () => {
    render(
      <LiveAiInterviewerAvatar
        isAiSpeaking={true}
        audioLevel={0.8}
        status="SPEAKING"
      />
    );

    const bars = screen.getAllByTestId('avatar-waveform-bar');
    expect(bars.length).toBeGreaterThan(0);
  });
});
