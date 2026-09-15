import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Shape = 'square' | 'triangle' | 'circle' | 'diamond';
type Mode = 'pan' | 'count';

type Tool = {
  id: string;
  name: string;
  shape: Shape;
  color: string;
  multiplier: number;
  unit: string;
};

type Mark = {
  id: string;
  page: number;
  toolId: string;
  x: number;
  y: number;
};

type SummaryRow = {
  tool: Tool;
  locations: number;
  qty: number;
};

const COLORS = ['#4B6623', '#31513b', '#2563eb', '#b45309', '#b91c1c', '#6d28d9', '#111827', '#0e7490'];
const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond'];
const uid = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');

function ShapeMark({ shape, color, size = 14 }: { shape: Shape; color: string; size?: number }) {
  if (shape === 'circle') return <span className="tool-shape circle" style={{ width: size, height: size, background: color }} />;
  if (shape === 'square') return <span className="tool-shape square" style={{ width: size, height: size, background: color }} />;
  if (shape === 'diamond') return <span className="tool-shape diamond" style={{ width: size, height: size, background: color }} />;
  return <span className="tool-shape triangle" style={{ borderLeftWidth: size / 2, borderRightWidth: size / 2, borderBottomWidth: size, borderBottomColor: color }} />;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 900, height: 1160 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>('count');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selectedMarkId, setSelectedMarkId] = useState('');
  const [tools, setTools] = useState<Tool[]>([
    { id: 'default-count', name: 'Count Item', shape: 'circle', color: '#4B6623', multiplier: 1, unit: 'qty' },
  ]);
  const [selectedToolId, setSelectedToolId] = useState('default-count');
  const [showToolForm, setShowToolForm] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', shape: 'circle' as Shape, color: '#4B6623', multiplier: 1, unit: 'qty' });
  const [rightTab, setRightTab] = useState<'takeoff' | 'sync'>('takeoff');
  const [estimateQty, setEstimateQty] = useState<Record<string, number>>({});
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState('Open a PDF drawing set to begin.');

  useEffect(() => {
    let cancelled = false;
    if (!pdfDoc || !canvasRef.current) return;

    const render = async () => {
      setLoading(true);
      setError('');
      try {
        const pdfPage = await pdfDoc.getPage(page);
        const displayViewport = pdfPage.getViewport({ scale: zoom });
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const renderViewport = pdfPage.getViewport({ scale: zoom * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${displayViewport.width}px`;
        canvas.style.height = `${displayViewport.height}px`;
        setPageSize({ width: displayViewport.width, height: displayViewport.height });

        await pdfPage.render({ canvasContext: context, viewport: renderViewport }).promise;
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The drawing page could not be rendered.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void render();
    return () => { cancelled = true; };
  }, [pdfDoc, page, zoom]);

  const summary = useMemo<SummaryRow[]>(() => {
    const rows = new Map<string, SummaryRow>();
    for (const mark of marks) {
      const tool = tools.find((item) => item.id === mark.toolId);
      if (!tool) continue;
      const current = rows.get(tool.id) || { tool, locations: 0, qty: 0 };
      current.locations += 1;
      current.qty += Number(tool.multiplier) || 0;
      rows.set(tool.id, current);
    }
    return [...rows.values()].sort((a, b) => a.tool.name.localeCompare(b.tool.name));
  }, [marks, tools]);

  const syncRows = useMemo(() => summary.map((row) => {
    const current = estimateQty[row.tool.id] || 0;
    return { ...row, current, difference: row.qty - current };
  }), [summary, estimateQty]);

  const syncRequired = syncRows.some((row) => row.difference !== 0);

  useEffect(() => {
    setSyncSelection((current) => {
      const next = { ...current };
      for (const row of summary) if (!(row.tool.id in next)) next[row.tool.id] = true;
      return next;
    });
  }, [summary]);

  const openPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      setPdfDoc(doc);
      setFileName(file.name);
      setPage(1);
      setPageCount(doc.numPages);
      setZoom(1);
      setMarks([]);
      setEstimateQty({});
      setActivity(`${file.name} loaded. ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} ready for takeoff.`);
    } catch (cause) {
      setPdfDoc(null);
      setFileName('');
      setPageCount(0);
      setError(cause instanceof Error ? cause.message : 'The selected PDF could not be opened.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const clickOverlay = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (mode !== 'count' || !pdfDoc) return;
    const tool = tools.find((item) => item.id === selectedToolId);
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!tool || !rect) return;
    const mark: Mark = {
      id: uid(),
      page,
      toolId: tool.id,
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
    setMarks((items) => [...items, mark]);
    setSelectedMarkId(mark.id);
    setActivity(`${tool.name} added on page ${page}. Estimate quantities remain unchanged until Sync Review is applied.`);
  };

  const addTool = () => {
    const name = newTool.name.trim();
    if (!name) return;
    const tool: Tool = {
      id: uid(),
      name,
      shape: newTool.shape,
      color: newTool.color,
      multiplier: Math.max(0, Number(newTool.multiplier) || 1),
      unit: newTool.unit.trim() || 'qty',
    };
    setTools((items) => [...items, tool]);
    setSelectedToolId(tool.id);
    setMode('count');
    setNewTool({ name: '', shape: 'circle', color: '#4B6623', multiplier: 1, unit: 'qty' });
    setShowToolForm(false);
    setActivity(`${tool.name} added to the local Tool Chest.`);
  };

  const deleteSelectedMark = () => {
    if (!selectedMarkId) return;
    setMarks((items) => items.filter((item) => item.id !== selectedMarkId));
    setSelectedMarkId('');
    setActivity('Selected takeoff mark removed. Sync Review will show the resulting quantity difference.');
  };

  const applySelectedSync = () => {
    setEstimateQty((current) => {
      const next = { ...current };
      for (const row of syncRows) if (syncSelection[row.tool.id]) next[row.tool.id] = row.qty;
      return next;
    });
    setActivity('Selected Takeoff quantities applied to the local estimate preview. Cloud Quote/BOM connection is the next integration phase.');
  };

  const pageMarks = marks.filter((mark) => mark.page === page);
  const selectedTool = tools.find((item) => item.id === selectedToolId);

  return (
    <div className="desktop-shell">
      <header className="desktop-topbar">
        <div className="desktop-brand">
          <div className="brand-mark">S</div>
          <div><strong>ScopeLogic</strong><span>Takeoff Desktop</span></div>
        </div>
        <div className="project-strip">
          <span>WORKSPACE</span>
          <b>{fileName || 'No drawing set open'}</b>
        </div>
        <div className="sync-state">
          <span className={syncRequired ? 'status-dot warning' : 'status-dot ok'} />
          <div><strong>{syncRequired ? 'Sync Required' : 'In Sync'}</strong><small>Explicit review only</small></div>
        </div>
      </header>

      <div className="command-bar">
        <label className="button primary file-button">
          Open PDF
          <input type="file" accept="application/pdf,.pdf" onChange={openPdf} />
        </label>
        <div className="command-separator" />
        <button className={mode === 'pan' ? 'button active' : 'button'} onClick={() => setMode('pan')}>Pan</button>
        <button className={mode === 'count' ? 'button active' : 'button'} onClick={() => setMode('count')}>Count</button>
        <div className="command-separator" />
        <button className="button" disabled={!pdfDoc || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>◀</button>
        <div className="page-readout">Page <b>{pageCount ? `${page} / ${pageCount}` : '—'}</b></div>
        <button className="button" disabled={!pdfDoc || page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>▶</button>
        <div className="command-separator" />
        <button className="button" disabled={!pdfDoc} onClick={() => setZoom((value) => clamp(value / 1.2, 0.2, 4))}>−</button>
        <div className="zoom-readout">{Math.round(zoom * 100)}%</div>
        <button className="button" disabled={!pdfDoc} onClick={() => setZoom((value) => clamp(value * 1.2, 0.2, 4))}>+</button>
        <button className="button" disabled={!pdfDoc} onClick={() => setZoom(1)}>100%</button>
        <div className="command-spacer" />
        <button className="button primary" disabled={!summary.length} onClick={() => setRightTab('sync')}>Review Sync</button>
      </div>

      <div className="desktop-workspace">
        <aside className="left-rail">
          <section className="rail-section pages-section">
            <div className="rail-heading"><b>Pages</b><span>{pageCount || 0}</span></div>
            <div className="page-list">
              {!pageCount && <div className="empty-compact">Open a PDF drawing set.</div>}
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button key={pageNumber} className={pageNumber === page ? 'page-row active' : 'page-row'} onClick={() => setPage(pageNumber)}>
                  <span className="page-thumb">{pageNumber}</span>
                  <span><b>Page {pageNumber}</b><small>{marks.filter((mark) => mark.page === pageNumber).length} marks</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className="rail-section tool-section">
            <div className="rail-heading"><b>Tool Chest</b><button onClick={() => setShowToolForm((value) => !value)}>+ Tool</button></div>
            {showToolForm && (
              <div className="tool-form">
                <label><span>Name</span><input value={newTool.name} onChange={(event) => setNewTool({ ...newTool, name: event.target.value })} placeholder="Count tool name" /></label>
                <div className="tool-form-grid">
                  <label><span>Shape</span><select value={newTool.shape} onChange={(event) => setNewTool({ ...newTool, shape: event.target.value as Shape })}>{SHAPES.map((shape) => <option key={shape}>{shape}</option>)}</select></label>
                  <label><span>Multiplier</span><input type="number" min="0" step="0.01" value={newTool.multiplier} onChange={(event) => setNewTool({ ...newTool, multiplier: Number(event.target.value) })} /></label>
                </div>
                <label><span>Unit</span><input value={newTool.unit} onChange={(event) => setNewTool({ ...newTool, unit: event.target.value })} /></label>
                <div className="color-row">{COLORS.map((color) => <button key={color} className={newTool.color === color ? 'selected' : ''} style={{ background: color }} aria-label={`Use ${color}`} onClick={() => setNewTool({ ...newTool, color })} />)}</div>
                <div className="tool-form-actions"><button className="button" onClick={() => setShowToolForm(false)}>Cancel</button><button className="button primary" disabled={!newTool.name.trim()} onClick={addTool}>Add Tool</button></div>
              </div>
            )}
            <div className="tool-list">
              {tools.map((tool) => (
                <button key={tool.id} className={tool.id === selectedToolId ? 'tool-row active' : 'tool-row'} onClick={() => { setSelectedToolId(tool.id); setMode('count'); }}>
                  <ShapeMark shape={tool.shape} color={tool.color} />
                  <span><b>{tool.name}</b><small>×{fmt(tool.multiplier)} {tool.unit}</small></span>
                </button>
              ))}
            </div>
            {selectedTool && <div className="active-tool"><span>Active</span><b>{selectedTool.name}</b></div>}
            <button className="button danger wide" disabled={!selectedMarkId} onClick={deleteSelectedMark}>Delete Selected Mark</button>
          </section>
        </aside>

        <main className="drawing-panel">
          {loading && <div className="drawing-message">Loading drawing…</div>}
          {error && <div className="drawing-message error"><b>PDF could not be opened.</b><span>{error}</span></div>}
          {!pdfDoc && !loading && !error && <div className="drawing-message"><b>Open a PDF drawing set</b><span>The desktop viewer will keep Takeoff quantities separate from Estimate quantities until you explicitly sync them.</span></div>}
          {pdfDoc && (
            <div className={mode === 'pan' ? 'drawing-scroll pan-mode' : 'drawing-scroll count-mode'}>
              <div className="drawing-stage" style={{ width: pageSize.width, height: pageSize.height }}>
                <canvas ref={canvasRef} />
                <svg ref={overlayRef} width={pageSize.width} height={pageSize.height} viewBox={`0 0 ${pageSize.width} ${pageSize.height}`} onClick={clickOverlay}>
                  {pageMarks.map((mark) => {
                    const tool = tools.find((item) => item.id === mark.toolId);
                    if (!tool) return null;
                    const x = mark.x * pageSize.width;
                    const y = mark.y * pageSize.height;
                    const selected = mark.id === selectedMarkId;
                    const common = { className: selected ? 'drawing-mark selected' : 'drawing-mark', onClick: (event: ReactMouseEvent<SVGElement>) => { event.stopPropagation(); setSelectedMarkId(mark.id); } };
                    if (tool.shape === 'circle') return <circle key={mark.id} {...common} cx={x} cy={y} r="8" fill={tool.color} />;
                    if (tool.shape === 'square') return <rect key={mark.id} {...common} x={x - 8} y={y - 8} width="16" height="16" fill={tool.color} />;
                    if (tool.shape === 'diamond') return <rect key={mark.id} {...common} x={x - 7} y={y - 7} width="14" height="14" fill={tool.color} transform={`rotate(45 ${x} ${y})`} />;
                    return <polygon key={mark.id} {...common} points={`${x},${y - 9} ${x - 9},${y + 8} ${x + 9},${y + 8}`} fill={tool.color} />;
                  })}
                </svg>
              </div>
            </div>
          )}
          <div className="activity-bar"><span>{activity}</span><b>{mode === 'count' ? `COUNT · ${selectedTool?.name || 'No Tool'}` : 'PAN'}</b></div>
        </main>

        <aside className="right-rail">
          <div className="right-tabs">
            <button className={rightTab === 'takeoff' ? 'active' : ''} onClick={() => setRightTab('takeoff')}>Live Takeoff</button>
            <button className={rightTab === 'sync' ? 'active' : ''} onClick={() => setRightTab('sync')}>Sync Review</button>
          </div>

          {rightTab === 'takeoff' && (
            <div className="right-content">
              <div className="panel-title"><b>Takeoff Summary</b><span>{marks.length} marks</span></div>
              {!summary.length && <div className="empty-compact">Placed count marks will summarize here.</div>}
              <div className="summary-table">
                {summary.map((row) => (
                  <div className="summary-row" key={row.tool.id}>
                    <span><ShapeMark shape={row.tool.shape} color={row.tool.color} /><span><b>{row.tool.name}</b><small>{row.locations} locations</small></span></span>
                    <strong>{fmt(row.qty)}</strong>
                    <small>{row.tool.unit}</small>
                  </div>
                ))}
              </div>
              <div className="rule-placeholder"><span>Next connection</span><b>Tool → Rule / Assembly → BOM</b><p>The desktop shell is now ready for the shared ScopeLogic Rules and Quote integration.</p></div>
            </div>
          )}

          {rightTab === 'sync' && (
            <div className="right-content">
              <div className="panel-title"><b>Sync Review</b><span>{syncRequired ? 'Changes pending' : 'No changes'}</span></div>
              <p className="sync-help">Drawing changes never overwrite Estimate/BOM quantities automatically. Review each difference and apply only the rows you intend to change.</p>
              {!syncRows.length && <div className="empty-compact">Complete a takeoff first.</div>}
              <div className="sync-table">
                {syncRows.map((row) => (
                  <label className="sync-row" key={row.tool.id}>
                    <input type="checkbox" checked={syncSelection[row.tool.id] ?? true} onChange={(event) => setSyncSelection({ ...syncSelection, [row.tool.id]: event.target.checked })} />
                    <span><b>{row.tool.name}</b><small>{row.tool.unit}</small></span>
                    <span><small>Takeoff</small><b>{fmt(row.qty)}</b></span>
                    <span><small>Estimate</small><b>{fmt(row.current)}</b></span>
                    <span className={row.difference === 0 ? 'diff zero' : 'diff'}><small>Difference</small><b>{row.difference > 0 ? '+' : ''}{fmt(row.difference)}</b></span>
                  </label>
                ))}
              </div>
              <button className="button primary wide" disabled={!syncRows.some((row) => (syncSelection[row.tool.id] ?? true) && row.difference !== 0)} onClick={applySelectedSync}>Apply Selected Changes</button>
              <div className="local-preview-note">Phase 1 uses a local estimate preview only. The next integration phase will send approved changes into the shared ScopeLogic Quote/BOM engine.</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
