import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { aggregateCounts, buildPackage, parsePackage, type TakeoffDocument, type TakeoffMark, type TakeoffTool, type ToolShape } from './takeoff-exchange';
import './styles.css';

GlobalWorkerOptions.workerSrc = pdfWorker;

type Mode = 'select' | 'pan' | 'count';
type CountScope = 'sheet' | 'set';
type Point = { x: number; y: number };

type ToolDraft = {
  name: string;
  system: string;
  shape: ToolShape;
  color: string;
  takeoffRuleId: string;
};

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeFileName = (value: string) => value.trim().toLowerCase();
const PROJECT_KEY = 'scopelogic.takeoff.desktop.project';
const PANEL_KEY = 'scopelogic.takeoff.desktop.panelHeight';
const DEFAULT_PANEL_HEIGHT = 260;

function Shape({ tool, size = 15 }: { tool: TakeoffTool; size?: number }) {
  if (tool.shape === 'triangle') return <span className="tool-symbol triangle" style={{ borderLeftWidth: size / 2, borderRightWidth: size / 2, borderBottomWidth: size, borderBottomColor: tool.color }} />;
  return <span className={`tool-symbol ${tool.shape}`} style={{ width: size, height: size, background: tool.color }} />;
}

function App() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; pan: Point } | null>(null);
  const markDragRef = useRef<{ pointerId: number; id: string } | null>(null);
  const resizeRef = useRef<{ startY: number; height: number } | null>(null);

  const [projectId, setProjectId] = useState('local-project');
  const [documents, setDocuments] = useState<TakeoffDocument[]>([]);
  const [tools, setTools] = useState<TakeoffTool[]>([]);
  const [marks, setMarks] = useState<TakeoffMark[]>([]);
  const [selectedToolId, setSelectedToolId] = useState('');
  const [selectedMarkId, setSelectedMarkId] = useState('');
  const [mode, setMode] = useState<Mode>('pan');
  const [countScope, setCountScope] = useState<CountScope>('set');
  const [toolSearch, setToolSearch] = useState('');
  const [countSearch, setCountSearch] = useState('');
  const [toolEditor, setToolEditor] = useState(false);
  const [toolDraft, setToolDraft] = useState<ToolDraft>({ name: '', system: 'Structured Cabling', shape: 'square', color: '#315f4a', takeoffRuleId: '' });

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [baseSize, setBaseSize] = useState({ width: 1000, height: 1300 });
  const [scale, setScale] = useState(.8);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [rendering, setRendering] = useState(false);
  const [message, setMessage] = useState('Open a PDF or import a ScopeLogic takeoff package.');
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null');
      if (saved?.projectId) setProjectId(saved.projectId);
      if (Array.isArray(saved?.documents)) setDocuments(saved.documents);
      if (Array.isArray(saved?.tools)) setTools(saved.tools);
      if (Array.isArray(saved?.marks)) setMarks(saved.marks);
      const savedHeight = Number(localStorage.getItem(PANEL_KEY));
      if (Number.isFinite(savedHeight)) setPanelHeight(clamp(savedHeight, 180, 520));
    } catch {
      setMessage('Local recovery data could not be read; a clean takeoff session was opened.');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PROJECT_KEY, JSON.stringify({ projectId, documents, tools, marks }));
  }, [projectId, documents, tools, marks]);

  useEffect(() => localStorage.setItem(PANEL_KEY, String(panelHeight)), [panelHeight]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!resizeRef.current) return;
      const next = resizeRef.current.height - (event.clientY - resizeRef.current.startY);
      setPanelHeight(clamp(next, 180, 520));
    };
    const end = () => { resizeRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);
    pdf.getPage(pageNum).then(async (page) => {
      const base = page.getViewport({ scale: 1 });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * pixelRatio });
      if (cancelled || !canvasRef.current) return;
      setBaseSize({ width: base.width, height: base.height });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${base.width * scale}px`;
      canvas.style.height = `${base.height * scale}px`;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'PDF page could not be rendered.')).finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [pdf, pageNum, scale]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input,select,textarea,[contenteditable="true"]')) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMarkId) {
        event.preventDefault();
        setMarks((current) => current.filter((mark) => mark.id !== selectedMarkId));
        setSelectedMarkId('');
      }
      if (event.key === 'Escape') setSelectedMarkId('');
      if (event.key.toLowerCase() === 'v') setMode('select');
      if (event.key.toLowerCase() === 'h') setMode('pan');
      if (event.key.toLowerCase() === 'c') setMode('count');
      if (event.key === '0') fitPage();
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  });

  const selectedTool = tools.find((tool) => tool.id === selectedToolId);
  const pageMarks = marks.filter((mark) => mark.documentId === documentId && mark.page === pageNum);
  const scopedMarks = marks.filter((mark) => countScope === 'sheet' ? mark.documentId === documentId && mark.page === pageNum : true);
  const counts = useMemo(() => {
    const totals = new Map(aggregateCounts(scopedMarks).map((row) => [row.toolId, row.count]));
    const query = countSearch.trim().toLowerCase();
    return tools
      .filter((tool) => (totals.get(tool.id) || 0) > 0)
      .filter((tool) => !query || `${tool.name} ${tool.system} ${tool.takeoffRuleId || ''}`.toLowerCase().includes(query))
      .map((tool) => ({ tool, count: totals.get(tool.id) || 0 }))
      .sort((a, b) => a.tool.system.localeCompare(b.tool.system) || a.tool.name.localeCompare(b.tool.name));
  }, [scopedMarks, tools, countSearch]);
  const visibleTotal = counts.reduce((sum, row) => sum + row.count, 0);

  const stageWidth = baseSize.width * scale;
  const stageHeight = baseSize.height * scale;

  function fitPage() {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const next = Math.min((viewer.clientWidth - 70) / baseSize.width, (viewer.clientHeight - 70) / baseSize.height);
    setScale(clamp(next, .08, 6));
    setPan({ x: 0, y: 0 });
  }

  function zoomAt(nextScale: number, clientX?: number, clientY?: number) {
    const viewer = viewerRef.current;
    const stage = stageRef.current;
    if (!viewer || !stage) return setScale(clamp(nextScale, .08, 6));
    const viewerRect = viewer.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const x = clientX ?? viewerRect.left + viewerRect.width / 2;
    const y = clientY ?? viewerRect.top + viewerRect.height / 2;
    const ux = clamp((x - stageRect.left) / Math.max(stageRect.width, 1), 0, 1);
    const uy = clamp((y - stageRect.top) / Math.max(stageRect.height, 1), 0, 1);
    const next = clamp(nextScale, .08, 6);
    const newWidth = baseSize.width * next;
    const newHeight = baseSize.height * next;
    const desiredLeft = x - ux * newWidth;
    const desiredTop = y - uy * newHeight;
    setScale(next);
    setPan({
      x: desiredLeft + newWidth / 2 - (viewerRect.left + viewerRect.width / 2),
      y: desiredTop + newHeight / 2 - (viewerRect.top + viewerRect.height / 2),
    });
  }

  async function openPdf(file?: File) {
    if (!file) return;
    try {
      setRendering(true);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const next = await getDocument({ data: bytes }).promise;
      const matchedDocument = documents.find((doc) => normalizeFileName(doc.fileName) === normalizeFileName(file.name));
      const nextDocumentId = matchedDocument?.id || `local:${file.name}`;
      if (!matchedDocument) setDocuments((current) => [...current, { id: nextDocumentId, fileName: file.name, name: file.name }]);
      setPdf(next);
      setPdfName(file.name);
      setDocumentId(nextDocumentId);
      setPageCount(next.numPages);
      setPageNum(1);
      setPan({ x: 0, y: 0 });
      setMessage(matchedDocument ? `${file.name} opened and matched to its ScopeLogic drawing record.` : `${file.name} opened as a local drawing.`);
      requestAnimationFrame(() => fitPage());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The PDF could not be opened.');
    } finally {
      setRendering(false);
    }
  }

  function drawingPoint(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clamp((clientX - rect.left) / rect.width, 0, 1), y: clamp((clientY - rect.top) / rect.height, 0, 1) };
  }

  function placeCount(event: React.PointerEvent<SVGSVGElement>) {
    if (mode !== 'count' || !selectedTool || !documentId) return;
    const point = drawingPoint(event.clientX, event.clientY);
    setMarks((current) => [...current, { id: uid('mark'), documentId, page: pageNum, toolId: selectedTool.id, ...point }]);
  }

  function beginMark(event: React.PointerEvent<SVGElement>, mark: TakeoffMark) {
    event.stopPropagation();
    setSelectedMarkId(mark.id);
    setSelectedToolId(mark.toolId);
    if (mode !== 'select') return;
    event.preventDefault();
    markDragRef.current = { pointerId: event.pointerId, id: mark.id };
    overlayRef.current?.setPointerCapture(event.pointerId);
  }

  function moveMark(event: React.PointerEvent<SVGSVGElement>) {
    const drag = markDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || mode !== 'select') return;
    const point = drawingPoint(event.clientX, event.clientY);
    setMarks((current) => current.map((mark) => mark.id === drag.id ? { ...mark, ...point } : mark));
  }

  function endMark(event: React.PointerEvent<SVGSVGElement>) {
    if (markDragRef.current?.pointerId !== event.pointerId) return;
    overlayRef.current?.releasePointerCapture(event.pointerId);
    markDragRef.current = null;
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    if (mode !== 'pan' || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, pan };
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const drag = panRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({ x: drag.pan.x + event.clientX - drag.startX, y: drag.pan.y + event.clientY - drag.startY });
  }

  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    panRef.current = null;
  }

  function saveTool() {
    if (!toolDraft.name.trim()) return;
    const tool: TakeoffTool = {
      id: uid('tool'),
      name: toolDraft.name.trim(),
      system: toolDraft.system.trim() || 'General',
      shape: toolDraft.shape,
      color: toolDraft.color,
      scope: 'project',
      projectId,
      takeoffRuleId: toolDraft.takeoffRuleId.trim() || undefined,
    };
    setTools((current) => [...current, tool]);
    setSelectedToolId(tool.id);
    setMode('count');
    setToolEditor(false);
    setToolDraft({ name: '', system: tool.system, shape: 'square', color: '#315f4a', takeoffRuleId: '' });
  }

  function exportPackage() {
    const payload = buildPackage(projectId, documents, tools, marks);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectId || 'takeoff'}.sltakeoff.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${payload.counts.reduce((sum, row) => sum + row.count, 0)} raw symbol counts with ${payload.documents.length} drawing record${payload.documents.length === 1 ? '' : 's'}.`);
  }

  async function importPackage(file?: File) {
    if (!file) return;
    try {
      const parsed = parsePackage(JSON.parse(await file.text()));
      setProjectId(parsed.projectId);
      setDocuments(parsed.documents);
      setTools(parsed.tools);
      setMarks(parsed.marks);
      setSelectedToolId(parsed.tools[0]?.id || '');
      setSelectedMarkId('');
      setMessage(`Imported ${parsed.tools.length} tools, ${parsed.documents.length} drawing records, and ${parsed.marks.length} count marks. Rule links were preserved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Takeoff package could not be imported.');
    }
  }

  function jumpToCount(toolId: string) {
    const first = marks.find((mark) => mark.toolId === toolId && (countScope === 'set' || (mark.documentId === documentId && mark.page === pageNum))) || marks.find((mark) => mark.toolId === toolId);
    if (!first) return;
    setSelectedToolId(toolId);
    setSelectedMarkId(first.id);
    if (first.documentId === documentId) setPageNum(first.page);
    setMode('select');
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">SL</div><div><strong>ScopeLogic Takeoff</strong><span>V1 desktop drawing counts</span></div></div>
      <div className="top-actions">
        <button onClick={() => pdfInputRef.current?.click()}>Open PDF</button>
        <button className="secondary" onClick={() => packageInputRef.current?.click()}>Import Package</button>
        <button className="secondary" onClick={exportPackage} disabled={!tools.length}>Export Package</button>
      </div>
      <input ref={pdfInputRef} hidden type="file" accept="application/pdf" onChange={(event) => { openPdf(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <input ref={packageInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => { importPackage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    </header>

    <div className="toolbar">
      <div className="tool-group mode-tools">
        {([['select', 'Select', 'V'], ['pan', 'Pan', 'H'], ['count', 'Count', 'C']] as [Mode, string, string][]).map(([id, label, key]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}><span>{label}</span><kbd>{key}</kbd></button>)}
      </div>
      <div className="tool-group zoom-tools">
        <button className="secondary" onClick={() => fitPage()} disabled={!pdf}>Fit Page</button>
        <button className="secondary icon" onClick={() => zoomAt(scale / 1.18)} disabled={!pdf}>−</button>
        <span className="zoom-readout">{Math.round(scale * 100)}%</span>
        <button className="secondary icon" onClick={() => zoomAt(scale * 1.18)} disabled={!pdf}>+</button>
      </div>
      <div className="page-tools">
        <button className="secondary icon" disabled={!pdf || pageNum <= 1} onClick={() => { setPageNum((value) => Math.max(1, value - 1)); setPan({ x: 0, y: 0 }); }}>‹</button>
        <span>{pdf ? `${pageNum} / ${pageCount}` : 'No PDF'}</span>
        <button className="secondary icon" disabled={!pdf || pageNum >= pageCount} onClick={() => { setPageNum((value) => Math.min(pageCount, value + 1)); setPan({ x: 0, y: 0 }); }}>›</button>
      </div>
      <div className="document-name" title={pdfName}>{pdfName || 'No drawing open'}</div>
    </div>

    <main className="workspace" style={{ paddingBottom: panelOpen ? panelHeight : 48 }}>
      <aside className="left-dock">
        <div className="dock-head"><div><span>TOOL CHEST</span><b>{tools.length} count tools</b></div><button className="icon" onClick={() => setToolEditor(true)}>+</button></div>
        <div className="tool-search"><input placeholder="Find a tool" value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} /></div>
        <div className="tool-list">
          {!tools.length && <div className="empty-small">Import tools from ScopeLogic or create a count tool. The tool stores no BOM or labor logic.</div>}
          {tools.filter((tool) => !toolSearch.trim() || `${tool.name} ${tool.system} ${tool.takeoffRuleId || ''}`.toLowerCase().includes(toolSearch.toLowerCase())).map((tool) => <button key={tool.id} className={selectedToolId === tool.id ? 'selected' : ''} onClick={() => { setSelectedToolId(tool.id); setMode('count'); }}>
            <Shape tool={tool} />
            <span><b>{tool.name}</b><small>{tool.system}{tool.takeoffRuleId ? ' · rule linked' : ''}</small></span>
          </button>)}
        </div>
      </aside>

      <section ref={viewerRef} className={`viewer mode-${mode}`} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={(event) => { if (!pdf) return; event.preventDefault(); zoomAt(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY); }}>
        {!pdf && <div className="viewer-empty"><div className="empty-icon">PDF</div><h2>Open a drawing set</h2><p>Counts stay graphical here. ScopeLogic Take Off Rules define what each count includes.</p><button onClick={() => pdfInputRef.current?.click()}>Open PDF</button></div>}
        {pdf && <div ref={stageRef} className="drawing-stage" style={{ width: stageWidth, height: stageHeight, transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)` }}>
          <canvas ref={canvasRef} />
          <svg ref={overlayRef} width={stageWidth} height={stageHeight} viewBox={`0 0 ${stageWidth} ${stageHeight}`} onPointerDown={(event) => { if (event.target === event.currentTarget) placeCount(event); }} onPointerMove={moveMark} onPointerUp={endMark} onPointerCancel={endMark}>
            {pageMarks.map((mark) => {
              const tool = tools.find((item) => item.id === mark.toolId);
              if (!tool) return null;
              const x = mark.x * stageWidth;
              const y = mark.y * stageHeight;
              const selected = mark.id === selectedMarkId;
              const common = { className: `count-mark ${selected ? 'selected' : ''}`, onPointerDown: (event: React.PointerEvent<SVGElement>) => beginMark(event, mark) };
              if (tool.shape === 'circle') return <circle key={mark.id} {...common} cx={x} cy={y} r={10} fill={tool.color} />;
              if (tool.shape === 'square') return <rect key={mark.id} {...common} x={x - 10} y={y - 10} width={20} height={20} fill={tool.color} />;
              if (tool.shape === 'diamond') return <rect key={mark.id} {...common} x={x - 8} y={y - 8} width={16} height={16} fill={tool.color} transform={`rotate(45 ${x} ${y})`} />;
              return <polygon key={mark.id} {...common} points={`${x},${y - 11} ${x - 11},${y + 10} ${x + 11},${y + 10}`} fill={tool.color} />;
            })}
          </svg>
        </div>}
        {rendering && <div className="render-badge">Rendering…</div>}
        {pdf && mode === 'count' && !selectedTool && <div className="viewer-hint">Choose a Tool Chest item before counting.</div>}
      </section>
    </main>

    <section className={`totals-dock ${panelOpen ? 'open' : 'collapsed'}`} style={panelOpen ? { height: panelHeight } : undefined}>
      {panelOpen && <div className="resize-handle" onPointerDown={(event) => { event.preventDefault(); resizeRef.current = { startY: event.clientY, height: panelHeight }; }} onDoubleClick={() => setPanelOpen(false)} />}
      <div className="totals-head">
        <button className="totals-title" onClick={() => setPanelOpen((value) => !value)}><span><b>Takeoff Totals</b><small>{visibleTotal} symbols · {counts.length} tools · {countScope === 'sheet' ? `page ${pageNum}` : 'drawing set'}</small></span><strong>{panelOpen ? 'Hide' : 'Show'}</strong></button>
        {panelOpen && <div className="totals-controls"><select value={countScope} onChange={(event) => setCountScope(event.target.value as CountScope)}><option value="set">Drawing Set</option><option value="sheet">Current Page</option></select><input placeholder="Filter counts" value={countSearch} onChange={(event) => setCountSearch(event.target.value)} /></div>}
      </div>
      {panelOpen && <div className="totals-body">
        {!counts.length && <div className="empty-small">No count marks in this view.</div>}
        {counts.map(({ tool, count }) => <button key={tool.id} className={`total-row ${selectedToolId === tool.id ? 'selected' : ''}`} onClick={() => jumpToCount(tool.id)}>
          <span className="total-tool"><Shape tool={tool} /><span><b>{tool.name}</b><small>{tool.system}{tool.takeoffRuleId ? ` · ${tool.takeoffRuleId}` : ''}</small></span></span>
          <strong>{count}</strong>
        </button>)}
      </div>}
    </section>

    <footer className="statusbar"><span>{message}</span><span>{mode === 'count' && selectedTool ? `Counting: ${selectedTool.name}` : mode === 'select' ? 'Select / move marks' : 'Pan drawing'}</span></footer>

    {toolEditor && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setToolEditor(false); }}><section className="tool-modal">
      <div className="modal-head"><div><span>COUNT TOOL</span><h2>Create Tool</h2></div><button className="icon" onClick={() => setToolEditor(false)}>×</button></div>
      <div className="modal-body">
        <label>Name<input autoFocus value={toolDraft.name} onChange={(event) => setToolDraft({ ...toolDraft, name: event.target.value })} placeholder="Example: Dual Data" /></label>
        <label>System<input value={toolDraft.system} onChange={(event) => setToolDraft({ ...toolDraft, system: event.target.value })} /></label>
        <label>Shape<select value={toolDraft.shape} onChange={(event) => setToolDraft({ ...toolDraft, shape: event.target.value as ToolShape })}><option value="square">Square</option><option value="circle">Circle</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option></select></label>
        <label>Color<input type="color" value={toolDraft.color} onChange={(event) => setToolDraft({ ...toolDraft, color: event.target.value })} /></label>
        <label className="span-two">ScopeLogic Take Off Rule ID <span className="optional">optional</span><input value={toolDraft.takeoffRuleId} onChange={(event) => setToolDraft({ ...toolDraft, takeoffRuleId: event.target.value })} placeholder="Preserved when tools are imported from ScopeLogic" /><small>This is only a link. Material, labor, multipliers, assemblies, and pricing stay inside ScopeLogic.</small></label>
      </div>
      <div className="modal-actions"><button className="secondary" onClick={() => setToolEditor(false)}>Cancel</button><button onClick={saveTool} disabled={!toolDraft.name.trim()}>Create Tool</button></div>
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
