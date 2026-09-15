import type { TakeoffDownstreamProposal } from './downstream';
import { assertApprovedCommand, type ApprovedTakeoffQuantityCommand } from './platform-contract';

export type SyncCommandContext = {
  quoteId: string;
  selected: Record<string, boolean>;
};

/**
 * Convert only deliberately selected Sync Review rows into cloud-write commands.
 * Rows with no difference are ignored. Nothing in this module writes data.
 */
export function buildApprovedTakeoffCommands(
  proposals: TakeoffDownstreamProposal[],
  context: SyncCommandContext,
): ApprovedTakeoffQuantityCommand[] {
  return proposals
    .filter((proposal) => (context.selected[proposal.toolId] ?? true) && proposal.difference !== 0)
    .map((proposal) => {
      const inputKey = proposal.ruleId?.trim() || `takeoff:${proposal.toolId}`;
      return assertApprovedCommand({
        quoteId: context.quoteId,
        toolId: proposal.toolId,
        inputKey,
        label: proposal.toolName,
        value: proposal.takeoffQuantity,
        unit: proposal.unit,
        sourceType: 'takeoff',
        proposal,
      });
    });
}
