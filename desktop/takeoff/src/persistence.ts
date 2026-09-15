import type { TakeoffRecoverySnapshot } from './takeoff-model';

const RECOVERY_KEY = 'scopelogic.takeoff.recovery.v1';
const SCHEMA_VERSION = 1 as const;

export type RecoverySummary = {
  id: string;
  name: string;
  drawingName: string;
  pageCount: number;
  savedAt: string;
};

function storageAvailable() {
  try {
    const probe = '__scopelogic_takeoff_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function isSnapshot(value: unknown): value is TakeoffRecoverySnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TakeoffRecoverySnapshot>;
  return item.schemaVersion === SCHEMA_VERSION
    && typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.savedAt === 'string'
    && Boolean(item.drawing)
    && typeof item.drawing?.fileName === 'string'
    && typeof item.drawing?.pageCount === 'number'
    && Boolean(item.view)
    && typeof item.view?.page === 'number'
    && typeof item.view?.zoom === 'number'
    && Array.isArray(item.tools)
    && Array.isArray(item.marks)
    && Array.isArray(item.measurements)
    && Array.isArray(item.markups)
    && Array.isArray(item.snippets)
    && Boolean(item.calibrations)
    && Boolean(item.estimatePreview)
    && Boolean(item.syncSelection);
}

export function saveTakeoffRecovery(snapshot: Omit<TakeoffRecoverySnapshot, 'schemaVersion' | 'savedAt'>) {
  if (!storageAvailable()) return false;
  const payload: TakeoffRecoverySnapshot = {
    ...snapshot,
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(payload));
  return true;
}

export function loadTakeoffRecovery(): TakeoffRecoverySnapshot | null {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(RECOVERY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearTakeoffRecovery() {
  if (!storageAvailable()) return false;
  window.localStorage.removeItem(RECOVERY_KEY);
  return true;
}

export function recoverySummary(snapshot: TakeoffRecoverySnapshot): RecoverySummary {
  return {
    id: snapshot.id,
    name: snapshot.name,
    drawingName: snapshot.drawing.fileName,
    pageCount: snapshot.drawing.pageCount,
    savedAt: snapshot.savedAt,
  };
}

export function recoveryStorageKey() {
  return RECOVERY_KEY;
}
