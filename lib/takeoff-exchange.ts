export const TAKEOFF_EXCHANGE_SCHEMA = 'scopelogic.takeoff' as const;
export const TAKEOFF_EXCHANGE_VERSION = 1 as const;

export type TakeoffExchangeShape = 'square' | 'triangle' | 'circle' | 'diamond';
export type TakeoffExchangeScope = 'global' | 'project';

/**
 * Shared count-tool definition used by ScopeLogic and the standalone takeoff app.
 * Estimating semantics intentionally do not live here. A tool identifies what the
 * estimator is counting and may point to a ScopeLogic Take Off Rule; the rule owns
 * assemblies, multipliers, material, labor, capacity, and pricing behavior.
 */
export type TakeoffExchangeTool = {
  id: string;
  name: string;
  system: string;
  shape: TakeoffExchangeShape;
  color: string;
  scope: TakeoffExchangeScope;
  projectId?: string;
  takeoffRuleId?: string;
};

/** Stable drawing identity lets the desktop app return marks to the correct ScopeLogic PDF. */
export type TakeoffExchangeDocument = {
  id: string;
  fileName: string;
  name?: string;
};

/** One physical count mark on one PDF sheet. One record always equals one count. */
export type TakeoffExchangeMark = {
  id: string;
  documentId: string;
  page: number;
  toolId: string;
  x: number;
  y: number;
};

export type TakeoffExchangeCount = {
  toolId: string;
  count: number;
};

export type TakeoffExchangePackage = {
  schema: typeof TAKEOFF_EXCHANGE_SCHEMA;
  version: typeof TAKEOFF_EXCHANGE_VERSION;
  projectId: string;
  generatedAt: string;
  documents: TakeoffExchangeDocument[];
  tools: TakeoffExchangeTool[];
  marks: TakeoffExchangeMark[];
  counts: TakeoffExchangeCount[];
};

export type InternalDrawingTool = {
  id: string;
  name: string;
  system: string;
  shape: TakeoffExchangeShape;
  color: string;
  scope: TakeoffExchangeScope;
  projectId?: string;
  formulaId?: string;
};

export type InternalDrawingMark = {
  id: string;
  docId: string;
  page: number;
  toolId: string;
  x: number;
  y: number;
};

const cleanText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function toExchangeTool(tool: InternalDrawingTool): TakeoffExchangeTool {
  return {
    id: tool.id,
    name: tool.name,
    system: tool.system,
    shape: tool.shape,
    color: tool.color,
    scope: tool.scope,
    projectId: tool.projectId,
    takeoffRuleId: tool.formulaId,
  };
}

export function fromExchangeTool(tool: TakeoffExchangeTool): InternalDrawingTool {
  return {
    id: tool.id,
    name: tool.name,
    system: tool.system,
    shape: tool.shape,
    color: tool.color,
    scope: tool.scope,
    projectId: tool.projectId,
    formulaId: tool.takeoffRuleId,
  };
}

export function toExchangeMark(mark: InternalDrawingMark): TakeoffExchangeMark {
  return {
    id: mark.id,
    documentId: mark.docId,
    page: mark.page,
    toolId: mark.toolId,
    x: mark.x,
    y: mark.y,
  };
}

export function fromExchangeMark(mark: TakeoffExchangeMark): InternalDrawingMark {
  return {
    id: mark.id,
    docId: mark.documentId,
    page: mark.page,
    toolId: mark.toolId,
    x: mark.x,
    y: mark.y,
  };
}

export function aggregateExchangeCounts(marks: TakeoffExchangeMark[]): TakeoffExchangeCount[] {
  const totals = new Map<string, number>();
  for (const mark of marks) totals.set(mark.toolId, (totals.get(mark.toolId) || 0) + 1);
  return [...totals.entries()]
    .map(([toolId, count]) => ({ toolId, count }))
    .sort((a, b) => a.toolId.localeCompare(b.toolId, undefined, { numeric: true, sensitivity: 'base' }));
}

export function buildTakeoffExchangePackage(input: {
  projectId: string;
  documents?: TakeoffExchangeDocument[];
  tools: InternalDrawingTool[];
  marks: InternalDrawingMark[];
  generatedAt?: string;
}): TakeoffExchangePackage {
  const tools = input.tools.map(toExchangeTool);
  const validToolIds = new Set(tools.map((tool) => tool.id));
  const marks = input.marks.filter((mark) => validToolIds.has(mark.toolId)).map(toExchangeMark);
  const documents = (input.documents || [])
    .filter((doc) => doc.id && doc.fileName)
    .map((doc) => ({ id: doc.id, fileName: doc.fileName, name: doc.name || undefined }));
  return {
    schema: TAKEOFF_EXCHANGE_SCHEMA,
    version: TAKEOFF_EXCHANGE_VERSION,
    projectId: input.projectId,
    generatedAt: input.generatedAt || new Date().toISOString(),
    documents,
    tools,
    marks,
    counts: aggregateExchangeCounts(marks),
  };
}

export function parseTakeoffExchangePackage(value: unknown): TakeoffExchangePackage {
  if (!value || typeof value !== 'object') throw new Error('Takeoff exchange payload must be an object.');
  const raw = value as Record<string, unknown>;
  if (raw.schema !== TAKEOFF_EXCHANGE_SCHEMA) throw new Error('Unsupported takeoff exchange schema.');
  if (raw.version !== TAKEOFF_EXCHANGE_VERSION) throw new Error(`Unsupported takeoff exchange version: ${String(raw.version)}.`);

  const projectId = cleanText(raw.projectId);
  if (!projectId) throw new Error('Takeoff exchange payload is missing projectId.');

  const rawDocuments = Array.isArray(raw.documents) ? raw.documents : [];
  const documents: TakeoffExchangeDocument[] = rawDocuments.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid takeoff document at index ${index}.`);
    const source = item as Record<string, unknown>;
    const id = cleanText(source.id);
    const fileName = cleanText(source.fileName);
    if (!id || !fileName) throw new Error(`Takeoff document ${index + 1} is missing id or fileName.`);
    return { id, fileName, name: cleanText(source.name) || undefined };
  });

  const rawTools = Array.isArray(raw.tools) ? raw.tools : [];
  const tools: TakeoffExchangeTool[] = rawTools.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid takeoff tool at index ${index}.`);
    const source = item as Record<string, unknown>;
    const id = cleanText(source.id);
    const name = cleanText(source.name);
    const system = cleanText(source.system);
    const color = cleanText(source.color);
    const shape = source.shape;
    const scope = source.scope;
    if (!id || !name || !system) throw new Error(`Takeoff tool ${index + 1} is missing id, name, or system.`);
    if (!['square', 'triangle', 'circle', 'diamond'].includes(String(shape))) throw new Error(`Takeoff tool ${id} has an unsupported shape.`);
    if (!['global', 'project'].includes(String(scope))) throw new Error(`Takeoff tool ${id} has an unsupported scope.`);
    return {
      id,
      name,
      system,
      shape: shape as TakeoffExchangeShape,
      color: color || '#31513b',
      scope: scope as TakeoffExchangeScope,
      projectId: cleanText(source.projectId) || undefined,
      takeoffRuleId: cleanText(source.takeoffRuleId) || undefined,
    };
  });

  const validToolIds = new Set(tools.map((tool) => tool.id));
  const rawMarks = Array.isArray(raw.marks) ? raw.marks : [];
  const marks: TakeoffExchangeMark[] = rawMarks.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid takeoff mark at index ${index}.`);
    const source = item as Record<string, unknown>;
    const id = cleanText(source.id);
    const documentId = cleanText(source.documentId);
    const toolId = cleanText(source.toolId);
    const page = source.page;
    const x = source.x;
    const y = source.y;
    if (!id || !documentId || !toolId || !validToolIds.has(toolId)) throw new Error(`Takeoff mark ${index + 1} has an invalid identity or tool link.`);
    if (!finite(page) || Number(page) < 1 || !Number.isInteger(Number(page))) throw new Error(`Takeoff mark ${id} has an invalid page.`);
    if (!finite(x) || !finite(y)) throw new Error(`Takeoff mark ${id} has invalid coordinates.`);
    return { id, documentId, page: Number(page), toolId, x: clamp01(Number(x)), y: clamp01(Number(y)) };
  });

  return {
    schema: TAKEOFF_EXCHANGE_SCHEMA,
    version: TAKEOFF_EXCHANGE_VERSION,
    projectId,
    generatedAt: cleanText(raw.generatedAt) || new Date().toISOString(),
    documents,
    tools,
    marks,
    counts: aggregateExchangeCounts(marks),
  };
}
