import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import DrawingPagesRail from './DrawingPagesRail';
import {
  PRESET_SCALES,
  formatMeasurement,
  measurementKindLabel,
  measurementValue,
  pointDistance,
  type Measurement,
  type MeasurementKind,
  type PageCalibration,
  type PageSize,
  type Point,
} from './measurements';
import './measurements.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Shape = 'square' | 'triangle' | 'circle' | 'diamond';
type Mode = 'pan' | 'count' | 'calibrate' | MeasurementKind;

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
const MULTI_POINT_MODES: MeasurementKind[] = ['polyline', 'area', 'perimeter'];
const uid = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
const pointString = (points: Point[], size: PageSize) => points.map((point) => `${point.x * size.width},${point.y * size.height}`).join(' ');

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
  const [pageSize, setPageSize] = useState<PageSize>({ width: 900, height: 1160 });
  const [pageBaseSizes, setPageBaseSizes] = useState<Record<number, PageSize>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [mode, setMode] = useState<Mode>('count');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selectedMarkId, setSelectedMarkId] = useState('');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState('');
  const [measurementDraft, setMeasurementDraft] = useState<Point[]>([]);
  const [calibrationDraft, setCalibrationDraft] = useState<Point[]>([]);
  const [pageCalibrations, setPageCalibrations] = useState<Record<number, PageCalibration>>({});
  const [calibrationKnownLength, setCalibrationKnownLength] = useState('10');
  const [calibrationKnownUnit, setCalibrationKnownUnit] = useState<'ft' | 'in'>('ft');

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
        const baseViewport = pdfPage.getViewport({ scale: 1 });
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
        setPageBaseSizes((current) => {
          const previous = current[page];
          if (previous && Math.abs(previous.width - baseViewport.width) < 0.01 && Math.abs(previous.height - baseViewport.height) < 0.01) return current;
          return { ...current, [page]: { width: baseViewport.width, height: baseViewport.height } };
        });

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

  const measurementRows = useMemo(() => measurements.map((measurement) => ({
    measurement,
    value: measurementValue(measurement, pageCalibrations[measurement.page], pageBaseSizes[measurement.page]),
  })), [measurements, pageCalibrations, pageBaseSizes]);

  const markCountByPage = useMemo(() => marks.reduce<Record<number, number>>((counts, mark) => {
    counts[mark.page] = (counts[mark.page] || 0) + 1;
    return counts;
  }, {}), [marks]);

  const measurementCountByPage = useMemo(() => measurements.reduce<Record<number, number>>((counts, measurement) => {
    counts[measurement.page] = (counts[measurement.page] || 0) + 1;
    return counts;
  }, {}), [measurements]);

  const syncRequired = syncRows.some((row) => row.difference !== 0);
  const pageCalibration = pageCalibrations[page];
  const pageBaseSize = pageBaseSizes[page];
  const canMeasurePage = Boolean(pdfDoc && pageCalibration && pageBaseSize);

  useEffect(() => {
    setSyncSelection((current) => {
      const next = { ...current };
      for (const row of summary) if (!(row.tool.id in next)) next[row.tool.id] = true;
      return next;
    });
  }, [summary]);

  useEffect(() => {
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    setSelectedMarkId('');
    setSelectedMeasurementId('');
  }, [page]);

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
      setMeasurements([]);
      setEstimateQty({});
      setPageCalibrations({});
      setPageBaseSizes({});
      setMeasurementDraft([]);
      setCalibrationDraft([]);
      setSelectedMarkId('');
      setSelectedMeasurementId('');
      setMode('count');
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

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    if (nextMode === 'calibrate') {
      setActivity(`Calibration mode. Pick two points on page ${page}, enter the known distance, then set the scale.`);
    } else if (nextMode === 'count') {
      setActivity('Count mode. Select a Tool Chest item and place count marks.');
    } else if (nextMode === 'pan') {
      setActivity('Pan mode. Use the drawing scroll bars to navigate the sheet.');
    } else {
      setActivity(`${measurementKindLabel(nextMode)} mode. ${nextMode === 'distance' ? 'Pick two points.' : 'Pick points, then use Finish.'}`);
    }
  };

  const createMeasurement = (kind: MeasurementKind, points: Point[]) => {
    if (!pageCalibration || !pageBaseSize) {
      setActivity(`Page ${page} must be calibrated before measurement takeoff.`);
      return;
    }
    const ordinal = measurements.filter((item) => item.kind === kind).length + 1;
    const measurement: Measurement = {
      id: uid(),
      page,
      kind,
      name: `${measurementKindLabel(kind)} ${ordinal}`,
      points,
    };
    setMeasurements((items) => [...items, measurement]);
    setSelectedMeasurementId(measurement.id);
    setSelectedMarkId('');
    setMeasurementDraft([]);
    const value = measurementValue(measurement, pageCalibration, pageBaseSize);
    setActivity(`${measurement.name} added: ${formatMeasurement(value, kind)}. Measurement geometry stays independent from Estimate/BOM quantities.`);
  };

  const normalizeOverlayPoint = (event: ReactMouseEvent<SVGSVGElement>): Point | null => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const clickOverlay = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!pdfDoc || mode === 'pan') return;
    const point = normalizeOverlayPoint(event);
    if (!point) return;

    if (mode === 'count') {
      const tool = tools.find((item) => item.id === selectedToolId);
      if (!tool) return;
      const mark: Mark = { id: uid(), page, toolId: tool.id, x: point.x, y: point.y };
      setMarks((items) => [...items, mark]);
      setSelectedMarkId(mark.id);
      setSelectedMeasurementId('');
      setActivity(`${tool.name} added on page ${page}. Estimate quantities remain unchanged until Sync Review is applied.`);
      return;
    }

    if (mode === 'calibrate') {
      if (calibrationDraft.length >= 2) return;
      const next = [...calibrationDraft, point];
      setCalibrationDraft(next);
      setActivity(next.length === 1
        ? 'Calibration start point set. Pick the second point.'
        : 'Calibration line set. Confirm the known distance and click Set Scale.');
      return;
    }

    if (!canMeasurePage) {
      setActivity(`Page ${page} is not scaled. Use Calibrate or a preset architectural scale first.`);
      return;
    }

    if (mode === 'distance') {
      if (!measurementDraft.length) {
        setMeasurementDraft([point]);
        setActivity('Distance start point set. Pick the second point.');
      } else {
        createMeasurement('distance', [measurementDraft[0], point]);
      }
      return;
    }

    setMeasurementDraft((current) => [...current, point]);
    setActivity(`${measurementKindLabel(mode)} point ${measurementDraft.length + 1} added. Use Finish when the path is complete.`);
  };

  const finishMeasurementDraft = () => {
    if (!MULTI_POINT_MODES.includes(mode as MeasurementKind)) return;
    const kind = mode as MeasurementKind;
    const minimum = kind === 'polyline' ? 2 : 3;
    if (measurementDraft.length < minimum) {
      setActivity(`${measurementKindLabel(kind)} requires at least ${minimum} points.`);
      return;
    }
    createMeasurement(kind, measurementDraft);
  };

  const cancelDraft = () => {
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    setActivity('Current drawing operation cancelled.');
  };

  const applyManualCalibration = () => {
    if (calibrationDraft.length !== 2 || !pageBaseSize) {
      setActivity('Pick two calibration points on the drawing first.');
      return;
    }
    const known = Number(calibrationKnownLength);
    const knownFeet = calibrationKnownUnit === 'in' ? known / 12 : known;
    if (!Number.isFinite(knownFeet) || knownFeet <= 0) {
      setActivity('Enter a known calibration distance greater than zero.');
      return;
    }
    const pdfPointDistance = pointDistance(calibrationDraft[0], calibrationDraft[1], pageBaseSize);
    if (!pdfPointDistance) {
      setActivity('Calibration points must be separated by a measurable distance.');
      return;
    }
    const label = `Manual · ${fmt(known)} ${calibrationKnownUnit}`;
    setPageCalibrations((current) => ({
      ...current,
      [page]: { feetPerPdfPoint: knownFeet / pdfPointDistance, label, source: 'manual' },
    }));
    setCalibrationDraft([]);
    setMode('pan');
    setActivity(`Page ${page} calibrated from a ${fmt(known)} ${calibrationKnownUnit} reference. Existing raw measurement geometry will use this page scale.`);
  };

  const applyPresetScale = (presetId: string) => {
    const preset = PRESET_SCALES.find((item) => item.id === presetId);
    if (!preset) return;
    setPageCalibrations((current) => ({
      ...current,
      [page]: { feetPerPdfPoint: preset.feetPerPdfPoint, label: preset.label, source: 'preset' },
    }));
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    setMode('pan');
    setActivity(`Page ${page} scale set to ${preset.label}. Preset scale assumes the PDF retains its native print scale.`);
  };

  const clearPageScale = () => {
    setPageCalibrations((current) => {
      const next = { ...current };
      delete next[page];
      return next;
    });
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    setMode('pan');
    setActivity(`Page ${page} scale cleared. Measurement geometry is retained but values are unavailable until the page is scaled again.`);
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
    changeMode('count');
    setNewTool({ name: '', shape: 'circle', color: '#4B6623', multiplier: 1, unit: 'qty' });
    setShowToolForm(false);
    setActivity(`${tool.name} added to the local Tool Chest.`);
  };

  const deleteSelected = () => {
    if (selectedMeasurementId) {
      const selected = measurements.find((item) => item.id === selectedMeasurementId);
      setMeasurements((items) => items.filter((item) => item.id !== selectedMeasurementId));
      setSelectedMeasurementId('');
      setActivity(`${selected?.name || 'Selected measurement'} removed.`);
      return;
    }
    if (selectedMarkId) {
      setMarks((items) => items.filter((item) => item.id !== selectedMarkId));
      setSelectedMarkId('');
      setActivity('Selected takeoff mark removed. Sync Review will show the resulting quantity difference.');
    }
  };

  const applySelectedSync = () => {
    setEstimateQty((current) => {
      const next = { ...current };
      for (const row of syncRows) if (syncSelection[row.tool.id]) next[row.tool.id] = row.qty;
      return next;
    });
    setActivity('Selected Takeoff quantities applied to the local estimate preview. Cloud Quote/BOM connection remains an explicit later integration step.');
  };

  const pageMarks = marks.filter((mark) => mark.page === page);
  const pageMeasurements = measurementRows.filter((row) => row.measurement.page === page);
  const selectedTool = tools.find((item) => item.id === selectedToolId);
  const draftPointCount = mode === 'calibrate' ? calibrationDraft.length : measurementDraft.length;
  const modeLabel = mode === 'count'
    ? `COUNT · ${selectedTool?.name || 'No Tool'}`
    : mode === 'pan'
      ? 'PAN'
      : mode === 'calibrate'
        ? `CALIBRATE · ${draftPointCount}/2`
        : `${measurementKindLabel(mode).toUpperCase()} · ${draftPointCount} PT`;

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

        <button className={mode === 'pan' ? 'button active' : 'button'} onClick={() => changeMode('pan')}>Pan</button>
        <button className={mode === 'count' ? 'button active' : 'button'} onClick={() => changeMode('count')}>Count</button>
        <button className={mode === 'calibrate' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('calibrate')}>Calibrate</button>
        <button className={mode === 'distance' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('distance')}>Distance</button>
        <button className={mode === 'polyline' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('polyline')}>Polyline</button>
        <button className={mode === 'area' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('area')}>Area</button>
        <button className={mode === 'perimeter' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('perimeter')}>Perimeter</button>

        {MULTI_POINT_MODES.includes(mode as MeasurementKind) && measurementDraft.length > 0 && (
          <>
            <button className="button primary" onClick={finishMeasurementDraft}>Finish</button>
            <button className="button" onClick={cancelDraft}>Cancel</button>
          </>
        )}

        {mode === 'calibrate' && (
          <>
            <div className="command-separator" />
            <span className="command-label">Known</span>
            <input className="command-input calibration-length" type="number" min="0.01" step="0.01" value={calibrationKnownLength} onChange={(event) => setCalibrationKnownLength(event.target.value)} />
            <select className="command-select unit-select" value={calibrationKnownUnit} onChange={(event) => setCalibrationKnownUnit(event.target.value as 'ft' | 'in')}>
              <option value="ft">ft</option>
              <option value="in">in</option>
            </select>
            <button className="button primary" disabled={calibrationDraft.length !== 2 || !Number(calibrationKnownLength)} onClick={applyManualCalibration}>Set Scale</button>
            {calibrationDraft.length > 0 && <button className="button" onClick={cancelDraft}>Cancel</button>}
          </>
        )}

        <div className="command-separator" />
        <span className="command-label">Scale</span>
        <select className="command-select scale-select" value="" disabled={!pdfDoc} onChange={(event) => applyPresetScale(event.target.value)}>
          <option value="">Preset…</option>
          {PRESET_SCALES.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
        <span className={pageCalibration ? 'scale-chip scaled' : 'scale-chip'}>{pageCalibration?.label || 'Unscaled'}</span>
        <button className="button compact" disabled={!pageCalibration} onClick={clearPageScale}>Clear</button>

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
          <DrawingPagesRail
            pdfDoc={pdfDoc}
            pageCount={pageCount}
            activePage={page}
            onSelectPage={setPage}
            markCountByPage={markCountByPage}
            measurementCountByPage={measurementCountByPage}
            pageCalibrations={pageCalibrations}
          />

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
                <button key={tool.id} className={tool.id === selectedToolId ? 'tool-row active' : 'tool-row'} onClick={() => { setSelectedToolId(tool.id); changeMode('count'); }}>
                  <ShapeMark shape={tool.shape} color={tool.color} />
                  <span><b>{tool.name}</b><small>×{fmt(tool.multiplier)} {tool.unit}</small></span>
                </button>
              ))}
            </div>
            {selectedTool && <div className="active-tool"><span>Active count tool</span><b>{selectedTool.name}</b></div>}
            <button className="button danger wide" disabled={!selectedMarkId && !selectedMeasurementId} onClick={deleteSelected}>Delete Selected</button>
          </section>
        </aside>

        <main className="drawing-panel">
          {loading && <div className="drawing-message">Loading drawing…</div>}
          {error && <div className="drawing-message error"><b>PDF could not be opened.</b><span>{error}</span></div>}
          {!pdfDoc && !loading && !error && <div className="drawing-message"><b>Open a PDF drawing set</b><span>The desktop viewer keeps Takeoff quantities separate from Estimate quantities until you explicitly sync them.</span></div>}
          {pdfDoc && (
            <div className={mode === 'pan' ? 'drawing-scroll pan-mode' : 'drawing-scroll count-mode'}>
              <div className="drawing-stage" style={{ width: pageSize.width, height: pageSize.height }}>
                <canvas ref={canvasRef} />
                <svg ref={overlayRef} width={pageSize.width} height={pageSize.height} viewBox={`0 0 ${pageSize.width} ${pageSize.height}`} onClick={clickOverlay}>
                  {pageMeasurements.map(({ measurement, value }) => {
                    const points = pointString(measurement.points, pageSize);
                    const selected = measurement.id === selectedMeasurementId;
                    const centerX = measurement.points.reduce((sum, point) => sum + point.x, 0) / measurement.points.length * pageSize.width;
                    const centerY = measurement.points.reduce((sum, point) => sum + point.y, 0) / measurement.points.length * pageSize.height;
                    const clickMeasurement = (event: ReactMouseEvent<SVGElement>) => {
                      event.stopPropagation();
                      setSelectedMeasurementId(measurement.id);
                      setSelectedMarkId('');
                    };
                    return (
                      <g key={measurement.id} className={selected ? `measurement-graphic ${measurement.kind} selected` : `measurement-graphic ${measurement.kind}`}>
                        {measurement.kind === 'area' && <polygon points={points} onClick={clickMeasurement} />}
                        {measurement.kind === 'perimeter' && <polygon points={points} onClick={clickMeasurement} />}
                        {(measurement.kind === 'distance' || measurement.kind === 'polyline') && <polyline points={points} onClick={clickMeasurement} />}
                        {measurement.points.map((point, index) => <circle key={`${measurement.id}-${index}`} className="measurement-node" cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="3.5" />)}
                        <g className="measurement-label" transform={`translate(${centerX} ${centerY})`}>
                          <rect x="-42" y="-10" width="84" height="20" rx="4" />
                          <text textAnchor="middle" dominantBaseline="central">{formatMeasurement(value, measurement.kind)}</text>
                        </g>
                      </g>
                    );
                  })}

                  {pageMarks.map((mark) => {
                    const tool = tools.find((item) => item.id === mark.toolId);
                    if (!tool) return null;
                    const x = mark.x * pageSize.width;
                    const y = mark.y * pageSize.height;
                    const selected = mark.id === selectedMarkId;
                    const common = {
                      className: selected ? 'drawing-mark selected' : 'drawing-mark',
                      onClick: (event: ReactMouseEvent<SVGElement>) => {
                        event.stopPropagation();
                        setSelectedMarkId(mark.id);
                        setSelectedMeasurementId('');
                      },
                    };
                    if (tool.shape === 'circle') return <circle key={mark.id} {...common} cx={x} cy={y} r="8" fill={tool.color} />;
                    if (tool.shape === 'square') return <rect key={mark.id} {...common} x={x - 8} y={y - 8} width="16" height="16" fill={tool.color} />;
                    if (tool.shape === 'diamond') return <rect key={mark.id} {...common} x={x - 7} y={y - 7} width="14" height="14" fill={tool.color} transform={`rotate(45 ${x} ${y})`} />;
                    return <polygon key={mark.id} {...common} points={`${x},${y - 9} ${x - 9},${y + 8} ${x + 9},${y + 8}`} fill={tool.color} />;
                  })}

                  {measurementDraft.length > 0 && (
                    <g className={`measurement-draft ${mode}`}>
                      <polyline points={pointString(measurementDraft, pageSize)} />
                      {measurementDraft.map((point, index) => <circle key={`draft-${index}`} cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="4" />)}
                    </g>
                  )}

                  {calibrationDraft.length > 0 && (
                    <g className="calibration-draft">
                      {calibrationDraft.length === 2 && <line x1={calibrationDraft[0].x * pageSize.width} y1={calibrationDraft[0].y * pageSize.height} x2={calibrationDraft[1].x * pageSize.width} y2={calibrationDraft[1].y * pageSize.height} />}
                      {calibrationDraft.map((point, index) => <circle key={`cal-${index}`} cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="5" />)}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          )}
          <div className="activity-bar">
            <span>{activity}</span>
            <b>{modeLabel}{pageCalibration ? ` · ${pageCalibration.label}` : pdfDoc ? ' · UNSCALED' : ''}</b>
          </div>
        </main>

        <aside className="right-rail">
          <div className="right-tabs">
            <button className={rightTab === 'takeoff' ? 'active' : ''} onClick={() => setRightTab('takeoff')}>Live Takeoff</button>
            <button className={rightTab === 'sync' ? 'active' : ''} onClick={() => setRightTab('sync')}>Sync Review</button>
          </div>

          {rightTab === 'takeoff' && (
            <div className="right-content">
              <div className="panel-title"><b>Takeoff Summary</b><span>{marks.length} marks · {measurements.length} measurements</span></div>

              <div className={pageCalibration ? 'scale-card scaled' : 'scale-card'}>
                <span>Page {page} scale</span>
                <b>{pageCalibration?.label || 'Unscaled'}</b>
                <small>{pageCalibration ? (pageCalibration.source === 'manual' ? 'Two-point calibration' : 'Architectural preset') : 'Set a scale before using measurement tools.'}</small>
              </div>

              <div className="subsection-title"><b>Count quantities</b><span>{summary.length} tools</span></div>
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

              <div className="subsection-title"><b>Measurements</b><span>{measurementRows.length}</span></div>
              {!measurementRows.length && <div className="empty-compact">Distance, polyline, area, and perimeter measurements will appear here.</div>}
              <div className="measurement-list">
                {measurementRows.map(({ measurement, value }) => (
                  <button
                    key={measurement.id}
                    className={measurement.id === selectedMeasurementId ? 'measurement-row selected' : 'measurement-row'}
                    onClick={() => {
                      setPage(measurement.page);
                      setSelectedMeasurementId(measurement.id);
                      setSelectedMarkId('');
                    }}
                  >
                    <span className={`measurement-kind-icon ${measurement.kind}`} />
                    <span><b>{measurement.name}</b><small>Page {measurement.page} · {measurement.points.length} points</small></span>
                    <strong>{formatMeasurement(value, measurement.kind)}</strong>
                  </button>
                ))}
              </div>

              <div className="rule-placeholder"><span>Controlled downstream connection</span><b>Takeoff → Sync Review → Estimate / BOM</b><p>Count and measurement data remain takeoff records until an explicit downstream sync is approved.</p></div>
            </div>
          )}

          {rightTab === 'sync' && (
            <div className="right-content">
              <div className="panel-title"><b>Sync Review</b><span>{syncRequired ? 'Changes pending' : 'No changes'}</span></div>
              <p className="sync-help">Drawing changes never overwrite Estimate/BOM quantities automatically. Review each difference and apply only the rows you intend to change.</p>
              {!syncRows.length && <div className="empty-compact">Complete a count takeoff first.</div>}
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
              <div className="local-preview-note">Phase 1 uses a local estimate preview only. The later cloud integration will send only explicitly approved changes into the shared ScopeLogic Quote/BOM engine.</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
