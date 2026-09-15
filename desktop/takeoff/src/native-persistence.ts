import type { TakeoffRecoverySnapshot } from './takeoff-model';

function tauriAvailable() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!tauriAvailable()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch {
    return null;
  }
}

export async function saveNativeTakeoffRecovery(snapshot: TakeoffRecoverySnapshot) {
  if (!tauriAvailable()) return false;
  const result = await invokeNative<undefined>('save_takeoff_recovery', { json: JSON.stringify(snapshot) });
  return result !== null || tauriAvailable();
}

export async function loadNativeTakeoffRecovery(): Promise<TakeoffRecoverySnapshot | null> {
  const raw = await invokeNative<string | null>('load_takeoff_recovery');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TakeoffRecoverySnapshot;
    return parsed?.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearNativeTakeoffRecovery() {
  if (!tauriAvailable()) return false;
  await invokeNative<undefined>('clear_takeoff_recovery');
  return true;
}

export function isNativeTakeoffShell() {
  return tauriAvailable();
}
