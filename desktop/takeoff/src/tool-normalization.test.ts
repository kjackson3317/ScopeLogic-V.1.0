import { describe, expect, it } from 'vitest';
import type { Mark, Tool } from './takeoff-model';
import {
  legacyShapeToSymbolId,
  normalizeCountTool,
  summarizeRawCounts,
} from './tool-normalization';

const legacyTool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 'tool-1',
  name: 'Dual Data',
  shape: 'triangle',
  color: '#2563eb',
  multiplier: 2,
  unit: 'qty',
  ...overrides,
});

const mark = (id: string, toolId = 'tool-1'): Mark => ({
  id,
  page: 1,
  toolId,
  x: 0.25,
  y: 0.5,
});

describe('V1 raw-count migration', () => {
  it('maps legacy shapes to stable built-in symbol IDs', () => {
    expect(legacyShapeToSymbolId('circle')).toBe('builtin.generic.circle');
    expect(legacyShapeToSymbolId('square')).toBe('builtin.generic.square');
    expect(legacyShapeToSymbolId('triangle')).toBe('builtin.generic.triangle');
    expect(legacyShapeToSymbolId('diamond')).toBe('builtin.generic.diamond');
  });

  it('discards legacy multiplier and result-unit semantics', () => {
    const normalized = normalizeCountTool(legacyTool());

    expect(normalized.symbolId).toBe('builtin.generic.triangle');
    expect(normalized.multiplier).toBe(1);
    expect(normalized.unit).toBe('each');
  });

  it('preserves an existing symbol ID while enforcing raw count semantics', () => {
    const normalized = normalizeCountTool(legacyTool({
      symbolId: 'builtin.video.dome',
      multiplier: 4,
      unit: 'cables',
    }));

    expect(normalized.symbolId).toBe('builtin.video.dome');
    expect(normalized.multiplier).toBe(1);
    expect(normalized.unit).toBe('each');
  });

  it('counts placed marks rather than multiplier-adjusted result quantity', () => {
    const tool = legacyTool({ multiplier: 8 });
    const marks = [mark('m1'), mark('m2'), mark('m3')];

    const summary = summarizeRawCounts(marks, [tool]);

    expect(summary).toHaveLength(1);
    expect(summary[0].tool.id).toBe('tool-1');
    expect(summary[0].count).toBe(3);
  });

  it('keeps tools independent when summarizing raw counts', () => {
    const camera = legacyTool({ id: 'camera', name: 'Fixed Camera', shape: 'circle' });
    const ptz = legacyTool({ id: 'ptz', name: 'PTZ Camera', shape: 'diamond' });
    const marks = [
      mark('m1', 'camera'),
      mark('m2', 'camera'),
      mark('m3', 'ptz'),
      mark('m4', 'missing-tool'),
    ];

    const summary = summarizeRawCounts(marks, [camera, ptz]);

    expect(summary.map((row) => [row.tool.id, row.count])).toEqual([
      ['camera', 2],
      ['ptz', 1],
    ]);
  });
});
