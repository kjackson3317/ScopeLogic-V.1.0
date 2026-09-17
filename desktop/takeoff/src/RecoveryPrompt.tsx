import { recoverySummary } from './persistence';
import type { TakeoffRecoverySnapshot } from './takeoff-model';

type Props = {
  snapshot: TakeoffRecoverySnapshot;
  onRestore: () => void;
  onStartFresh: () => void;
};

export default function RecoveryPrompt({ snapshot, onRestore, onStartFresh }: Props) {
  const summary = recoverySummary(snapshot);
  const saved = new Date(summary.savedAt);
  return (
    <div className="recovery-banner" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <div className="recovery-card">
        <h2 id="recovery-title">Recovered Takeoff Session</h2>
        <p>Technology Preconstruction Takeoff found locally preserved drawing work. Restoring is always explicit; nothing is pushed to an estimate or BOM by this action.</p>
        <div className="recovery-meta">
          <span>Project</span><b>{summary.name || 'Takeoff Project'}</b>
          <span>Drawing</span><b>{summary.drawingName || 'Unknown drawing'}</b>
          <span>Pages</span><b>{summary.pageCount || '—'}</b>
          <span>Saved</span><b>{Number.isNaN(saved.valueOf()) ? summary.savedAt : saved.toLocaleString()}</b>
        </div>
        <div className="recovery-actions">
          <button className="button" onClick={onStartFresh}>Start Fresh</button>
          <button className="button primary" onClick={onRestore}>Restore Session</button>
        </div>
      </div>
    </div>
  );
}
