import { useState } from 'react';
import SymbolPicker from './SymbolPicker';
import { TakeoffSymbol } from './symbol-registry';
import type { Mark, Tool } from './takeoff-model';
import { legacyShapeToSymbolId } from './tool-normalization';
import './count-properties.css';

type Props = {
  mark: Mark | null;
  tool: Tool | null;
  pageLabel?: string;
  countOnPage?: number;
  countInProject?: number;
  isDefaultTool?: boolean;
  onUpdateTool: (patch: Partial<Tool>) => void;
  onUpdateMark: (patch: Partial<Mark>) => void;
  onSetDefault: () => void;
  onDuplicateTool: () => void;
  onDelete: () => void;
};

const QUICK_SYMBOLS = [
  'builtin.generic.circle',
  'builtin.generic.triangle',
  'builtin.generic.square',
  'builtin.generic.diamond',
  'builtin.generic.device',
];

function toolSymbolId(tool: Tool) {
  return tool.symbolId || legacyShapeToSymbolId(tool.shape);
}

function formatModified(value?: string) {
  if (!value) return 'Current session';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Current session' : parsed.toLocaleString();
}

export default function CountPropertiesPanel({
  mark,
  tool,
  pageLabel,
  countOnPage = 0,
  countInProject = 0,
  isDefaultTool = false,
  onUpdateTool,
  onUpdateMark,
  onSetDefault,
  onDuplicateTool,
  onDelete,
}: Props) {
  const [showAllSymbols, setShowAllSymbols] = useState(false);

  if (!mark || !tool) {
    return (
      <div className="count-properties-panel empty">
        <div className="count-properties-title"><span className="properties-gear">⚙</span><b>Count Measurement Properties</b></div>
        <div className="properties-empty-state">
          <b>Select a count symbol</b>
          <span>Use the Select arrow, then click a placed count to view and edit its properties.</span>
        </div>
      </div>
    );
  }

  const symbolId = toolSymbolId(tool);
  const opacity = Math.round((tool.opacity ?? 1) * 100);
  const size = tool.size ?? 22;

  return (
    <div className="count-properties-panel">
      <div className="count-properties-title"><span className="properties-gear">⚙</span><b>Count Measurement Properties</b></div>

      <details open className="properties-section">
        <summary>General</summary>
        <div className="properties-section-body">
          <label className="property-field"><span>Author:</span><input value="ScopeLogic User" readOnly /></label>
          <label className="property-field"><span>Subject:</span><input value={tool.name} onChange={(event) => onUpdateTool({ name: event.target.value })} /></label>
          <label className="property-field"><span>Label:</span><input value={mark.label || ''} onChange={(event) => onUpdateMark({ label: event.target.value })} /></label>
          <textarea
            className="property-comments"
            value={mark.comments || ''}
            onChange={(event) => onUpdateMark({ comments: event.target.value })}
            placeholder="Comments"
            aria-label="Count comments"
          />
          <div className="property-meta">Modified: {formatModified(mark.updatedAt || mark.createdAt)}</div>
          <label className="property-check"><input type="checkbox" checked={Boolean(mark.locked)} onChange={(event) => onUpdateMark({ locked: event.target.checked })} /> Lock</label>
          <div className="property-location"><span>{pageLabel || `Page ${mark.page}`}</span><span>Page count {countOnPage}</span><span>Project count {countInProject}</span></div>
        </div>
      </details>

      <details open className="properties-section">
        <summary>Appearance</summary>
        <div className="properties-section-body">
          <label className="property-field compact"><span>Color:</span><input className="property-color" type="color" value={tool.color} onChange={(event) => onUpdateTool({ color: event.target.value })} /></label>
          <label className="property-field compact"><span>Opacity:</span><input type="number" min="10" max="100" step="5" value={opacity} onChange={(event) => onUpdateTool({ opacity: Math.max(.1, Math.min(1, Number(event.target.value) / 100)) })} /></label>

          <div className="quick-symbol-row" role="group" aria-label="Quick count symbol shapes">
            {QUICK_SYMBOLS.map((id) => (
              <button key={id} type="button" className={symbolId === id ? 'selected' : ''} onClick={() => onUpdateTool({ symbolId: id })} title="Change symbol">
                <TakeoffSymbol symbolId={id} color={tool.color} size={20} />
              </button>
            ))}
            <button type="button" className={showAllSymbols ? 'selected more-symbols' : 'more-symbols'} onClick={() => setShowAllSymbols((value) => !value)} title="More device symbols">⌄</button>
          </div>

          {showAllSymbols && <SymbolPicker value={symbolId} color={tool.color} onChange={(id) => onUpdateTool({ symbolId: id })} />}

          <label className="property-field compact"><span>Scale:</span><input type="number" min="12" max="64" step="1" value={size} onChange={(event) => onUpdateTool({ size: Math.max(12, Math.min(64, Number(event.target.value))) })} /></label>
          <label className="property-check"><input type="checkbox" checked={Boolean(tool.showCaption)} onChange={(event) => onUpdateTool({ showCaption: event.target.checked })} /> Show Caption</label>
        </div>
      </details>

      <details open className="properties-section">
        <summary>Custom</summary>
        <div className="properties-section-body">
          <label className="property-field compact"><span>Custom Count:</span><input value="1" readOnly /></label>
          <div className="property-note">One placed symbol always equals one raw drawing count. ScopeLogic Take Off Rules own downstream multipliers, material, and labor.</div>
        </div>
      </details>

      <details open className="properties-section">
        <summary>Options</summary>
        <div className="properties-section-body properties-options">
          <button type="button" onClick={onDuplicateTool}>Add to Tool Chest</button>
          <button type="button" className={isDefaultTool ? 'active' : ''} onClick={onSetDefault}>{isDefaultTool ? 'Default Count Tool' : 'Set as Default'}</button>
          <button type="button" className="delete-property" onClick={onDelete}>Delete Selected</button>
        </div>
      </details>
    </div>
  );
}
