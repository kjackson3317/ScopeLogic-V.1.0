import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppBluebeam';
import { isNativeTakeoffShell, loadNativeTakeoffRecovery } from './native-persistence';
import { recoveryStorageKey } from './persistence';
import type { TakeoffRecoverySnapshot } from './takeoff-model';
import './styles.css';
import './bluebeam.css';

function parseLocalRecovery(): TakeoffRecoverySnapshot | null {
  try {
    const raw = window.localStorage.getItem(recoveryStorageKey());
    return raw ? JSON.parse(raw) as TakeoffRecoverySnapshot : null;
  } catch {
    return null;
  }
}

async function hydrateNativeRecovery() {
  if (!isNativeTakeoffShell()) return;
  const native = await loadNativeTakeoffRecovery();
  if (!native) return;

  const local = parseLocalRecovery();
  const nativeSavedAt = Date.parse(native.savedAt || '');
  const localSavedAt = Date.parse(local?.savedAt || '');
  const nativeIsNewer = !local || !Number.isFinite(localSavedAt) || (Number.isFinite(nativeSavedAt) && nativeSavedAt > localSavedAt);

  if (nativeIsNewer) {
    try {
      window.localStorage.setItem(recoveryStorageKey(), JSON.stringify(native));
    } catch {
      // Native recovery remains available even when the WebView storage layer is unavailable.
    }
  }
}

async function bootstrap() {
  await hydrateNativeRecovery();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
