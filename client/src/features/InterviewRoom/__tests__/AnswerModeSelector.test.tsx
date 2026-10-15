import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnswerModeSelector } from '../components/AnswerModeSelector';

describe('AnswerModeSelector', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders 3 modes: Văn bản, Code, STAR', () => {
    render(<AnswerModeSelector activeMode="text" onModeChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Văn bản/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /STAR/i })).toBeInTheDocument();
  });

  it('applies active styling to the currently selected mode', () => {
    render(<AnswerModeSelector activeMode="code" onModeChange={vi.fn()} />);
    const codeBtn = screen.getByRole('button', { name: /Code/i });
    expect(codeBtn.className).toContain('bg-white');
    expect(codeBtn.className).toContain('text-indigo-700');
  });

  it('calls onModeChange with "code" when Code button is clicked', () => {
    const onModeChangeMock = vi.fn();
    render(<AnswerModeSelector activeMode="text" onModeChange={onModeChangeMock} />);
    const codeBtn = screen.getByRole('button', { name: /Code/i });
    fireEvent.click(codeBtn);
    expect(onModeChangeMock).toHaveBeenCalledWith('code');
  });

  it('calls onModeChange with "star" when STAR button is clicked', () => {
    const onModeChangeMock = vi.fn();
    render(<AnswerModeSelector activeMode="text" onModeChange={onModeChangeMock} />);
    const starBtn = screen.getByRole('button', { name: /STAR/i });
    fireEvent.click(starBtn);
    expect(onModeChangeMock).toHaveBeenCalledWith('star');
  });

  it('calls onModeChange with "text" when Văn bản button is clicked', () => {
    const onModeChangeMock = vi.fn();
    render(<AnswerModeSelector activeMode="code" onModeChange={onModeChangeMock} />);
    const textBtn = screen.getByRole('button', { name: /Văn bản/i });
    fireEvent.click(textBtn);
    expect(onModeChangeMock).toHaveBeenCalledWith('text');
  });
});
