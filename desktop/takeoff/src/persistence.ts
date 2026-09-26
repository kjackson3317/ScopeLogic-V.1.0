import {
  clearNativeTakeoffRecovery,
  loadNativeTakeoffRecovery,
  saveNativeTakeoffRecovery,
} from './native-persistence';
import type {
  LegacyTakeoffRecoverySnapshot,
  TakeoffRecoverySnapshot,
  Tool,
} from './takeoff-model';
import { normalizeCountTools } from './tool-normalization';

const RECOVERY_KEY = 'scopelogic.takeoff.recovery.v2';
const LEGACY_RECOVERY_KEY = 'scopelogic.takeoff.recovery.v1';
const SCHEMA_VERSION = 2 as const;

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

function hasSnapshotShape(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LegacyTakeoffRecoverySnapshot | TakeoffRecoverySnapshot>;
  return (item.schemaVersion === 1 || item.schemaVersion === SCHEMA_VERSION)
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

function migrateSnapshot(value: unknown): TakeoffRecoverySnapshot | null {
  if (!hasSnapshotShape(value)) return null;
  const source = value as LegacyTakeoffRecoverySnapshot | TakeoffRecoverySnapshot;
  return {
    ...source,
    schemaVersion: SCHEMA_VERSION,
    // This is the intentional V1 product migration: old multiplier/result-unit
    // semantics are discarded while the original placed marks are preserved.
    tools: normalizeCountTools(source.tools as Tool[]),
  };
}

function parseSnapshot(raw: string | null): TakeoffRecoverySnapshot | null {
  if (!raw) return null;
  try {
    return migrateSnapshot(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveTakeoffRecovery(snapshot: Omit<TakeoffRecoverySnapshot, 'schemaVersion' | 'savedAt'>) {
  const payload: TakeoffRecoverySnapshot = {
    ...snapshot,
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    tools: normalizeCountTools(snapshot.tools),
  };

  let localSaved = false;
  if (storageAvailable()) {
    window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(payload));
    // Once a v2 snapshot is durable locally, the old WebView slot is no longer
    // needed. Native recovery remains intentionally backward compatible.
    window.localStorage.removeItem(LEGACY_RECOVERY_KEY);
    localSaved = true;
  }

  // Native storage is a durable mirror in the Tauri shell. It is deliberately
  // fire-and-forget here so autosave never blocks drawing/takeoff interaction.
  void saveNativeTakeoffRecovery(payload);
  return localSaved;
}

export function loadTakeoffRecovery(): TakeoffRecoverySnapshot | null {
  if (!storageAvailable()) return null;
  return parseSnapshot(window.localStorage.getItem(RECOVERY_KEY))
    || parseSnapshot(window.localStorage.getItem(LEGACY_RECOVERY_KEY));
}

/**
 * Preferred asynchronous recovery read for the native shell. It checks the
 * durable native mirror first, migrates either schema v1 or v2 into the V1 raw
 * count model, then falls back to WebView local storage.
 */
export async function loadPreferredTakeoffRecovery(): Promise<TakeoffRecoverySnapshot | null> {
  const native = migrateSnapshot(await loadNativeTakeoffRecovery());
  return native || loadTakeoffRecovery();
}

export function clearTakeoffRecovery() {
  let localCleared = false;
  if (storageAvailable()) {
    window.localStorage.removeItem(RECOVERY_KEY);
    window.localStorage.removeItem(LEGACY_RECOVERY_KEY);
    localCleared = true;
  }
  void clearNativeTakeoffRecovery();
  return localCleared;
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
