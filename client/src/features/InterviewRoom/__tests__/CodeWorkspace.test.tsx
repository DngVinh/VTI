import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CodeWorkspace } from '../components/CodeWorkspace';
import type { CodeLanguage } from '../types';

describe('CodeWorkspace', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    value: 'function solution() {\n  return true;\n}',
    onChange: vi.fn(),
    language: 'javascript' as CodeLanguage,
    onLanguageChange: vi.fn(),
  };

  it('renders textarea with monospace font and spellCheck disabled', () => {
    render(<CodeWorkspace {...defaultProps} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('spellcheck', 'false');
    expect(textarea.className).toContain('font-mono');
  });

  it('displays correct number of line numbers', () => {
    const multiLineCode = ['line 1', 'line 2', 'line 3'].join('\n');
    const { container } = render(<CodeWorkspace {...defaultProps} value={multiLineCode} />);
    const lineNumbers = container.querySelectorAll('[data-testid="line-number"]');
    expect(lineNumbers.length).toBe(3);
    expect(lineNumbers[0].textContent).toBe('1');
    expect(lineNumbers[1].textContent).toBe('2');
    expect(lineNumbers[2].textContent).toBe('3');
  });

  it('calls onChange when user types in textarea', () => {
    const onChangeMock = vi.fn();
    render(<CodeWorkspace {...defaultProps} onChange={onChangeMock} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'const x = 1;' } });
    expect(onChangeMock).toHaveBeenCalledWith('const x = 1;');
  });

  it('renders language selector with all 7 languages', () => {
    render(<CodeWorkspace {...defaultProps} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toEqual([
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'cpp',
      'sql'
    ]);
  });

  it('calls onLanguageChange when language is selected', () => {
    const onLanguageChangeMock = vi.fn();
    render(<CodeWorkspace {...defaultProps} onLanguageChange={onLanguageChangeMock} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'python' } });
    expect(onLanguageChangeMock).toHaveBeenCalledWith('python');
  });

  it('inserts 2 spaces on Tab key press', () => {
    const onChangeMock = vi.fn();
    render(<CodeWorkspace {...defaultProps} value="let a = 1;" onChange={onChangeMock} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: false });
    expect(onChangeMock).toHaveBeenCalledWith('  let a = 1;');
  });

  it('removes 2 spaces on Shift+Tab key press', () => {
    const onChangeMock = vi.fn();
    render(<CodeWorkspace {...defaultProps} value="  let a = 1;" onChange={onChangeMock} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.selectionStart = 2;
    textarea.selectionEnd = 2;

    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });
    expect(onChangeMock).toHaveBeenCalledWith('let a = 1;');
  });
});
