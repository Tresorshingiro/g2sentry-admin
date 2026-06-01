import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoRefresh } from './useAutoRefresh';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutoRefresh', () => {
  it('starts at the given interval', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useAutoRefresh(30, onRefresh));
    expect(result.current.countdown).toBe(30);
  });

  it('decrements countdown each second', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useAutoRefresh(30, onRefresh));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.countdown).toBe(27);
  });

  it('calls onRefresh and resets when countdown hits 0', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useAutoRefresh(3, onRefresh));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.countdown).toBe(3);
  });

  it('manual refresh resets countdown', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useAutoRefresh(30, onRefresh));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.refresh();
    });
    expect(result.current.countdown).toBe(30);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
