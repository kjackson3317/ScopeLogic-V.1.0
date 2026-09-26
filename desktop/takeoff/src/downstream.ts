import type { Tool } from './takeoff-model';

const COUNT_UNIT = 'each';

export type TakeoffQuantityContribution = {
  sourceType: 'takeoff';
  sourceId: string;
  label: string;
  quantity: number;
  unit: string;
};

export type TakeoffDownstreamProposal = {
  toolId: string;
  toolName: string;
  takeoffQuantity: number;
  estimateQuantity: number;
  difference: number;
  unit: string;
  assemblyId?: string;
  ruleId?: string;
  estimateSection?: string;
  contribution: TakeoffQuantityContribution;
  behavior: 'review_only';
};

export type QuantitySummaryInput = {
  tool: Tool;
  /** V1 raw count: exactly one per placed mark. */
  count?: number;
  /** @deprecated Transitional alias for Phase 1 callers. */
  qty?: number;
};

/**
 * Build a controlled proposal for downstream estimating.
 *
 * Count tools intentionally send only their raw placed-mark count. ScopeLogic
 * Rules own every estimating interpretation (assemblies, BOM, labor, waste,
 * cable quantity, pricing, and other multipliers). The desktop proposal remains
 * review-only and never emits an auto-apply instruction.
 */
export function buildTakeoffDownstreamProposals(
  summary: QuantitySummaryInput[],
  estimateQty: Record<string, number>,
): TakeoffDownstreamProposal[] {
  return summary.map(({ tool, count, qty }) => {
    const rawCount = Number.isFinite(count) ? Number(count) : Number(qty) || 0;
    const current = estimateQty[tool.id] || 0;
    return {
      toolId: tool.id,
      toolName: tool.name,
      takeoffQuantity: rawCount,
      estimateQuantity: current,
      difference: rawCount - current,
      unit: COUNT_UNIT,
      assemblyId: tool.downstream?.assemblyId || undefined,
      ruleId: tool.downstream?.ruleId || undefined,
      estimateSection: tool.downstream?.estimateSection || undefined,
      contribution: {
        sourceType: 'takeoff',
        sourceId: tool.id,
        label: tool.name,
        quantity: rawCount,
        unit: COUNT_UNIT,
      },
      behavior: 'review_only',
    };
  });
}

export function downstreamLinkLabel(tool: Tool) {
  const links = [
    tool.downstream?.assemblyId ? `Assembly ${tool.downstream.assemblyId}` : '',
    tool.downstream?.ruleId ? `Rule ${tool.downstream.ruleId}` : '',
    tool.downstream?.estimateSection ? `Section ${tool.downstream.estimateSection}` : '',
  ].filter(Boolean);
  return links.length ? links.join(' · ') : 'Unlinked takeoff quantity';
}
