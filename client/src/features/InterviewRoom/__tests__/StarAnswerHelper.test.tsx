import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StarAnswerHelper, serializeStarData } from '../components/StarAnswerHelper';
import type { StarData } from '../types';

describe('StarAnswerHelper', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultStarData: StarData = {
    situation: 'Project legacy code bị chậm',
    task: 'Cần tối ưu thời gian phản hồi API xuống dưới 200ms',
    action: 'Áp dụng Redis caching và query indexing',
    result: 'API latency giảm 70%, phục vụ 10k RPS ổn định',
  };

  it('renders 4 labeled sections (Situation, Task, Action, Result)', () => {
    render(<StarAnswerHelper value={defaultStarData} onChange={vi.fn()} />);
    expect(screen.getByText(/Situation/i)).toBeInTheDocument();
    expect(screen.getByText(/Task/i)).toBeInTheDocument();
    expect(screen.getByText(/Action/i)).toBeInTheDocument();
    expect(screen.getByText(/Result/i)).toBeInTheDocument();

    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBe(4);
  });

  it('calls onChange with updated StarData when Situation textarea changes', () => {
    const onChangeMock = vi.fn();
    render(<StarAnswerHelper value={defaultStarData} onChange={onChangeMock} />);
    const situationTextarea = screen.getByPlaceholderText(/Mô tả tình huống/i);
    fireEvent.change(situationTextarea, { target: { value: 'Bối cảnh mới' } });

    expect(onChangeMock).toHaveBeenCalledWith({
      ...defaultStarData,
      situation: 'Bối cảnh mới',
    });
  });

  it('calls onChange with updated StarData when Action textarea changes', () => {
    const onChangeMock = vi.fn();
    render(<StarAnswerHelper value={defaultStarData} onChange={onChangeMock} />);
    const actionTextarea = screen.getByPlaceholderText(/Hành động cụ thể/i);
    fireEvent.change(actionTextarea, { target: { value: 'Hành động mới' } });

    expect(onChangeMock).toHaveBeenCalledWith({
      ...defaultStarData,
      action: 'Hành động mới',
    });
  });
});

describe('serializeStarData', () => {
  it('serializes all 4 parts into labeled string', () => {
    const data: StarData = {
      situation: 'Sit',
      task: 'Tsk',
      action: 'Act',
      result: 'Res',
    };
    const serialized = serializeStarData(data);
    expect(serialized).toBe(
      '[Situation] Sit\n\n[Task] Tsk\n\n[Action] Act\n\n[Result] Res'
    );
  });

  it('skips empty parts', () => {
    const data: StarData = {
      situation: 'Sit',
      task: '',
      action: '  ',
      result: 'Res',
    };
    const serialized = serializeStarData(data);
    expect(serialized).toBe('[Situation] Sit\n\n[Result] Res');
  });

  it('trims whitespace from each part', () => {
    const data: StarData = {
      situation: '  Leading and trailing  ',
      task: 'Task text',
      action: '',
      result: '',
    };
    const serialized = serializeStarData(data);
    expect(serialized).toBe('[Situation] Leading and trailing\n\n[Task] Task text');
  });

  it('returns empty string when all parts are empty', () => {
    const data: StarData = {
      situation: '',
      task: '   ',
      action: '',
      result: '',
    };
    expect(serializeStarData(data)).toBe('');
  });
});
