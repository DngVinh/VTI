import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('registers a native unload warning only while dirty', () => {
    const { rerender } = renderHook(
      ({ dirty }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: true } }
    );
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    rerender({ dirty: false });
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });

  it('blocks rejected same-origin link navigation but allows confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHook(() => useUnsavedChangesGuard(true));
    const link = document.createElement('a');
    link.href = '/admin/question-bank';
    link.textContent = 'Back';
    document.body.append(link);

    const rejected = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(rejected);
    expect(rejected.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();

    confirm.mockReturnValue(true);
    const accepted = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(accepted);
    expect(accepted.defaultPrevented).toBe(false);
  });

  it('ignores unrelated targets, current links, external links, and new tabs', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHook(() => useUnsavedChangesGuard(true));

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    for (const [href, target] of [
      [window.location.href, ''],
      ['https://example.test/path', ''],
      ['/other', '_blank'],
    ]) {
      const link = document.createElement('a');
      link.href = href;
      link.target = target;
      document.body.append(link);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    expect(confirm).not.toHaveBeenCalled();
  });
});

