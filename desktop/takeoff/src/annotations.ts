import type { Point } from './measurements';
import type { DrawingMarkup, DrawingSnippet, MarkupKind, SnippetBounds } from './takeoff-model';

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

export const DEFAULT_ANNOTATION_COLOR = '#b91c1c';

export function normalizedBounds(a: Point, b: Point): SnippetBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function createMarkup(
  kind: MarkupKind,
  page: number,
  points: Point[],
  options: Partial<Omit<DrawingMarkup, 'id' | 'page' | 'kind' | 'points' | 'createdAt' | 'updatedAt'>> = {},
): DrawingMarkup {
  const timestamp = now();
  return {
    id: uid(),
    page,
    kind,
    points,
    color: options.color || DEFAULT_ANNOTATION_COLOR,
    strokeWidth: Math.max(1, options.strokeWidth || 2),
    opacity: Math.min(1, Math.max(0.1, options.opacity ?? (kind === 'highlight' ? 0.28 : 1))),
    text: options.text || '',
    referenceId: options.referenceId || '',
    referenceNote: options.referenceNote || '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateMarkup(markup: DrawingMarkup, patch: Partial<DrawingMarkup>): DrawingMarkup {
  return { ...markup, ...patch, id: markup.id, page: markup.page, kind: markup.kind, updatedAt: now() };
}

export function createSnippet(
  page: number,
  bounds: SnippetBounds,
  options: Partial<Omit<DrawingSnippet, 'id' | 'page' | 'bounds' | 'createdAt' | 'updatedAt'>> = {},
): DrawingSnippet {
  const timestamp = now();
  return {
    id: uid(),
    page,
    bounds,
    title: options.title || `Snippet · Page ${page}`,
    note: options.note || '',
    referenceId: options.referenceId || '',
    referenceNote: options.referenceNote || '',
    previewDataUrl: options.previewDataUrl,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateSnippet(snippet: DrawingSnippet, patch: Partial<DrawingSnippet>): DrawingSnippet {
  return { ...snippet, ...patch, id: snippet.id, page: snippet.page, bounds: snippet.bounds, updatedAt: now() };
}

export function markupLabel(kind: MarkupKind) {
  switch (kind) {
    case 'text': return 'Text Note';
    case 'line': return 'Line';
    case 'arrow': return 'Arrow';
    case 'rectangle': return 'Rectangle';
    case 'cloud': return 'Cloud';
    case 'highlight': return 'Highlight';
    case 'freehand': return 'Freehand';
  }
}

export function minimumMarkupPoints(kind: MarkupKind) {
  if (kind === 'text') return 1;
  if (kind === 'freehand') return 2;
  return 2;
}
