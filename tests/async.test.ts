import { describe, it, expect, vi } from 'vitest';
import { throttle } from '../src/lib/async';

describe('خنق التقدّم: لماذا لا تتجمّد الواجهة', () => {
  it('ألف نداء في ميليمتر واحد لا تمرّ كلها', () => {
    const seen: number[] = [];
    const fn = throttle((n: number) => seen.push(n), 160);
    for (let i = 0; i < 1000; i += 1) fn(i);
    // الأول يمرّ فوراً، والباقي ينتظر نافذة الفاصل
    expect(seen.length).toBe(1);
    expect(seen[0]).toBe(0);
  });

  it('آخر قيمة تُطرَح عند الطلب الأخير فلا يبقى الشريط ناقصاً', () => {
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      const fn = throttle((n: number) => seen.push(n), 160);
      fn(1);
      fn(2);
      fn(999);
      vi.advanceTimersByTime(200);
      expect(seen).toEqual([1, 999]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('`flush` يمرّر المعلّقة فوراً', () => {
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      const fn = throttle((n: number) => seen.push(n), 160);
      fn(1);
      fn(2);
      fn(3);
      fn.flush();
      expect(seen).toEqual([1, 3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('`flush` بلا معلّق لا يكرّر ولا يضيف', () => {
    const seen: number[] = [];
    const fn = throttle((n: number) => seen.push(n), 160);
    fn(1);
    fn.flush();
    fn.flush();
    expect(seen).toEqual([1]);
  });

  it('نافذة الفاصل صفر يمرّر كل شيء — الأقسام الصغيرة لا تتأثر', () => {
    const seen: number[] = [];
    const fn = throttle((n: number) => seen.push(n), 0);
    for (let i = 0; i < 50; i += 1) fn(i);
    expect(seen.length).toBe(50);
  });

  it('كل الوسائط تُمرَّر كما هي', () => {
    const seen: [string, number][] = [];
    const fn = throttle((a: string, b: number) => seen.push([a, b]), 0);
    fn('x', 1);
    fn('y', 2);
    expect(seen).toEqual([
      ['x', 1],
      ['y', 2],
    ]);
  });
});
