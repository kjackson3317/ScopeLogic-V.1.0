import type { Measurement, PageCalibration, Point } from './measurements';

export type Shape = 'square' | 'triangle' | 'circle' | 'diamond';
export type MarkupKind = 'text' | 'line' | 'arrow' | 'rectangle' | 'cloud' | 'highlight' | 'freehand';
export type Uuid = ReturnType<Crypto['randomUUID']>;

export type Tool = {
  id: string;
  name: string;
  shape: Shape;
  color: string;
  multiplier: number;
  unit: string;
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

export type TakeoffRecoverySnapshot = {
  schemaVersion: 1;
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
