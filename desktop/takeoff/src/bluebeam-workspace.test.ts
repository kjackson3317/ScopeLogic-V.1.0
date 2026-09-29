import { describe, expect, it } from 'vitest';
import type { Mark, Tool } from './takeoff-model';
import { summarizeRawCounts } from './tool-normalization';

const tool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  name: 'Call Station',
  symbolId: 'builtin.intercom.call_station',
  shape: 'circle',
  color: '#2563eb',
  system: 'Intercom',
  opacity: 1,
  size: 22,
  showCaption: false,
  multiplier: 1,
  unit: 'each',
  ...overrides,
});

const mark = (id: string, page = 1, overrides: Partial<Mark> = {}): Mark => ({
  id,
  page,
  toolId: 'tool-1',
  x: 0.2,
  y: 0.3,
  ...overrides,
});

describe('Bluebeam-inspired workspace data contracts', () => {
  it('keeps appearance fields separate from raw quantity', () => {
    const subject = tool({ opacity: .35, size: 60, showCaption: true, color: '#ff0000' });
    const summary = summarizeRawCounts([mark('a'), mark('b'), mark('c')], [subject]);
    expect(summary[0].count).toBe(3);
  });

  it('supports grouping the Markups List by sheet without changing total count', () => {
    const marks = [mark('a', 1), mark('b', 1), mark('c', 2), mark('d', 5)];
    const pageCounts = marks.reduce<Record<number, number>>((result, item) => {
      result[item.page] = (result[item.page] || 0) + 1;
      return result;
    }, {});
    expect(pageCounts).toEqual({ 1: 2, 2: 1, 5: 1 });
    expect(Object.values(pageCounts).reduce((sum, value) => sum + value, 0)).toBe(4);
  });

  it('preserves count metadata used by the properties inspector', () => {
    const item = mark('a', 3, { label: 'Lobby', comments: 'Verify mounting height', locked: true });
    expect(item.label).toBe('Lobby');
    expect(item.comments).toContain('mounting');
    expect(item.locked).toBe(true);
  });
});
