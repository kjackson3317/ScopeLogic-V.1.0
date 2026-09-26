import type { Measurement, MeasurementKind } from './measurements';
import { formatMeasurement } from './measurements';
import { TakeoffSymbol } from './symbol-registry';
import type { Tool } from './takeoff-model';
import { legacyShapeToSymbolId } from './tool-normalization';

export type TakeoffDockTab = 'totals' | 'measurements' | 'sync';
export type TakeoffQuantityScope = 'current_sheet' | 'entire_set';

export type TakeoffDockTotal = {
  tool: Tool;
  currentSheetCount: number;
  entireSetCount: number;
};

export type TakeoffDockMeasurement = {
  measurement: Measurement;
  value: number;
};

export type TakeoffDockSyncRow = TakeoffDockTotal & {
  appliedCount: number;
  difference: number;
};

export type TakeoffBottomDockProps = {
  tab: TakeoffDockTab;
  onTabChange: (tab: TakeoffDockTab) => void;
  scope: TakeoffQuantityScope;
  onScopeChange: (scope: TakeoffQuantityScope) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  totals: TakeoffDockTotal[];
  measurements: TakeoffDockMeasurement[];
  syncRows: TakeoffDockSyncRow[];
  selectedToolId?: string;
  activeToolId?: string;
  activeToolSheetCount?: number;
  activeToolProjectCount?: number;
  syncSelection: Record<string, boolean>;
  onSyncSelectionChange: (toolId: string, selected: boolean) => void;
  onApplySelectedSync: () => void;
  onSelectTool: (toolId: string) => void;
  onGoToMeasurement: (measurement: Measurement) => void;
};

const toolSymbolId = (tool: Tool) => tool.symbolId || legacyShapeToSymbolId(tool.shape);
const countForScope = (row: TakeoffDockTotal, scope: TakeoffQuantityScope) => (
  scope === 'current_sheet' ? row.currentSheetCount : row.entireSetCount
);

function tabLabel(tab: TakeoffDockTab) {
  if (tab === 'totals') return 'Takeoff Totals';
  if (tab === 'measurements') return 'Measurements';
  return 'Sync Review';
}

function measurementTypeLabel(kind: MeasurementKind) {
  if (kind === 'polyline') return 'Length';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export default function TakeoffBottomDock({
  tab,
  onTabChange,
  scope,
  onScopeChange,
  collapsed,
  onCollapsedChange,
  totals,
  measurements,
  syncRows,
  selectedToolId,
  activeToolId,
  activeToolSheetCount = 0,
  activeToolProjectCount = 0,
  syncSelection,
  onSyncSelectionChange,
  onApplySelectedSync,
  onSelectTool,
  onGoToMeasurement,
}: TakeoffBottomDockProps) {
  const activeTool = totals.find((row) => row.tool.id === activeToolId)?.tool;
  const pendingSyncCount = syncRows.filter((row) => row.difference !== 0).length;
  const canApplySelected = syncRows.some((row) => (
    (syncSelection[row.tool.id] ?? true) && row.difference !== 0
  ));

  if (collapsed) {
    return (
      <section className="takeoff-bottom-dock collapsed">
        <div className="takeoff-dock-collapsed-bar">
          <button type="button" className="dock-expand" onClick={() => onCollapsedChange(false)} aria-label="Expand Takeoff dock">▲</button>
          <strong>{tabLabel(tab)}</strong>
          {activeTool && (
            <span className="dock-active-count">
              <TakeoffSymbol symbolId={toolSymbolId(activeTool)} color={activeTool.color} size={16} />
              {activeTool.name}
              <b>Sheet {activeToolSheetCount}</b>
              <b>Project {activeToolProjectCount}</b>
            </span>
          )}
          {pendingSyncCount > 0 && <span className="dock-pending">{pendingSyncCount} pending</span>}
        </div>
      </section>
    );
  }

  return (
    <section className="takeoff-bottom-dock">
      <header className="takeoff-dock-header">
        <nav className="takeoff-dock-tabs" aria-label="Takeoff detail views">
          {(['totals', 'measurements', 'sync'] as TakeoffDockTab[]).map((item) => (
            <button
              type="button"
              key={item}
              className={tab === item ? 'active' : ''}
              onClick={() => onTabChange(item)}
            >
              {tabLabel(item)}
              {item === 'sync' && pendingSyncCount > 0 && <span className="dock-tab-badge">{pendingSyncCount}</span>}
            </button>
          ))}
        </nav>

        <div className="takeoff-dock-actions">
          {(tab === 'totals' || tab === 'measurements') && (
            <label className="dock-scope">
              <span>Scope</span>
              <select value={scope} onChange={(event) => onScopeChange(event.target.value as TakeoffQuantityScope)}>
                <option value="current_sheet">Current Sheet</option>
                <option value="entire_set">Entire Set</option>
              </select>
            </label>
          )}
          <button type="button" className="dock-collapse" onClick={() => onCollapsedChange(true)} aria-label="Collapse Takeoff dock">▼</button>
        </div>
      </header>

      {activeTool && tab === 'totals' && (
        <div className="takeoff-active-strip">
          <span>ACTIVE TAKEOFF</span>
          <TakeoffSymbol symbolId={toolSymbolId(activeTool)} color={activeTool.color} size={18} />
          <b>{activeTool.name}</b>
          <span className="active-count-stat">Sheet <strong>{activeToolSheetCount}</strong></span>
          <span className="active-count-stat">Project <strong>{activeToolProjectCount}</strong></span>
        </div>
      )}

      <div className="takeoff-dock-body">
        {tab === 'totals' && (
          <div className="takeoff-dock-table totals-table">
            <div className="takeoff-dock-table-head">
              <span>Symbol</span><span>Tool</span><span>Count</span>
            </div>
            {!totals.length && <div className="takeoff-dock-empty">Select a Takeoff Tool and place symbols on the drawing to begin.</div>}
            {totals.map((row) => {
              const count = countForScope(row, scope);
              if (!count && scope === 'current_sheet') return null;
              return (
                <button
                  type="button"
                  key={row.tool.id}
                  className={row.tool.id === selectedToolId ? 'takeoff-dock-row selected' : 'takeoff-dock-row'}
                  onClick={() => onSelectTool(row.tool.id)}
                >
                  <span><TakeoffSymbol symbolId={toolSymbolId(row.tool)} color={row.tool.color} size={18} /></span>
                  <span className="dock-tool-name"><b>{row.tool.name}</b><small>Raw drawing count</small></span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'measurements' && (
          <div className="takeoff-dock-table measurement-table">
            <div className="takeoff-dock-table-head measurement-head">
              <span>Measurement</span><span>Sheet</span><span>Type</span><span>Value</span>
            </div>
            {!measurements.length && <div className="takeoff-dock-empty">Distance, polyline, area, and perimeter measurements will appear here.</div>}
            {measurements.map(({ measurement, value }) => (
              <button type="button" className="takeoff-dock-row measurement-dock-row" key={measurement.id} onClick={() => onGoToMeasurement(measurement)}>
                <span className="dock-tool-name"><b>{measurement.name}</b><small>{measurement.points.length} points</small></span>
                <span>Page {measurement.page}</span>
                <span>{measurementTypeLabel(measurement.kind)}</span>
                <strong>{formatMeasurement(value, measurement.kind)}</strong>
              </button>
            ))}
          </div>
        )}

        {tab === 'sync' && (
          <div className="sync-dock-layout">
            <div className="takeoff-dock-table sync-dock-table">
              <div className="takeoff-dock-table-head sync-dock-head">
                <span /><span>Tool</span><span>Drawing</span><span>Applied</span><span>Difference</span>
              </div>
              {!syncRows.length && <div className="takeoff-dock-empty">Complete a count takeoff first.</div>}
              {syncRows.map((row) => (
                <label className={row.difference === 0 ? 'sync-dock-row current' : 'sync-dock-row'} key={row.tool.id}>
                  <input
                    type="checkbox"
                    checked={syncSelection[row.tool.id] ?? true}
                    disabled={row.difference === 0}
                    onChange={(event) => onSyncSelectionChange(row.tool.id, event.target.checked)}
                  />
                  <span className="dock-tool-name"><b>{row.tool.name}</b><small>each</small></span>
                  <strong>{row.entireSetCount}</strong>
                  <strong>{row.appliedCount}</strong>
                  <strong className={row.difference === 0 ? 'sync-difference zero' : 'sync-difference'}>{row.difference > 0 ? '+' : ''}{row.difference}</strong>
                </label>
              ))}
            </div>
            <aside className="sync-dock-actions">
              <p>Drawing quantities remain unchanged in the estimate until you explicitly apply them.</p>
              <button type="button" className="button primary" disabled={!canApplySelected} onClick={onApplySelectedSync}>Apply Selected</button>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
