'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

export type DrawingToolShape = 'square' | 'triangle' | 'circle' | 'diamond';
export type DrawingToolScope = 'global' | 'project';
export type DrawingTakeoffTool = {
  id: string;
  name: string;
  system: string;
  shape: DrawingToolShape;
  color: string;
  multiplier: number;
  unit: string;
  scope: DrawingToolScope;
  projectId?: string;
  formulaId?: string;
};
export type DrawingTakeoffMark = { id: string; docId: string; page: number; toolId: string; x: number; y: number };
export type DrawingPoint = { x: number; y: number };
export type DrawingMeasurement = { id: string; docId: string; page: number; type: 'distance' | 'polyline' | 'area' | 'perimeter'; points: DrawingPoint[]; value: number; unit: string; name: string; system: string };
export type DrawingPageCalibration = { pxPerFoot: number; label: string };
export type DrawingAnnotation = { id: string; docId: string; page: number; type: 'rectangle' | 'cloud' | 'arrow' | 'highlight' | 'snippet'; points: DrawingPoint[]; label?: string; issueUid?: string; issueId?: string };

type Doc = { id: string; name: string; fileName: string; fileType: string; current: boolean };
type TakeoffFormula = { id: string; name: string; system: string; unitLabel: string; active: boolean };
type TakeoffEntry = { id: string; formulaId: string; description: string; qty: number; notes: string; source?: 'manual' | 'drawing' };

type Props = {
  projectId: string;
  projectSystems: string[];
  docs: Doc[];
  tools: DrawingTakeoffTool[];
  setTools: (items: DrawingTakeoffTool[]) => void;
  marks: DrawingTakeoffMark[];
  setMarks: (items: DrawingTakeoffMark[]) => void;
  measurements: DrawingMeasurement[];
  setMeasurements: (items: DrawingMeasurement[]) => void;
  calibrations: Record<string, DrawingPageCalibration>;
  setCalibrations: (items: Record<string, DrawingPageCalibration>) => void;
  annotations: DrawingAnnotation[];
  setAnnotations: (items: DrawingAnnotation[]) => void;
  formulas: TakeoffFormula[];
  entries: TakeoffEntry[];
  saveEntries: (items: TakeoffEntry[]) => void;
  loadPdfBytes: (docId: string) => Promise<ArrayBuffer>;
  createIssue: (input: { system: string; title: string; concern: string; bidBasis: string; reference: string }) => { uid: string; id: string };
  message: (title: string, body: string) => void;
};

type Mode = 'pan' | 'count' | 'calibrate' | 'distance' | 'polyline' | 'area' | 'perimeter' | 'rectangle' | 'cloud' | 'arrow' | 'highlight' | 'snippet';

const alphaNumericCompare = (a: string, b: string) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true });
const COLORS = ['#31513b', '#477e7b', '#2563eb', '#b45309', '#b91c1c', '#6d28d9', '#111827', '#0e7490'];
const SHAPES: DrawingToolShape[] = ['square', 'triangle', 'circle', 'diamond'].sort(alphaNumericCompare) as DrawingToolShape[];
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const fmt = (value: number) => Number.isFinite(value) ? (Math.round(value * 100) / 100).toString() : '';
const lineLength = (points: { x: number; y: number }[]) => points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
const polygonArea = (points: { x: number; y: number }[]) => Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0)) / 2;

function Shape({ shape, color, size = 15 }: { shape: DrawingToolShape; color: string; size?: number }) {
  if (shape === 'circle') return <span className="drawing-tool-shape circle" style={{ width: size, height: size, background: color }} />;
  if (shape === 'square') return <span className="drawing-tool-shape square" style={{ width: size, height: size, background: color }} />;
  if (shape === 'diamond') return <span className="drawing-tool-shape diamond" style={{ width: size, height: size, background: color }} />;
  return <span className="drawing-tool-shape triangle" style={{ borderLeftWidth: size / 2, borderRightWidth: size / 2, borderBottomWidth: size, borderBottomColor: color }} />;
}

export default function DrawingTakeoffPage(props: Props) {
  const pdfDocs = useMemo(() => props.docs.filter((doc) => doc.current && (doc.fileType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf'))).sort((a,b)=>alphaNumericCompare(a.fileName,b.fileName)), [props.docs]);
  const availableTools = useMemo(() => props.tools.filter((tool) => tool.scope === 'global' || tool.projectId === props.projectId).sort((a,b)=>alphaNumericCompare(a.name,b.name)), [props.tools, props.projectId]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const pdfRef = useRef<any>(null);
  const [docId, setDocId] = useState(pdfDocs[0]?.id || '');
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [renderScale, setRenderScale] = useState(1.15);
  const [pagePx, setPagePx] = useState({ w: 1000, h: 1300 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<Mode>('pan');
  const [selectedToolId, setSelectedToolId] = useState('');
  const [selectedMark, setSelectedMark] = useState('');
  const [draft, setDraft] = useState<DrawingPoint[]>([]);
  const [toolModal, setToolModal] = useState(false);

  useEffect(() => {
    if (docId && !pdfDocs.some((doc) => doc.id === docId)) setDocId(pdfDocs[0]?.id || '');
    if (!docId && pdfDocs[0]) setDocId(pdfDocs[0].id);
  }, [pdfDocs, docId]);

  useEffect(() => {
    if (selectedToolId && !availableTools.some((tool) => tool.id === selectedToolId)) setSelectedToolId('');
    if (!selectedToolId && availableTools[0]) setSelectedToolId(availableTools[0].id);
  }, [availableTools, selectedToolId]);

  useEffect(() => {
    let active = true;
    if (!docId) { pdfRef.current = null; setPageCount(0); return; }
    pdfRef.current = null; setPageCount(0); setLoading(true); setLoadError(''); setPageNum(1);
    props.loadPdfBytes(docId).then(async (buffer) => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      if (!active) return;
      pdfRef.current = pdf;
      setPageCount(pdf.numPages);
    }).catch((cause) => {
      if (!active) return;
      pdfRef.current = null;
      setLoadError(cause instanceof Error ? cause.message : 'The PDF could not be loaded.');
      setPageCount(0);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [docId]);

  useEffect(() => {
    let cancelled = false;
    const pdf = pdfRef.current;
    if (!pdf || !canvasRef.current) return;
    (async () => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      setPagePx({ w: Math.ceil(viewport.width), h: Math.ceil(viewport.height) });
      await page.render({ canvasContext: context, viewport }).promise;
    })().catch((cause) => { if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'The PDF page could not be rendered.'); });
    return () => { cancelled = true; };
  }, [docId, pageNum, renderScale, pageCount]);

  const selectedDoc = pdfDocs.find((doc) => doc.id === docId);
  const selectedTool = availableTools.find((tool) => tool.id === selectedToolId);
  const pageKey = `${docId}:${pageNum}`;
  const pageCalibration = props.calibrations[pageKey];
  const pageMarks = props.marks.filter((mark) => mark.docId === docId && mark.page === pageNum);
  const pageMeasurements = props.measurements.filter((measurement) => measurement.docId === docId && measurement.page === pageNum);
  const pageAnnotations = props.annotations.filter((annotation) => annotation.docId === docId && annotation.page === pageNum);

  const currentDocIds = useMemo(() => new Set(pdfDocs.map((doc) => doc.id)), [pdfDocs]);
  const summary = useMemo(() => {
    const byTool = new Map<string, { tool: DrawingTakeoffTool; locations: number; qty: number }>();
    for (const mark of props.marks) {
      if (!currentDocIds.has(mark.docId)) continue;
      const tool = availableTools.find((item) => item.id === mark.toolId);
      if (!tool) continue;
      const current = byTool.get(tool.id) || { tool, locations: 0, qty: 0 };
      current.locations += 1;
      current.qty += Math.max(0, Number(tool.multiplier) || 0);
      byTool.set(tool.id, current);
    }
    return [...byTool.values()].sort((a, b) => a.tool.system.localeCompare(b.tool.system) || a.tool.name.localeCompare(b.tool.name));
  }, [props.marks, availableTools, currentDocIds]);

  const point = (event: ReactMouseEvent<SVGSVGElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const pixelPoint = (p: DrawingPoint) => ({ x: p.x * pagePx.w, y: p.y * pagePx.h });

  const clickOverlay = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (mode === 'pan') return;
    const p = point(event);
    if (mode === 'count') {
      if (!selectedTool) return props.message('Select a Tool', 'Create or select a Tool Chest item before placing count symbols.');
      props.setMarks([...props.marks, { id: uid('mark'), docId, page: pageNum, toolId: selectedTool.id, x: p.x, y: p.y }]);
      return;
    }
    if (['calibrate', 'distance', 'polyline', 'area', 'perimeter', 'rectangle', 'cloud', 'arrow', 'highlight', 'snippet'].includes(mode)) {
      setDraft((items) => [...items, p]);
    }
  };

  const finishDraft = () => {
    if (mode === 'calibrate' && draft.length >= 2) {
      const [a, b] = draft.slice(0, 2).map(pixelPoint);
      const pixels = Math.hypot(b.x - a.x, b.y - a.y);
      const real = Number(window.prompt('Known real distance in feet:', '10'));
      if (real > 0 && pixels > 0) {
        props.setCalibrations({ ...props.calibrations, [pageKey]: { pxPerFoot: pixels / real, label: `${fmt(real)} ft calibration` } });
        props.message('Saved', `Page ${pageNum} was calibrated to ${fmt(real)} ft.`);
      }
      setDraft([]);
      return;
    }
    if (['distance', 'polyline', 'area', 'perimeter'].includes(mode)) {
      if (!pageCalibration) { props.message('Calibration Required', 'Calibrate this drawing page before saving scaled measurements.'); return; }
      const pixels = draft.map(pixelPoint);
      if (pixels.length < 2) return;
      let value = 0; let unit = 'ft';
      if (mode === 'area') {
        if (pixels.length < 3) return;
        value = polygonArea(pixels) / (pageCalibration.pxPerFoot ** 2); unit = 'sq ft';
      } else if (mode === 'perimeter') {
        if (pixels.length < 3) return;
        value = lineLength([...pixels, pixels[0]]) / pageCalibration.pxPerFoot;
      } else {
        value = lineLength(mode === 'distance' ? pixels.slice(0, 2) : pixels) / pageCalibration.pxPerFoot;
      }
      props.setMeasurements([...props.measurements, { id: uid('measure'), docId, page: pageNum, type: mode as DrawingMeasurement['type'], points: [...draft], value, unit, name: selectedTool?.name || mode, system: selectedTool?.system || '' }]);
      props.message('Saved', `${mode[0].toUpperCase() + mode.slice(1)} measurement saved.`);
      setDraft([]);
      return;
    }
    if (['rectangle', 'cloud', 'arrow', 'highlight', 'snippet'].includes(mode) && draft.length >= 2) {
      let issue: { uid: string; id: string } | undefined;
      let label = '';
      if (mode === 'snippet') {
        const title = window.prompt('SLR scope item / title:', '') || '';
        if (!title.trim()) return;
        const concern = window.prompt('Scope concern / problem:', '') || '';
        const bidBasis = window.prompt('Recommended bid basis / solution:', '') || '';
        const system = selectedTool?.system || props.projectSystems[0] || 'Other';
        issue = props.createIssue({ system, title, concern, bidBasis, reference: `${selectedDoc?.fileName || 'Drawing'} p.${pageNum}` });
        label = issue.id;
      }
      props.setAnnotations([...props.annotations, { id: uid('annotation'), docId, page: pageNum, type: mode as DrawingAnnotation['type'], points: [...draft], label, issueUid: issue?.uid, issueId: issue?.id }]);
      if (issue) props.message('SLR Created', `${issue.id} was created from the selected drawing region.`);
      setDraft([]);
    }
  };

  const deleteSelectedMark = () => {
    if (!selectedMark) return;
    props.setMarks(props.marks.filter((mark) => mark.id !== selectedMark));
    setSelectedMark('');
  };

  const syncCounts = () => {
    const totals = new Map<string, { qty: number; tools: Set<string> }>();
    for (const mark of props.marks) {
      if (!currentDocIds.has(mark.docId)) continue;
      const tool = availableTools.find((item) => item.id === mark.toolId);
      if (!tool?.formulaId) continue;
      const formula = props.formulas.find((item) => item.id === tool.formulaId);
      if (!formula) continue;
      const current = totals.get(formula.id) || { qty: 0, tools: new Set<string>() };
      current.qty += Math.max(0, Number(tool.multiplier) || 0);
      current.tools.add(tool.name);
      totals.set(formula.id, current);
    }
    const retained = props.entries.filter((entry) => entry.source !== 'drawing');
    const drawingEntries: TakeoffEntry[] = [...totals.entries()].map(([formulaId, total]) => {
      const formula = props.formulas.find((item) => item.id === formulaId)!;
      return { id: `drawing-${formulaId}`, formulaId, description: `Drawing Take Off — ${formula.name}`, qty: total.qty, notes: `Synced from PDF Drawing Take Off (${[...total.tools].join(', ')})`, source: 'drawing' };
    });
    props.saveEntries([...retained, ...drawingEntries]);
    props.message('Drawing Take Off Synced', `${drawingEntries.length} linked rule${drawingEntries.length === 1 ? '' : 's'} updated in the Take Off Quantity Sheet.`);
  };

  const deleteTool = (tool: DrawingTakeoffTool) => {
    const marksUsing = props.marks.some((mark) => mark.toolId === tool.id);
    if (marksUsing) return props.message('Tool In Use', 'Delete or change the drawing marks using this tool before removing it.');
    props.setTools(props.tools.filter((item) => item.id !== tool.id));
    if (selectedToolId === tool.id) setSelectedToolId('');
    props.message('Saved', `“${tool.name}” was removed from the Tool Chest.`);
  };

  const drawAnnotation = (annotation: DrawingAnnotation) => {
    const a = pixelPoint(annotation.points[0]);
    const b = pixelPoint(annotation.points[1] || annotation.points[0]);
    if (annotation.type === 'arrow') return <g key={annotation.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b91c1c" strokeWidth="3" /><circle cx={b.x} cy={b.y} r="5" fill="#b91c1c" /></g>;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
    const highlight = annotation.type === 'highlight';
    return <g key={annotation.id}><rect x={x} y={y} width={w} height={h} rx={annotation.type === 'cloud' ? 12 : 0} fill={highlight ? 'rgba(250,204,21,.28)' : 'rgba(185,28,28,.05)'} stroke={highlight ? '#ca8a04' : '#b91c1c'} strokeWidth="2" strokeDasharray={annotation.type === 'cloud' ? '7 5' : undefined} />{annotation.label && <text x={x + 5} y={Math.max(14, y - 5)} fill="#b91c1c" fontWeight="700" fontSize="12">{annotation.label}</text>}</g>;
  };

  return <section className="drawing-takeoff-page">
    <div className="section-head"><div><span>ESTIMATING / DRAWINGS</span><h1>PDF Drawing Take Off</h1><p>Count drawing symbols, calibrate sheets, measure routes and areas, and feed drawing quantities directly into selected Take Off rules.</p></div><div className="drawing-takeoff-head-actions"><button className="secondary" onClick={() => setToolModal(true)}>+ Create Tool</button><button onClick={syncCounts}>Sync Counts to Take Off</button></div></div>
    <div className="drawing-document-bar">
      <label>Drawing PDF<select value={docId} onChange={(event) => setDocId(event.target.value)}><option value="">Select project PDF...</option>{pdfDocs.map((doc) => <option key={doc.id} value={doc.id}>{doc.fileName}</option>)}</select></label>
      <div className="drawing-page-controls"><button className="secondary" disabled={!pageCount || pageNum <= 1} onClick={() => setPageNum((page) => Math.max(1, page - 1))}>◀</button><span>Page {pageCount ? `${pageNum} / ${pageCount}` : '—'}</span><button className="secondary" disabled={!pageCount || pageNum >= pageCount} onClick={() => setPageNum((page) => Math.min(pageCount, page + 1))}>▶</button><button className="secondary" disabled={!pageCount} onClick={() => setRenderScale((scale) => Math.max(.55, scale - .15))}>−</button><button className="secondary" disabled={!pageCount} onClick={() => setRenderScale((scale) => Math.min(2.5, scale + .15))}>+</button></div>
      <span className={`drawing-calibration-badge ${pageCalibration ? 'ok' : ''}`}>{pageCalibration ? `Calibrated · ${pageCalibration.label}` : 'Page not calibrated'}</span>
    </div>
    {!pdfDocs.length && <div className="empty-list"><b>No current PDF drawings are available.</b><p>Upload drawing PDFs under Project Documents first, then return to Drawing Take Off.</p></div>}
    {loadError && <div className="inline-warning"><b>PDF could not be opened.</b><span>{loadError}</span></div>}
    <div className="drawing-workspace-grid">
      <aside className="drawing-tools-panel">
        <h3>Drawing Tools</h3>
        <div className="drawing-mode-grid">{([
          ['pan', 'Pan'], ['count', 'Count'], ['calibrate', 'Calibrate'], ['distance', 'Distance'], ['polyline', 'Polyline'], ['area', 'Area'], ['perimeter', 'Perimeter'], ['rectangle', 'Rectangle'], ['cloud', 'Cloud'], ['arrow', 'Arrow'], ['highlight', 'Highlight'], ['snippet', 'Snippet / SLR'],
        ] as [Mode, string][]).map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => { setMode(id); setDraft([]); }}>{label}</button>)}</div>
        <div className="drawing-tool-chest-head"><h3>Tool Chest</h3><button className="link-button" onClick={() => setToolModal(true)}>New Tool</button></div>
        {!availableTools.length && <div className="compact-empty">No tools yet. Create only the count tools you use.</div>}
        <div className="drawing-tool-list">{availableTools.map((tool) => <div key={tool.id} className={`drawing-tool-row ${selectedToolId === tool.id ? 'selected' : ''}`}><button onClick={() => { setSelectedToolId(tool.id); setMode('count'); }}><Shape shape={tool.shape} color={tool.color} /><span><b>{tool.name}</b><small>{tool.system} · ×{tool.multiplier} {tool.unit}{tool.formulaId ? ` · Linked: ${props.formulas.find((formula) => formula.id === tool.formulaId)?.name || 'Missing rule'}` : ''}</small></span></button><button className="icon-danger" title="Delete tool" onClick={() => deleteTool(tool)}>×</button></div>)}</div>
        {selectedMark && <button className="danger wide" onClick={deleteSelectedMark}>Delete Selected Mark</button>}
      </aside>
      <main className="drawing-canvas-panel">
        {loading && <div className="drawing-loading">Loading drawing…</div>}
        {!docId && !loading && <div className="drawing-empty"><h2>Select a project drawing PDF</h2><p>PDF drawing files already uploaded to Project Documents are available above.</p></div>}
        {docId && <div className="drawing-scroll"><div className="drawing-sheet" style={{ width: pagePx.w, height: pagePx.h }}><canvas ref={canvasRef} /><svg ref={overlayRef} width={pagePx.w} height={pagePx.h} viewBox={`0 0 ${pagePx.w} ${pagePx.h}`} onClick={clickOverlay} className={mode === 'pan' ? 'drawing-overlay pan' : 'drawing-overlay'}>
          {pageMarks.map((mark) => { const tool = availableTools.find((item) => item.id === mark.toolId); if (!tool) return null; const x = mark.x * pagePx.w, y = mark.y * pagePx.h; const common = { key: mark.id, onClick: (event: ReactMouseEvent<SVGElement>) => { event.stopPropagation(); setSelectedMark(mark.id); }, className: selectedMark === mark.id ? 'drawing-mark selected' : 'drawing-mark' }; if (tool.shape === 'circle') return <circle {...common} cx={x} cy={y} r="9" fill={tool.color} />; if (tool.shape === 'square') return <rect {...common} x={x - 9} y={y - 9} width="18" height="18" fill={tool.color} />; if (tool.shape === 'diamond') return <rect {...common} x={x - 7} y={y - 7} width="14" height="14" fill={tool.color} transform={`rotate(45 ${x} ${y})`} />; return <polygon {...common} points={`${x},${y - 10} ${x - 10},${y + 9} ${x + 10},${y + 9}`} fill={tool.color} />; })}
          {pageMeasurements.map((measurement) => <polyline key={measurement.id} points={measurement.points.map((p) => `${p.x * pagePx.w},${p.y * pagePx.h}`).join(' ')} fill={measurement.type === 'area' ? 'rgba(71,126,123,.16)' : 'none'} stroke="#477e7b" strokeWidth="2" />)}
          {pageAnnotations.map(drawAnnotation)}
          {draft.length > 0 && <polyline points={draft.map((p) => `${p.x * pagePx.w},${p.y * pagePx.h}`).join(' ')} fill="none" stroke="#b45309" strokeWidth="2" strokeDasharray="6 5" />}
        </svg></div></div>}
        {draft.length > 0 && <div className="drawing-finish-bar"><span>{draft.length} point{draft.length === 1 ? '' : 's'} selected</span><button onClick={finishDraft}>Finish</button><button className="secondary" onClick={() => setDraft([])}>Cancel</button></div>}
      </main>
      <aside className="drawing-summary-panel">
        <h3>Live Take Off Summary</h3>
        {!summary.length && <div className="compact-empty">Placed count symbols will summarize here.</div>}
        {summary.map(({ tool, locations, qty }) => <div className="drawing-summary-row" key={tool.id}><span><Shape shape={tool.shape} color={tool.color} /><span><b>{tool.name}</b><small>{tool.system}</small></span></span><span><b>{locations}</b><small>locations</small></span><span><b>{fmt(qty)}</b><small>{tool.unit}</small></span></div>)}
        <h3>Page Measurements</h3>
        {!pageMeasurements.length && <div className="compact-empty">No measurements on this page.</div>}
        {pageMeasurements.map((measurement) => <div className="drawing-measure-row" key={measurement.id}><span><b>{measurement.name}</b><small>{measurement.type}</small></span><strong>{fmt(measurement.value)} {measurement.unit}</strong></div>)}
        <h3>Rule Links</h3>
        <p className="drawing-help">Link each count tool to a Take Off rule. Syncing replaces the prior drawing-sourced quantity instead of stacking it again.</p>
        {availableTools.filter((tool) => tool.formulaId).map((tool) => <div className="drawing-link-row" key={tool.id}><b>{tool.name}</b><span>→ {props.formulas.find((formula) => formula.id === tool.formulaId)?.name || 'Missing rule'}</span></div>)}
      </aside>
    </div>
    {toolModal && <ToolModal projectId={props.projectId} systems={props.projectSystems} formulas={props.formulas} onClose={() => setToolModal(false)} onCreate={(tool) => { props.setTools([...props.tools, tool]); setSelectedToolId(tool.id); setMode('count'); setToolModal(false); props.message('Saved', `“${tool.name}” was added to the Drawing Take Off Tool Chest.`); }} />}
  </section>;
}

function ToolModal({ projectId, systems, formulas, onClose, onCreate }: { projectId: string; systems: string[]; formulas: TakeoffFormula[]; onClose: () => void; onCreate: (tool: DrawingTakeoffTool) => void }) {
  const [value, setValue] = useState({ name: '', system: systems[0] || 'Structured Cabling', shape: 'square' as DrawingToolShape, color: COLORS[0], multiplier: 1, unit: 'qty', scope: 'project' as DrawingToolScope, formulaId: '' });
  const systemOptions = [...new Set([...systems, ...formulas.map((formula) => formula.system)])].filter(Boolean).sort(alphaNumericCompare);
  const eligibleRules = formulas.filter((formula) => formula.system === value.system).sort((a,b)=>alphaNumericCompare(a.name,b.name));
  return <div className="quote-picker-backdrop"><section className="quote-picker-modal drawing-tool-modal"><div className="modal-head"><div><span>DRAWING TAKE OFF</span><h2>Create Saved Tool</h2></div><button className="modal-close" onClick={onClose}>×</button></div><div className="form-grid two">
    <label>Tool Name<input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} placeholder="Example: Single Reader Door" /></label>
    <label>System<select value={value.system} onChange={(event) => setValue({ ...value, system: event.target.value, formulaId: '' })}>{systemOptions.length ? systemOptions.map((system) => <option key={system}>{system}</option>) : <option>Structured Cabling</option>}</select></label>
    <label>Symbol Shape<select value={value.shape} onChange={(event) => setValue({ ...value, shape: event.target.value as DrawingToolShape })}>{SHAPES.map((shape) => <option key={shape}>{shape}</option>)}</select></label>
    <label>Quantity Multiplier<input type="number" min="0" step="0.01" value={value.multiplier} onChange={(event) => setValue({ ...value, multiplier: Number(event.target.value) || 0 })} /></label>
    <label>Result Unit<input value={value.unit} onChange={(event) => setValue({ ...value, unit: event.target.value })} placeholder="devices, cables, doors..." /></label>
    <label>Availability<select value={value.scope} onChange={(event) => setValue({ ...value, scope: event.target.value as DrawingToolScope })}><option value="global">Global — All Projects</option><option value="project">This Project Only</option></select></label>
    <label className="span-two">Linked Take Off Rule<select value={value.formulaId} onChange={(event) => setValue({ ...value, formulaId: event.target.value })}><option value="">No rule link — summary only</option>{eligibleRules.map((formula) => <option key={formula.id} value={formula.id}>{formula.name}</option>)}</select><small>When linked, Sync Counts to Take Off updates this rule's drawing-sourced quantity.</small></label>
    <div className="span-two"><span className="field-label">Color</span><div className="drawing-color-row">{COLORS.map((color) => <button type="button" key={color} aria-label={`Use ${color}`} className={value.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => setValue({ ...value, color })} />)}</div></div>
  </div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button disabled={!value.name.trim()} onClick={() => onCreate({ id: uid('tool'), name: value.name.trim(), system: value.system, shape: value.shape, color: value.color, multiplier: value.multiplier || 1, unit: value.unit.trim() || 'qty', scope: value.scope, projectId: value.scope === 'project' ? projectId : undefined, formulaId: value.formulaId || undefined })}>Create Tool</button></div></section></div>;
}
