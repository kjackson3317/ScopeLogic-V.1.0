import type { Tool } from './takeoff-model';

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
  qty: number;
};

/**
 * Build a controlled proposal for downstream estimating.
 *
 * The commercial Rules Engine currently recognizes takeoff as a quantity source.
 * This desktop contract deliberately stops one step earlier: it produces a
 * review-only proposal and never emits an auto-apply instruction. The shared
 * cloud integration can later translate an approved proposal into the canonical
 * Rules/Assembly/Quote APIs without changing this safety boundary.
 */
export function buildTakeoffDownstreamProposals(
  summary: QuantitySummaryInput[],
  estimateQty: Record<string, number>,
): TakeoffDownstreamProposal[] {
  return summary.map(({ tool, qty }) => {
    const current = estimateQty[tool.id] || 0;
    return {
      toolId: tool.id,
      toolName: tool.name,
      takeoffQuantity: qty,
      estimateQuantity: current,
      difference: qty - current,
      unit: tool.unit,
      assemblyId: tool.downstream?.assemblyId || undefined,
      ruleId: tool.downstream?.ruleId || undefined,
      estimateSection: tool.downstream?.estimateSection || undefined,
      contribution: {
        sourceType: 'takeoff',
        sourceId: tool.id,
        label: tool.name,
        quantity: qty,
        unit: tool.unit,
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
