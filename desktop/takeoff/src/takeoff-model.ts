import type { Measurement, PageCalibration, Point } from './measurements';

export type Shape = 'square' | 'triangle' | 'circle' | 'diamond';
export type SymbolId = string;
export type MarkupKind = 'text' | 'line' | 'arrow' | 'rectangle' | 'cloud' | 'highlight' | 'freehand';
export type Uuid = ReturnType<Crypto['randomUUID']>;

export type ToolDownstreamLink = {
  assemblyId?: string;
  ruleId?: string;
  estimateSection?: string;
};

export type Tool = {
  id: string;
  name: string;
  /**
   * Stable symbol identity for the V1 extensible symbol registry. Legacy tools
   * may omit this until they pass through recovery/tool normalization.
   */
  symbolId?: SymbolId;
  /** @deprecated Compatibility field for Phase 1 sessions. Use symbolId. */
  shape: Shape;
  color: string;
  /**
   * @deprecated Count tools are raw one-mark/one-count in V1. This field is
   * retained temporarily so Phase 1 UI and recovery data can migrate safely.
   */
  multiplier: number;
  /**
   * @deprecated Count tools use the canonical unit `each` in V1. Measurement
   * tool units will be modeled separately.
   */
  unit: string;
  downstream?: ToolDownstreamLink;
};

export type Mark = {
  id: string;
  page: number;
  toolId: string;
  x: number;
  y: number;
};

export type DrawingMarkup = {
  id: string;
  page: number;
  kind: MarkupKind;
  points: Point[];
  color: string;
  strokeWidth: number;
  opacity: number;
  text?: string;
  referenceId?: string;
  referenceNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type SnippetBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawingSnippet = {
  id: string;
  page: number;
  bounds: SnippetBounds;
  title: string;
  note: string;
  referenceId?: string;
  referenceNote?: string;
  previewDataUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type DrawingIdentity = {
  fileName: string;
  pageCount: number;
  fingerprint?: string;
};

type TakeoffRecoverySnapshotBase = {
  id: Uuid;
  name: string;
  savedAt: string;
  drawing: DrawingIdentity;
  view: {
    page: number;
    zoom: number;
  };
  tools: Tool[];
  marks: Mark[];
  measurements: Measurement[];
  calibrations: Record<number, PageCalibration>;
  markups: DrawingMarkup[];
  snippets: DrawingSnippet[];
  estimatePreview: Record<string, number>;
  syncSelection: Record<string, boolean>;
};

export type LegacyTakeoffRecoverySnapshot = TakeoffRecoverySnapshotBase & {
  schemaVersion: 1;
};

export type TakeoffRecoverySnapshot = TakeoffRecoverySnapshotBase & {
  schemaVersion: 2;
};
