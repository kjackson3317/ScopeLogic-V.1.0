import type {
  LegacyTakeoffRecoverySnapshot,
  TakeoffRecoverySnapshot,
} from './takeoff-model';

type NativeRecoverySnapshot = LegacyTakeoffRecoverySnapshot | TakeoffRecoverySnapshot;

function tauriAvailable() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function nativeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<{ ok: true; value: T } | { ok: false }> {
  if (!tauriAvailable()) return { ok: false };
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return { ok: true, value: await invoke<T>(command, args) };
  } catch {
    return { ok: false };
  }
}

export async function saveNativeTakeoffRecovery(snapshot: TakeoffRecoverySnapshot) {
  const result = await nativeInvoke<void>('save_takeoff_recovery', { json: JSON.stringify(snapshot) });
  return result.ok;
}

export async function loadNativeTakeoffRecovery(): Promise<NativeRecoverySnapshot | null> {
  const result = await nativeInvoke<string | null>('load_takeoff_recovery');
  if (!result.ok || !result.value) return null;
  try {
    const parsed = JSON.parse(result.value) as NativeRecoverySnapshot;
    return parsed?.schemaVersion === 1 || parsed?.schemaVersion === 2 ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearNativeTakeoffRecovery() {
  const result = await nativeInvoke<void>('clear_takeoff_recovery');
  return result.ok;
}

export function isNativeTakeoffShell() {
  return tauriAvailable();
}
