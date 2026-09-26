import type { Mark, Shape, Tool } from './takeoff-model';

const LEGACY_SHAPE_SYMBOLS: Record<Shape, string> = {
  circle: 'builtin.generic.circle',
  square: 'builtin.generic.square',
  triangle: 'builtin.generic.triangle',
  diamond: 'builtin.generic.diamond',
};

export function legacyShapeToSymbolId(shape: Shape): string {
  return LEGACY_SHAPE_SYMBOLS[shape] || 'builtin.generic.device';
}

/**
 * Phase 1 count tools allowed a multiplier and user-defined result unit. V1
 * intentionally removes that estimating behavior from the drawing layer:
 * one placed mark always equals one raw count and the canonical count unit is
 * `each`. ScopeLogic Rules own any downstream multiplier/BOM/labor meaning.
 */
export function normalizeCountTool(tool: Tool): Tool {
  return {
    ...tool,
    symbolId: tool.symbolId || legacyShapeToSymbolId(tool.shape),
    multiplier: 1,
    unit: 'each',
  };
}

export function normalizeCountTools(tools: Tool[]): Tool[] {
  return tools.map(normalizeCountTool);
}

export type RawCountSummaryRow = {
  tool: Tool;
  count: number;
};

/**
 * Authoritative V1 count summary: count placed marks by Tool ID. No multiplier,
 * result quantity, cable quantity, assembly, material, labor, or pricing logic
 * is permitted here.
 */
export function summarizeRawCounts(marks: Mark[], tools: Tool[]): RawCountSummaryRow[] {
  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  const counts = new Map<string, number>();

  for (const mark of marks) {
    if (!toolById.has(mark.toolId)) continue;
    counts.set(mark.toolId, (counts.get(mark.toolId) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([toolId, count]) => ({ tool: toolById.get(toolId)!, count }))
    .sort((a, b) => a.tool.name.localeCompare(b.tool.name));
}
