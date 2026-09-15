import type { Shape, ToolDownstreamLink } from './takeoff-model';
import type { TakeoffDownstreamProposal } from './downstream';

/**
 * Stable adapter boundary between Takeoff Desktop and the shared ScopeLogic
 * cloud platform. Keep the desktop app independent from a specific Supabase
 * schema so SLC and commercial deployments can use the same Takeoff engine.
 */

export type PlatformIdentity = {
  userId: string;
  organizationId: string;
  displayName: string;
  email?: string;
};

export type PlatformProject = {
  id: string;
  name: string;
  number?: string;
  status?: string;
};

export type PlatformQuoteTarget = {
  id: string;
  projectId: string;
  quoteNumber?: string;
  name: string;
  revision?: string;
  isDraft: boolean;
};

export type PlatformAssembly = {
  id: string;
  name: string;
  category?: string;
  version: string;
  status: 'draft' | 'published' | 'retired';
};

export type PlatformRule = {
  id: string;
  name: string;
  category?: string;
  inputKey: string;
  inputLabel: string;
  behavior: 'calculate_only' | 'recommend_bom' | 'auto_apply';
  outputLabel: string;
  outputUnit: string;
};

export type PlatformToolChestItem = {
  id: string;
  scope: 'company' | 'project';
  projectId?: string;
  name: string;
  shape: Shape;
  color: string;
  multiplier: number;
  unit: string;
  category?: string;
  downstream?: ToolDownstreamLink;
  updatedAt: string;
};

export type ApprovedTakeoffQuantityCommand = {
  quoteId: string;
  toolId: string;
  inputKey: string;
  label: string;
  value: number;
  unit: string;
  sourceType: 'takeoff';
  proposal: TakeoffDownstreamProposal;
};

export type PlatformSyncResult = {
  command: ApprovedTakeoffQuantityCommand;
  quantityInputId?: string;
  status: 'accepted' | 'rejected';
  message?: string;
};

export interface ScopeLogicPlatformGateway {
  getIdentity(): Promise<PlatformIdentity | null>;
  listProjects(): Promise<PlatformProject[]>;
  listQuoteTargets(projectId: string): Promise<PlatformQuoteTarget[]>;
  listToolChest(projectId?: string): Promise<PlatformToolChestItem[]>;
  listAssemblies(): Promise<PlatformAssembly[]>;
  listRules(): Promise<PlatformRule[]>;

  /**
   * This is the only write boundary Takeoff should use for estimate-bound
   * quantity data. Callers must send only user-approved Sync Review commands.
   */
  submitApprovedTakeoffQuantities(commands: ApprovedTakeoffQuantityCommand[]): Promise<PlatformSyncResult[]>;
}

export function assertApprovedCommand(command: ApprovedTakeoffQuantityCommand) {
  if (!command.quoteId.trim()) throw new Error('A Quote target is required before a Takeoff quantity can be submitted.');
  if (!command.inputKey.trim()) throw new Error('A Rules Engine input key is required before a Takeoff quantity can be submitted.');
  if (!Number.isFinite(command.value) || command.value < 0) throw new Error('Takeoff quantity must be a finite non-negative number.');
  if (command.sourceType !== 'takeoff') throw new Error('Takeoff Desktop may only submit quantity inputs with sourceType takeoff.');
  if (command.proposal.behavior !== 'review_only') throw new Error('Takeoff proposals must pass through explicit Sync Review before submission.');
  return command;
}
