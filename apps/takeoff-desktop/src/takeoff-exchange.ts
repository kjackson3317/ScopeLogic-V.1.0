export const TAKEOFF_EXCHANGE_SCHEMA = 'scopelogic.takeoff' as const;
export const TAKEOFF_EXCHANGE_VERSION = 1 as const;

export type ToolShape = 'square' | 'triangle' | 'circle' | 'diamond';
export type ToolScope = 'global' | 'project';

export type TakeoffTool = {
  id: string;
  name: string;
  system: string;
  shape: ToolShape;
  color: string;
  scope: ToolScope;
  projectId?: string;
  takeoffRuleId?: string;
};

export type TakeoffDocument = {
  id: string;
  fileName: string;
  name?: string;
};

export type TakeoffMark = {
  id: string;
  documentId: string;
  page: number;
  toolId: string;
  x: number;
  y: number;
};

export type TakeoffCount = { toolId: string; count: number };

export type TakeoffPackage = {
  schema: typeof TAKEOFF_EXCHANGE_SCHEMA;
  version: typeof TAKEOFF_EXCHANGE_VERSION;
  projectId: string;
  generatedAt: string;
  documents: TakeoffDocument[];
  tools: TakeoffTool[];
  marks: TakeoffMark[];
  counts: TakeoffCount[];
};

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function aggregateCounts(marks: TakeoffMark[]): TakeoffCount[] {
  const totals = new Map<string, number>();
  marks.forEach((mark) => totals.set(mark.toolId, (totals.get(mark.toolId) || 0) + 1));
  return [...totals.entries()]
    .map(([toolId, count]) => ({ toolId, count }))
    .sort((a, b) => a.toolId.localeCompare(b.toolId, undefined, { numeric: true, sensitivity: 'base' }));
}

export function buildPackage(projectId: string, documents: TakeoffDocument[], tools: TakeoffTool[], marks: TakeoffMark[]): TakeoffPackage {
  const validToolIds = new Set(tools.map((tool) => tool.id));
  const validMarks = marks.filter((mark) => validToolIds.has(mark.toolId));
  return {
    schema: TAKEOFF_EXCHANGE_SCHEMA,
    version: TAKEOFF_EXCHANGE_VERSION,
    projectId: projectId.trim() || 'local-project',
    generatedAt: new Date().toISOString(),
    documents: documents.filter((doc) => doc.id && doc.fileName),
    tools,
    marks: validMarks,
    counts: aggregateCounts(validMarks),
  };
}

export function parsePackage(value: unknown): TakeoffPackage {
  if (!value || typeof value !== 'object') throw new Error('Takeoff package must be an object.');
  const raw = value as Record<string, unknown>;
  if (raw.schema !== TAKEOFF_EXCHANGE_SCHEMA) throw new Error('This is not a ScopeLogic takeoff package.');
  if (raw.version !== TAKEOFF_EXCHANGE_VERSION) throw new Error(`Unsupported takeoff package version: ${String(raw.version)}`);

  const projectId = clean(raw.projectId);
  if (!projectId) throw new Error('Takeoff package is missing projectId.');

  const documents: TakeoffDocument[] = (Array.isArray(raw.documents) ? raw.documents : []).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid drawing at row ${index + 1}.`);
    const source = item as Record<string, unknown>;
    const id = clean(source.id);
    const fileName = clean(source.fileName);
    if (!id || !fileName) throw new Error(`Drawing ${index + 1} is missing id or fileName.`);
    return { id, fileName, name: clean(source.name) || undefined };
  });

  const tools: TakeoffTool[] = (Array.isArray(raw.tools) ? raw.tools : []).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid tool at row ${index + 1}.`);
    const source = item as Record<string, unknown>;
    const id = clean(source.id);
    const name = clean(source.name);
    const system = clean(source.system);
    const shape = clean(source.shape) as ToolShape;
    const scope = clean(source.scope) as ToolScope;
    if (!id || !name || !system) throw new Error(`Tool ${index + 1} is missing id, name, or system.`);
    if (!['square', 'triangle', 'circle', 'diamond'].includes(shape)) throw new Error(`Tool ${name} has an unsupported symbol shape.`);
    if (!['global', 'project'].includes(scope)) throw new Error(`Tool ${name} has an unsupported scope.`);
    return {
      id,
      name,
      system,
      shape,
      color: clean(source.color) || '#315f4a',
      scope,
      projectId: clean(source.projectId) || undefined,
      takeoffRuleId: clean(source.takeoffRuleId) || undefined,
    };
  });

  const toolIds = new Set(tools.map((tool) => tool.id));
  const marks: TakeoffMark[] = (Array.isArray(raw.marks) ? raw.marks : []).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid mark at row ${index + 1}.`);
    const source = item as Record<string, unknown>;
    const id = clean(source.id);
    const documentId = clean(source.documentId);
    const toolId = clean(source.toolId);
    const page = Number(source.page);
    const x = Number(source.x);
    const y = Number(source.y);
    if (!id || !documentId || !toolIds.has(toolId)) throw new Error(`Mark ${index + 1} has an invalid identity or tool link.`);
    if (!Number.isInteger(page) || page < 1 || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Mark ${id} has invalid page or coordinates.`);
    return { id, documentId, page, toolId, x: clamp01(x), y: clamp01(y) };
  });

  return {
    schema: TAKEOFF_EXCHANGE_SCHEMA,
    version: TAKEOFF_EXCHANGE_VERSION,
    projectId,
    generatedAt: clean(raw.generatedAt) || new Date().toISOString(),
    documents,
    tools,
    marks,
    counts: aggregateCounts(marks),
  };
}
