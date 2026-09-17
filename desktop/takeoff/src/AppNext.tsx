import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type DragEvent as ReactDragEvent,
} from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import DrawingPagesRail from './DrawingPagesRail';
import AnnotationLayer from './AnnotationLayer';
import AnnotationPanel from './AnnotationPanel';
import RecoveryPrompt from './RecoveryPrompt';
import {
  DEFAULT_ANNOTATION_COLOR,
  createMarkup,
  createSnippet,
  markupLabel,
  normalizedBounds,
} from './annotations';
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
import {
  clearTakeoffRecovery,
  loadTakeoffRecovery,
  saveTakeoffRecovery,
} from './persistence';
import type {
  DrawingMarkup,
  DrawingSnippet,
  Mark,
  MarkupKind,
  Shape,
  TakeoffRecoverySnapshot,
  Tool,
} from './takeoff-model';
import './measurements.css';
import './annotations.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Mode = 'select' | 'pan' | 'count' | 'calibrate' | 'snippet' | MeasurementKind | MarkupKind;
type DockPanel = 'measurements' | 'markups' | 'sync';
type DockLocation = 'right' | 'top';
type SummaryRow = { tool: Tool; locations: number; qty: number };
type CountRow = { key: string; tool: Tool; category: string; page: number; locations: number; qty: number; unit: string };

const COLORS = ['#4B6623', '#31513b', '#2563eb', '#b45309', '#b91c1c', '#6d28d9', '#111827', '#0e7490'];
const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond'];
const MULTI_POINT_MODES: MeasurementKind[] = ['polyline', 'area', 'perimeter'];
const MEASUREMENT_MODES: MeasurementKind[] = ['distance', 'polyline', 'area', 'perimeter'];
const MARKUP_MODES: MarkupKind[] = ['text', 'line', 'arrow', 'rectangle', 'cloud', 'highlight', 'freehand'];
const TWO_POINT_MARKUPS: MarkupKind[] = ['line', 'arrow', 'rectangle', 'cloud', 'highlight'];
const PANEL_LABELS: Record<DockPanel, string> = { measurements: 'Measurements', markups: 'Markups', sync: 'Sync Review' };
const DEFAULT_TOOL_CATEGORY = 'General';
const uid = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
const pointString = (points: Point[], size: PageSize) => points.map((point) => `${point.x * size.width},${point.y * size.height}`).join(' ');
const fileStem = (value: string) => value.replace(/\.pdf$/i, '') || 'Takeoff Project';

function ShapeMark({ shape, color, size = 14 }: { shape: Shape; color: string; size?: number }) {
  if (shape === 'circle') return <span className="tool-shape circle" style={{ width: size, height: size, background: color }} />;
  if (shape === 'square') return <span className="tool-shape square" style={{ width: size, height: size, background: color }} />;
  if (shape === 'diamond') return <span className="tool-shape diamond" style={{ width: size, height: size, background: color }} />;
  return <span className="tool-shape triangle" style={{ borderLeftWidth: size / 2, borderRightWidth: size / 2, borderBottomWidth: size, borderBottomColor: color }} />;
}

export default function AppNext() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const drawingViewportRef = useRef<HTMLDivElement>(null);
  const pointerDrawingRef = useRef(false);
  const panGestureRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const bottomResizeRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [drawingFingerprint, setDrawingFingerprint] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>({ width: 900, height: 1160 });
  const [pageBaseSizes, setPageBaseSizes] = useState<Record<number, PageSize>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState(() => uid());
  const [projectName, setProjectName] = useState('Takeoff Project');
  const [recoveryCandidate, setRecoveryCandidate] = useState<TakeoffRecoverySnapshot | null>(null);
  const [recoveryDecisionMade, setRecoveryDecisionMade] = useState(false);
  const [pendingRecoveredDrawing, setPendingRecoveredDrawing] = useState(false);

  const [mode, setMode] = useState<Mode>('select');
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
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
    { id: 'default-count', name: 'Count Item', category: DEFAULT_TOOL_CATEGORY, shape: 'circle', color: '#4B6623', multiplier: 1, unit: 'qty', size: 16, opacity: 1 },
  ]);
  const [selectedToolId, setSelectedToolId] = useState('default-count');
  const [showToolForm, setShowToolForm] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', category: DEFAULT_TOOL_CATEGORY, shape: 'circle' as Shape, color: '#4B6623', multiplier: 1, unit: 'qty', size: 16, opacity: 1 });
  const [collapsedToolsets, setCollapsedToolsets] = useState<Record<string, boolean>>({});
  const [toolSearch, setToolSearch] = useState('');

  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);
  const [snippets, setSnippets] = useState<DrawingSnippet[]>([]);
  const [selectedMarkupId, setSelectedMarkupId] = useState('');
  const [selectedSnippetId, setSelectedSnippetId] = useState('');
  const [annotationDraft, setAnnotationDraft] = useState<Point[]>([]);
  const [annotationColor, setAnnotationColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [annotationText, setAnnotationText] = useState('');

  const [panelDock, setPanelDock] = useState<Record<DockPanel, DockLocation>>({ measurements: 'right', markups: 'right', sync: 'right' });
  const [activeRightPanel, setActiveRightPanel] = useState<DockPanel>('measurements');
  const [activeTopPanel, setActiveTopPanel] = useState<DockPanel>('measurements');
  const [estimateQty, setEstimateQty] = useState<Record<string, number>>({});
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState('Open a PDF drawing set to begin.');
  const [bottomHeight, setBottomHeight] = useState(210);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [countFilters, setCountFilters] = useState({ category: '', tool: '', page: '', unit: '' });

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement)) {
        event.preventDefault();
        setSpaceDown(true);
      }
    };
    const keyUp = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceDown(false); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('technology-takeoff-ui-layout-v2');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.panelDock) setPanelDock(saved.panelDock);
        if (Number.isFinite(saved.bottomHeight)) setBottomHeight(clamp(saved.bottomHeight, 120, 520));
        if (typeof saved.bottomCollapsed === 'boolean') setBottomCollapsed(saved.bottomCollapsed);
        if (saved.collapsedToolsets) setCollapsedToolsets(saved.collapsedToolsets);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('technology-takeoff-ui-layout-v2', JSON.stringify({ panelDock, bottomHeight, bottomCollapsed, collapsedToolsets })); } catch {}
  }, [panelDock, bottomHeight, bottomCollapsed, collapsedToolsets]);

  useEffect(() => {
    const recovered = loadTakeoffRecovery();
    if (recovered) setRecoveryCandidate(recovered);
    else setRecoveryDecisionMade(true);
  }, []);

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

  const countRows = useMemo<CountRow[]>(() => {
    const rows = new Map<string, CountRow>();
    for (const mark of marks) {
      const tool = tools.find((item) => item.id === mark.toolId);
      if (!tool) continue;
      const category = tool.category?.trim() || DEFAULT_TOOL_CATEGORY;
      const key = `${tool.id}|${mark.page}`;
      const current = rows.get(key) || { key, tool, category, page: mark.page, locations: 0, qty: 0, unit: tool.unit };
      current.locations += 1;
      current.qty += Number(tool.multiplier) || 0;
      rows.set(key, current);
    }
    return [...rows.values()].sort((a, b) => a.category.localeCompare(b.category) || a.tool.name.localeCompare(b.tool.name) || a.page - b.page);
  }, [marks, tools]);

  const filteredCountRows = useMemo(() => countRows.filter((row) => {
    const categoryNeedle = countFilters.category.trim().toLowerCase();
    const toolNeedle = countFilters.tool.trim().toLowerCase();
    const pageNeedle = countFilters.page.trim().toLowerCase();
    const unitNeedle = countFilters.unit.trim().toLowerCase();
    return (!categoryNeedle || row.category.toLowerCase().includes(categoryNeedle))
      && (!toolNeedle || row.tool.name.toLowerCase().includes(toolNeedle))
      && (!pageNeedle || String(row.page).includes(pageNeedle))
      && (!unitNeedle || row.unit.toLowerCase().includes(unitNeedle));
  }), [countRows, countFilters]);

  const toolCategories = useMemo(() => {
    const search = toolSearch.trim().toLowerCase();
    const groups = new Map<string, Tool[]>();
    for (const tool of tools) {
      const category = tool.category?.trim() || DEFAULT_TOOL_CATEGORY;
      if (search && !`${category} ${tool.name} ${tool.unit}`.toLowerCase().includes(search)) continue;
      const list = groups.get(category) || [];
      list.push(tool);
      groups.set(category, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => ({ category, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [tools, toolSearch]);

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
    setAnnotationDraft([]);
    pointerDrawingRef.current = false;
    setSelectedMarkId('');
    setSelectedMeasurementId('');
    setViewOffset({ x: 0, y: 0 });
  }, [page]);

  useEffect(() => {
    if (!recoveryDecisionMade || !fileName) return;
    const timeout = window.setTimeout(() => {
      saveTakeoffRecovery({
        id: projectId,
        name: projectName,
        drawing: { fileName, pageCount, fingerprint: drawingFingerprint || undefined },
        view: { page, zoom },
        tools,
        marks,
        measurements,
        calibrations: pageCalibrations,
        markups,
        snippets,
        estimatePreview: estimateQty,
        syncSelection,
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [
    recoveryDecisionMade,
    projectId,
    projectName,
    fileName,
    pageCount,
    drawingFingerprint,
    page,
    zoom,
    tools,
    marks,
    measurements,
    pageCalibrations,
    markups,
    snippets,
    estimateQty,
    syncSelection,
  ]);

  const clearSelections = () => {
    setSelectedMarkId('');
    setSelectedMeasurementId('');
    setSelectedMarkupId('');
    setSelectedSnippetId('');
  };

  const resetTakeoffData = () => {
    setMarks([]);
    setMeasurements([]);
    setEstimateQty({});
    setSyncSelection({});
    setPageCalibrations({});
    setPageBaseSizes({});
    setMarkups([]);
    setSnippets([]);
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    setAnnotationDraft([]);
    clearSelections();
  };

  const restoreRecovery = () => {
    if (!recoveryCandidate) return;
    const recovered = recoveryCandidate;
    setProjectId(recovered.id || uid());
    setProjectName(recovered.name || fileStem(recovered.drawing.fileName));
    setFileName(recovered.drawing.fileName);
    setDrawingFingerprint(recovered.drawing.fingerprint || '');
    setPageCount(recovered.drawing.pageCount || 0);
    setPage(Math.max(1, recovered.view.page || 1));
    setZoom(clamp(recovered.view.zoom || 1, 0.2, 4));
    setTools(recovered.tools.length ? recovered.tools : tools);
    setMarks(recovered.marks);
    setMeasurements(recovered.measurements);
    setPageCalibrations(recovered.calibrations || {});
    setMarkups(recovered.markups || []);
    setSnippets(recovered.snippets || []);
    setEstimateQty(recovered.estimatePreview || {});
    setSyncSelection(recovered.syncSelection || {});
    setPendingRecoveredDrawing(true);
    setRecoveryCandidate(null);
    setRecoveryDecisionMade(true);
    setActivity(`Recovered ${recovered.name || 'Takeoff Project'}. Reopen ${recovered.drawing.fileName} to restore the drawing beneath the preserved takeoff.`);
  };

  const startFresh = () => {
    clearTakeoffRecovery();
    setRecoveryCandidate(null);
    setRecoveryDecisionMade(true);
    setActivity('Started a fresh Takeoff session. Open a PDF drawing set to begin.');
  };

  const openPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      const fingerprint = String(doc.fingerprints?.[0] || '');
      const recoveredMatches = pendingRecoveredDrawing
        && file.name === fileName
        && (!drawingFingerprint || !fingerprint || drawingFingerprint === fingerprint);

      setPdfDoc(doc);
      setFileName(file.name);
      setDrawingFingerprint(fingerprint);
      setPageCount(doc.numPages);
      setPageBaseSizes({});

      if (recoveredMatches) {
        setPage((value) => clamp(value, 1, doc.numPages));
        setPendingRecoveredDrawing(false);
        setActivity(`${file.name} reopened. Recovered marks, measurements, annotations, snippets, scales, and pending Sync Review state are retained.`);
      } else {
        setProjectId(uid());
        setProjectName(fileStem(file.name));
        setPage(1);
        setZoom(1);
        resetTakeoffData();
        setMode('count');
        setPendingRecoveredDrawing(false);
        setActivity(`${file.name} loaded. ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} ready for takeoff.`);
      }
    } catch (cause) {
      setPdfDoc(null);
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
    setAnnotationDraft([]);
    pointerDrawingRef.current = false;

    if (nextMode === 'select') setActivity('Select mode. Click a count, measurement, markup, or snippet to edit its properties.');
    else if (nextMode === 'calibrate') setActivity(`Calibration mode. Pick two points on page ${page}, enter the known distance, then set the scale.`);
    else if (nextMode === 'count') setActivity('Count mode. Select a Tool Chest item and place count marks.');
    else if (nextMode === 'pan') setActivity('Pan mode. Drag the drawing freely in any direction. Mouse wheel zooms toward the cursor.');
    else if (MEASUREMENT_MODES.includes(nextMode as MeasurementKind)) setActivity(`${measurementKindLabel(nextMode as MeasurementKind)} mode. ${nextMode === 'distance' ? 'Pick two points.' : 'Pick points, then use Finish.'}`);
    else if (nextMode === 'snippet') setActivity('Snippet mode. Pick two corners of the drawing region to capture.');
    else if (nextMode === 'freehand') setActivity('Freehand markup. Press and drag on the drawing.');
    else if (nextMode === 'text') setActivity('Text note mode. Enter note text if desired, then click the drawing to place it.');
    else setActivity(`${markupLabel(nextMode as MarkupKind)} markup. Pick two points on the drawing.`);
  };

  const createMeasurement = (kind: MeasurementKind, points: Point[]) => {
    if (!pageCalibration || !pageBaseSize) {
      setActivity(`Page ${page} must be calibrated before measurement takeoff.`);
      return;
    }
    const ordinal = measurements.filter((item) => item.kind === kind).length + 1;
    const measurement: Measurement = { id: uid(), page, kind, name: `${measurementKindLabel(kind)} ${ordinal}`, points, color: '#4B6623', lineWidth: 2.25, opacity: 1 };
    setMeasurements((items) => [...items, measurement]);
    clearSelections();
    setSelectedMeasurementId(measurement.id);
    setMeasurementDraft([]);
    const value = measurementValue(measurement, pageCalibration, pageBaseSize);
    setActivity(`${measurement.name} added: ${formatMeasurement(value, kind)}. Measurement geometry remains independent from Estimate/BOM quantities.`);
  };

  const normalizeClientPoint = (clientX: number, clientY: number): Point | null => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const normalizeOverlayPoint = (event: ReactMouseEvent<SVGSVGElement>) => normalizeClientPoint(event.clientX, event.clientY);

  const captureSnippetPreview = (bounds: DrawingSnippet['bounds']) => {
    const canvas = canvasRef.current;
    if (!canvas || bounds.width <= 0 || bounds.height <= 0) return undefined;
    try {
      const sx = Math.max(0, Math.floor(bounds.x * canvas.width));
      const sy = Math.max(0, Math.floor(bounds.y * canvas.height));
      const sw = Math.max(1, Math.floor(bounds.width * canvas.width));
      const sh = Math.max(1, Math.floor(bounds.height * canvas.height));
      const preview = document.createElement('canvas');
      const targetWidth = 240;
      const targetHeight = Math.max(60, Math.min(180, Math.round(targetWidth * (sh / sw))));
      preview.width = targetWidth;
      preview.height = targetHeight;
      const context = preview.getContext('2d');
      if (!context) return undefined;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(canvas, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
      return preview.toDataURL('image/jpeg', 0.8);
    } catch {
      return undefined;
    }
  };

  const clickOverlay = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!pdfDoc || mode === 'pan' || mode === 'freehand') return;
    if (mode === 'select') { clearSelections(); setActivity('Nothing selected.'); return; }
    const point = normalizeOverlayPoint(event);
    if (!point) return;

    if (mode === 'count') {
      const tool = tools.find((item) => item.id === selectedToolId);
      if (!tool) return;
      const mark: Mark = { id: uid(), page, toolId: tool.id, x: point.x, y: point.y };
      setMarks((items) => [...items, mark]);
      clearSelections();
      setSelectedMarkId(mark.id);
      setActivity(`${tool.name} added on page ${page}. Estimate quantities remain unchanged until Sync Review is applied.`);
      return;
    }

    if (mode === 'calibrate') {
      if (calibrationDraft.length >= 2) return;
      const next = [...calibrationDraft, point];
      setCalibrationDraft(next);
      setActivity(next.length === 1 ? 'Calibration start point set. Pick the second point.' : 'Calibration line set. Confirm the known distance and click Set Scale.');
      return;
    }

    if (MEASUREMENT_MODES.includes(mode as MeasurementKind)) {
      if (!canMeasurePage) {
        setActivity(`Page ${page} is not scaled. Use Calibrate or a preset architectural scale first.`);
        return;
      }
      if (mode === 'distance') {
        if (!measurementDraft.length) {
          setMeasurementDraft([point]);
          setActivity('Distance start point set. Pick the second point.');
        } else createMeasurement('distance', [measurementDraft[0], point]);
        return;
      }
      setMeasurementDraft((current) => [...current, point]);
      setActivity(`${measurementKindLabel(mode as MeasurementKind)} point ${measurementDraft.length + 1} added. Use Finish when the path is complete.`);
      return;
    }

    if (mode === 'text') {
      const markup = createMarkup('text', page, [point], { color: annotationColor, text: annotationText.trim() || 'Note' });
      setMarkups((items) => [...items, markup]);
      clearSelections();
      setSelectedMarkupId(markup.id);
      activatePanel('markups');
      setActivity(`Text note added on page ${page}. Drawing annotations do not affect takeoff quantities.`);
      return;
    }

    if (mode === 'snippet') {
      if (!annotationDraft.length) {
        setAnnotationDraft([point]);
        setActivity('Snippet first corner set. Pick the opposite corner.');
      } else {
        const bounds = normalizedBounds(annotationDraft[0], point);
        if (bounds.width < 0.002 || bounds.height < 0.002) {
          setAnnotationDraft([]);
          setActivity('Snippet region was too small. Try again.');
          return;
        }
        const snippet = createSnippet(page, bounds, { previewDataUrl: captureSnippetPreview(bounds) });
        setSnippets((items) => [...items, snippet]);
        setAnnotationDraft([]);
        clearSelections();
        setSelectedSnippetId(snippet.id);
        activatePanel('markups');
        setActivity(`Snippet captured on page ${page}. The source bounds and optional preview are stored independently from quantity takeoff.`);
      }
      return;
    }

    if (TWO_POINT_MARKUPS.includes(mode as MarkupKind)) {
      if (!annotationDraft.length) {
        setAnnotationDraft([point]);
        setActivity(`${markupLabel(mode as MarkupKind)} start point set. Pick the second point.`);
      } else {
        const markup = createMarkup(mode as MarkupKind, page, [annotationDraft[0], point], { color: annotationColor });
        setMarkups((items) => [...items, markup]);
        setAnnotationDraft([]);
        clearSelections();
        setSelectedMarkupId(markup.id);
        activatePanel('markups');
        setActivity(`${markupLabel(mode as MarkupKind)} added on page ${page}. Drawing annotations do not affect takeoff quantities.`);
      }
    }
  };

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pdfDoc || mode !== 'freehand') return;
    const point = normalizeClientPoint(event.clientX, event.clientY);
    if (!point) return;
    pointerDrawingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setAnnotationDraft([point]);
  };

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointerDrawingRef.current || mode !== 'freehand') return;
    const point = normalizeClientPoint(event.clientX, event.clientY);
    if (!point) return;
    setAnnotationDraft((current) => {
      const previous = current[current.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.002) return current;
      return [...current, point];
    });
  };

  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointerDrawingRef.current || mode !== 'freehand') return;
    pointerDrawingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setAnnotationDraft((current) => {
      if (current.length >= 2) {
        const markup = createMarkup('freehand', page, current, { color: annotationColor });
        setMarkups((items) => [...items, markup]);
        clearSelections();
        setSelectedMarkupId(markup.id);
        activatePanel('markups');
        setActivity(`Freehand markup added on page ${page}. It remains an annotation only.`);
      } else setActivity('Freehand stroke was too short and was discarded.');
      return [];
    });
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
    setAnnotationDraft([]);
    pointerDrawingRef.current = false;
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
    setPageCalibrations((current) => ({ ...current, [page]: { feetPerPdfPoint: knownFeet / pdfPointDistance, label, source: 'manual' } }));
    setCalibrationDraft([]);
    setMode('pan');
    setActivity(`Page ${page} calibrated from a ${fmt(known)} ${calibrationKnownUnit} reference. Existing raw measurement geometry now uses this page scale.`);
  };

  const applyPresetScale = (presetId: string) => {
    const preset = PRESET_SCALES.find((item) => item.id === presetId);
    if (!preset) return;
    setPageCalibrations((current) => ({ ...current, [page]: { feetPerPdfPoint: preset.feetPerPdfPoint, label: preset.label, source: 'preset' } }));
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
      category: newTool.category.trim() || DEFAULT_TOOL_CATEGORY,
      shape: newTool.shape,
      color: newTool.color,
      multiplier: Math.max(0, Number(newTool.multiplier) || 1),
      unit: newTool.unit.trim() || 'qty',
      size: clamp(Number(newTool.size) || 16, 8, 40),
      opacity: clamp(Number(newTool.opacity) || 1, 0.1, 1),
    };
    setTools((items) => [...items, tool]);
    setSelectedToolId(tool.id);
    changeMode('count');
    setNewTool({ name: '', category: tool.category || DEFAULT_TOOL_CATEGORY, shape: 'circle', color: '#4B6623', multiplier: 1, unit: 'qty', size: 16, opacity: 1 });
    setShowToolForm(false);
    setActivity(`${tool.name} added to the local Tool Chest.`);
  };

  const deleteSelected = () => {
    if (selectedSnippetId) {
      setSnippets((items) => items.filter((item) => item.id !== selectedSnippetId));
      setSelectedSnippetId('');
      setActivity('Selected drawing snippet removed. Takeoff quantities were not changed.');
      return;
    }
    if (selectedMarkupId) {
      setMarkups((items) => items.filter((item) => item.id !== selectedMarkupId));
      setSelectedMarkupId('');
      setActivity('Selected drawing markup removed. Takeoff quantities were not changed.');
      return;
    }
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

  const activatePanel = (panel: DockPanel) => {
    if (panelDock[panel] === 'top') setActiveTopPanel(panel);
    else setActiveRightPanel(panel);
  };

  const dockPanel = (event: ReactDragEvent<HTMLElement>, location: DockLocation) => {
    event.preventDefault();
    const panel = event.dataTransfer.getData('text/takeoff-panel') as DockPanel;
    if (!PANEL_LABELS[panel]) return;
    setPanelDock((current) => ({ ...current, [panel]: location }));
    if (location === 'top') setActiveTopPanel(panel);
    else setActiveRightPanel(panel);
  };

  const dragPanel = (event: ReactDragEvent<HTMLButtonElement>, panel: DockPanel) => {
    event.dataTransfer.setData('text/takeoff-panel', panel);
    event.dataTransfer.effectAllowed = 'move';
  };

  const fitPage = () => {
    const viewport = drawingViewportRef.current;
    const base = pageBaseSizes[page];
    if (!viewport || !base) return;
    const rect = viewport.getBoundingClientRect();
    const next = clamp(Math.min((rect.width - 44) / base.width, (rect.height - 44) / base.height), 0.2, 4);
    setZoom(next);
    setViewOffset({ x: 0, y: 0 });
    setActivity(`Fit Page · ${Math.round(next * 100)}%`);
  };

  const fitWidth = () => {
    const viewport = drawingViewportRef.current;
    const base = pageBaseSizes[page];
    if (!viewport || !base) return;
    const rect = viewport.getBoundingClientRect();
    const next = clamp((rect.width - 44) / base.width, 0.2, 4);
    setZoom(next);
    setViewOffset({ x: 0, y: 0 });
    setActivity(`Fit Width · ${Math.round(next * 100)}%`);
  };

  const wheelZoom = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!pdfDoc) return;
    event.preventDefault();
    const viewport = drawingViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clamp(zoom * factor, 0.2, 4);
    if (Math.abs(nextZoom - zoom) < 0.0001) return;
    const ratio = nextZoom / zoom;
    const cursorX = event.clientX - rect.left - rect.width / 2;
    const cursorY = event.clientY - rect.top - rect.height / 2;
    setViewOffset((current) => ({
      x: current.x + (cursorX - current.x) * (1 - ratio),
      y: current.y + (cursorY - current.y) * (1 - ratio),
    }));
    setZoom(nextZoom);
  };

  const panPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const canPan = mode === 'pan' || spaceDown || event.button === 1;
    if (!canPan) return;
    event.preventDefault();
    panGestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: viewOffset.x, originY: viewOffset.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const panPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setViewOffset({ x: gesture.originX + event.clientX - gesture.x, y: gesture.originY + event.clientY - gesture.y });
  };
  const panPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panGestureRef.current?.pointerId !== event.pointerId) return;
    panGestureRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const beginBottomResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    bottomResizeRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: bottomHeight };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveBottomResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = bottomResizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setBottomCollapsed(false);
    setBottomHeight(clamp(drag.startHeight + (drag.startY - event.clientY), 120, Math.max(180, window.innerHeight * 0.58)));
  };
  const endBottomResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (bottomResizeRef.current?.pointerId !== event.pointerId) return;
    bottomResizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const pageMarks = marks.filter((mark) => mark.page === page);
  const pageMeasurements = measurementRows.filter((row) => row.measurement.page === page);
  const selectedTool = tools.find((item) => item.id === selectedToolId);
  const selectedMark = marks.find((item) => item.id === selectedMarkId);
  const selectedMarkTool = selectedMark ? tools.find((item) => item.id === selectedMark.toolId) : undefined;
  const selectedMeasurement = measurements.find((item) => item.id === selectedMeasurementId);
  const selectedMarkup = markups.find((item) => item.id === selectedMarkupId);
  const selectedSnippet = snippets.find((item) => item.id === selectedSnippetId);
  const propertyTool = selectedMarkTool || (!selectedMeasurement && !selectedMarkup && !selectedSnippet ? selectedTool : undefined);
  const patchTool = (toolId: string, patch: Partial<Tool>) => setTools((items) => items.map((item) => item.id === toolId ? { ...item, ...patch } : item));
  const patchMeasurement = (patch: Partial<Measurement>) => selectedMeasurementId && setMeasurements((items) => items.map((item) => item.id === selectedMeasurementId ? { ...item, ...patch } : item));
  const patchMarkup = (patch: Partial<DrawingMarkup>) => selectedMarkupId && setMarkups((items) => items.map((item) => item.id === selectedMarkupId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  const patchSnippet = (patch: Partial<DrawingSnippet>) => selectedSnippetId && setSnippets((items) => items.map((item) => item.id === selectedSnippetId ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  const draftPointCount = mode === 'calibrate' ? calibrationDraft.length : MEASUREMENT_MODES.includes(mode as MeasurementKind) ? measurementDraft.length : annotationDraft.length;
  const modeLabel = mode === 'select'
    ? 'SELECT'
    : mode === 'count'
      ? `COUNT · ${selectedTool?.name || 'No Tool'}`
      : mode === 'pan'
      ? 'PAN'
      : mode === 'calibrate'
        ? `CALIBRATE · ${draftPointCount}/2`
        : MEASUREMENT_MODES.includes(mode as MeasurementKind)
          ? `${measurementKindLabel(mode as MeasurementKind).toUpperCase()} · ${draftPointCount} PT`
          : mode === 'snippet'
            ? `SNIPPET · ${draftPointCount}/2`
            : `${markupLabel(mode as MarkupKind).toUpperCase()}${annotationDraft.length ? ` · ${annotationDraft.length} PT` : ''}`;

  const markupDraftRect = annotationDraft.length >= 1
    ? (() => {
      const a = annotationDraft[0];
      const b = annotationDraft[1] || annotationDraft[0];
      const bounds = normalizedBounds(a, b);
      return {
        x: bounds.x * pageSize.width,
        y: bounds.y * pageSize.height,
        width: bounds.width * pageSize.width,
        height: bounds.height * pageSize.height,
      };
    })()
    : null;

  return (
    <div className="desktop-shell">
      {recoveryCandidate && (
        <RecoveryPrompt snapshot={recoveryCandidate} onRestore={restoreRecovery} onStartFresh={startFresh} />
      )}

      <header className="desktop-topbar">
        <div className="desktop-brand">
          <div className="brand-mark">T</div>
          <div><strong>Technology Preconstruction</strong><span>Takeoff Desktop</span></div>
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

        <button className={mode === 'select' ? 'button active' : 'button'} onClick={() => changeMode('select')}>Select</button>
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
        <span className="command-label">Markup</span>
        <button className={mode === 'text' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('text')}>Text</button>
        <button className={mode === 'line' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('line')}>Line</button>
        <button className={mode === 'arrow' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('arrow')}>Arrow</button>
        <button className={mode === 'rectangle' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('rectangle')}>Box</button>
        <button className={mode === 'cloud' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('cloud')}>Cloud</button>
        <button className={mode === 'highlight' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('highlight')}>Highlight</button>
        <button className={mode === 'freehand' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('freehand')}>Freehand</button>
        <button className={mode === 'snippet' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('snippet')}>Snippet</button>
        <input className="annotation-color-input" aria-label="Markup color" type="color" value={annotationColor} onChange={(event) => setAnnotationColor(event.target.value)} />
        {mode === 'text' && <input className="annotation-text-input" value={annotationText} onChange={(event) => setAnnotationText(event.target.value)} placeholder="Note text" />}
        {annotationDraft.length > 0 && mode !== 'freehand' && <button className="button" onClick={cancelDraft}>Cancel</button>}

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
        <button className="button" disabled={!pdfDoc} onClick={() => { setZoom(1); setViewOffset({ x: 0, y: 0 }); }}>100%</button>
        <button className="button" disabled={!pdfDoc} onClick={fitPage}>Fit Page</button>
        <button className="button" disabled={!pdfDoc} onClick={fitWidth}>Fit Width</button>
        <div className="command-spacer" />
        <button className="button primary" disabled={!summary.length} onClick={() => activatePanel('sync')}>Review Sync</button>
      </div>

      <section
        className={Object.values(panelDock).includes('top') ? 'panel-dock-top has-panels' : 'panel-dock-top'}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => dockPanel(event, 'top')}
      >
        {Object.values(panelDock).includes('top') && (
          <>
            <div className="dock-tabbar">
              {(Object.keys(PANEL_LABELS) as DockPanel[]).filter((panel) => panelDock[panel] === 'top').map((panel) => (
                <button key={panel} draggable onDragStart={(event) => dragPanel(event, panel)} className={activeTopPanel === panel ? 'active' : ''} onClick={() => setActiveTopPanel(panel)}>
                  {PANEL_LABELS[panel]}
                </button>
              ))}
              <span>Drag tabs between the top and right docks.</span>
            </div>
            <div className="top-dock-content">
              {activeTopPanel === 'measurements' && (
                <div className="dock-list">
                  {measurementRows.map(({ measurement, value }) => <button key={measurement.id} className={measurement.id === selectedMeasurementId ? 'dock-row selected' : 'dock-row'} onClick={() => { setPage(measurement.page); clearSelections(); setSelectedMeasurementId(measurement.id); }}><span>{measurement.name}</span><small>Page {measurement.page}</small><b>{formatMeasurement(value, measurement.kind)}</b></button>)}
                  {!measurementRows.length && <div className="empty-compact">No measurements yet.</div>}
                </div>
              )}
              {activeTopPanel === 'markups' && <AnnotationPanel markups={markups} snippets={snippets} selectedMarkupId={selectedMarkupId} selectedSnippetId={selectedSnippetId} onSelectMarkup={(id) => { clearSelections(); setSelectedMarkupId(id); }} onSelectSnippet={(id) => { clearSelections(); setSelectedSnippetId(id); }} onChangeMarkups={setMarkups} onChangeSnippets={setSnippets} onGoToPage={setPage} onDeleteSelected={deleteSelected} />}
              {activeTopPanel === 'sync' && (
                <div className="sync-table compact-dock">{syncRows.map((row) => <label className="sync-row" key={row.tool.id}><input type="checkbox" checked={syncSelection[row.tool.id] ?? true} onChange={(event) => setSyncSelection({ ...syncSelection, [row.tool.id]: event.target.checked })}/><span><b>{row.tool.name}</b><small>{row.tool.unit}</small></span><span><small>Takeoff</small><b>{fmt(row.qty)}</b></span><span><small>Estimate</small><b>{fmt(row.current)}</b></span><span className={row.difference === 0 ? 'diff zero' : 'diff'}><small>Difference</small><b>{row.difference > 0 ? '+' : ''}{fmt(row.difference)}</b></span></label>)}</div>
              )}
            </div>
          </>
        )}
      </section>

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
            <div className="tool-search"><input value={toolSearch} onChange={(event) => setToolSearch(event.target.value)} placeholder="Search tool sets / tools…" /></div>
            {showToolForm && (
              <div className="tool-form">
                <label><span>Name</span><input value={newTool.name} onChange={(event) => setNewTool({ ...newTool, name: event.target.value })} placeholder="Count tool name" /></label>
                <label><span>Tool Set / Category</span><input value={newTool.category} onChange={(event) => setNewTool({ ...newTool, category: event.target.value })} placeholder="Structured Cabling, CCTV, Access Control…" /></label>
                <div className="tool-form-grid">
                  <label><span>Shape</span><select value={newTool.shape} onChange={(event) => setNewTool({ ...newTool, shape: event.target.value as Shape })}>{SHAPES.map((shape) => <option key={shape}>{shape}</option>)}</select></label>
                  <label><span>Multiplier</span><input type="number" min="0" step="0.01" value={newTool.multiplier} onChange={(event) => setNewTool({ ...newTool, multiplier: Number(event.target.value) })} /></label>
                  <label><span>Size</span><input type="number" min="8" max="40" value={newTool.size} onChange={(event) => setNewTool({ ...newTool, size: Number(event.target.value) })} /></label>
                  <label><span>Unit</span><input value={newTool.unit} onChange={(event) => setNewTool({ ...newTool, unit: event.target.value })} /></label>
                </div>
                <div className="color-row">{COLORS.map((color) => <button key={color} className={newTool.color === color ? 'selected' : ''} style={{ background: color }} aria-label={`Use ${color}`} onClick={() => setNewTool({ ...newTool, color })} />)}</div>
                <div className="tool-form-actions"><button className="button" onClick={() => setShowToolForm(false)}>Cancel</button><button className="button primary" disabled={!newTool.name.trim()} onClick={addTool}>Add Tool</button></div>
              </div>
            )}
            <div className="tool-list grouped">
              {toolCategories.map(({ category, items }) => (
                <section className="tool-set" key={category}>
                  <div className="tool-set-heading">
                    <button className="tool-set-toggle" onClick={() => setCollapsedToolsets((current) => ({ ...current, [category]: !current[category] }))}><span>{collapsedToolsets[category] ? '▶' : '▼'}</span><b>{category}</b><small>{items.length}</small></button>
                    <button className="tool-set-gear" title="Tool set settings" onClick={() => setCollapsedToolsets((current) => ({ ...current, [category]: false }))}>⚙</button>
                  </div>
                  {!collapsedToolsets[category] && <div className="tool-set-items">{items.map((tool) => (
                    <button key={tool.id} className={tool.id === selectedToolId ? 'tool-row active' : 'tool-row'} onClick={() => { setSelectedToolId(tool.id); clearSelections(); changeMode('count'); }}>
                      <ShapeMark shape={tool.shape} color={tool.color} size={tool.size || 14} />
                      <span><b>{tool.name}</b><small>×{fmt(tool.multiplier)} {tool.unit}</small></span>
                    </button>
                  ))}</div>}
                </section>
              ))}
            </div>
          </section>

          <section className="rail-section properties-section">
            <div className="rail-heading"><b>⚙ Properties</b><span>{selectedMeasurement ? 'Measurement' : selectedMarkup ? 'Markup' : selectedSnippet ? 'Snippet' : propertyTool ? 'Count Tool' : 'Nothing selected'}</span></div>
            <div className="properties-body">
              {propertyTool && (
                <>
                  <label><span>Name</span><input value={propertyTool.name} onChange={(event) => patchTool(propertyTool.id, { name: event.target.value })} /></label>
                  <label><span>Tool Set / Category</span><input value={propertyTool.category || DEFAULT_TOOL_CATEGORY} onChange={(event) => patchTool(propertyTool.id, { category: event.target.value })} /></label>
                  <div className="property-grid">
                    <label><span>Shape</span><select value={propertyTool.shape} onChange={(event) => patchTool(propertyTool.id, { shape: event.target.value as Shape })}>{SHAPES.map((shape) => <option key={shape}>{shape}</option>)}</select></label>
                    <label><span>Color</span><input type="color" value={propertyTool.color} onChange={(event) => patchTool(propertyTool.id, { color: event.target.value })} /></label>
                    <label><span>Size</span><input type="number" min="8" max="40" value={propertyTool.size || 16} onChange={(event) => patchTool(propertyTool.id, { size: clamp(Number(event.target.value), 8, 40) })} /></label>
                    <label><span>Opacity</span><input type="number" min="0.1" max="1" step="0.1" value={propertyTool.opacity ?? 1} onChange={(event) => patchTool(propertyTool.id, { opacity: clamp(Number(event.target.value), .1, 1) })} /></label>
                    <label><span>Multiplier</span><input type="number" min="0" step="0.01" value={propertyTool.multiplier} onChange={(event) => patchTool(propertyTool.id, { multiplier: Math.max(0, Number(event.target.value)) })} /></label>
                    <label><span>Unit</span><input value={propertyTool.unit} onChange={(event) => patchTool(propertyTool.id, { unit: event.target.value })} /></label>
                  </div>
                </>
              )}
              {selectedMeasurement && (
                <>
                  <label><span>Name</span><input value={selectedMeasurement.name} onChange={(event) => patchMeasurement({ name: event.target.value })} /></label>
                  <div className="property-grid">
                    <label><span>Type</span><input value={measurementKindLabel(selectedMeasurement.kind)} readOnly /></label>
                    <label><span>Color</span><input type="color" value={selectedMeasurement.color || '#4B6623'} onChange={(event) => patchMeasurement({ color: event.target.value })} /></label>
                    <label><span>Line Width</span><input type="number" min="1" max="8" step=".25" value={selectedMeasurement.lineWidth || 2.25} onChange={(event) => patchMeasurement({ lineWidth: Number(event.target.value) })} /></label>
                    <label><span>Opacity</span><input type="number" min=".1" max="1" step=".1" value={selectedMeasurement.opacity ?? 1} onChange={(event) => patchMeasurement({ opacity: Number(event.target.value) })} /></label>
                  </div>
                </>
              )}
              {selectedMarkup && (
                <>
                  <label><span>Type</span><input value={markupLabel(selectedMarkup.kind)} readOnly /></label>
                  {selectedMarkup.kind === 'text' && <label><span>Text</span><textarea value={selectedMarkup.text || ''} onChange={(event) => patchMarkup({ text: event.target.value })} /></label>}
                  <div className="property-grid">
                    <label><span>Color</span><input type="color" value={selectedMarkup.color} onChange={(event) => patchMarkup({ color: event.target.value })} /></label>
                    <label><span>Line Width</span><input type="number" min="1" max="10" step=".5" value={selectedMarkup.strokeWidth} onChange={(event) => patchMarkup({ strokeWidth: Number(event.target.value) })} /></label>
                    <label><span>Opacity</span><input type="number" min=".1" max="1" step=".1" value={selectedMarkup.opacity} onChange={(event) => patchMarkup({ opacity: Number(event.target.value) })} /></label>
                  </div>
                </>
              )}
              {selectedSnippet && (
                <>
                  <label><span>Title</span><input value={selectedSnippet.title} onChange={(event) => patchSnippet({ title: event.target.value })} /></label>
                  <label><span>Note</span><textarea value={selectedSnippet.note} onChange={(event) => patchSnippet({ note: event.target.value })} /></label>
                </>
              )}
              {!propertyTool && !selectedMeasurement && !selectedMarkup && !selectedSnippet && <div className="empty-compact">Select a count symbol, measurement, markup, or snippet. Appearance and naming controls will appear here.</div>}
            </div>
            <button className="button danger wide" disabled={!selectedMarkId && !selectedMeasurementId && !selectedMarkupId && !selectedSnippetId} onClick={deleteSelected}>Delete Selected</button>
          </section>
        </aside>

        <main className="drawing-panel">
          {loading && <div className="drawing-message">Loading drawing…</div>}
          {error && <div className="drawing-message error"><b>PDF could not be opened.</b><span>{error}</span></div>}
          {!pdfDoc && !loading && !error && (
            <div className="drawing-message">
              <b>{pendingRecoveredDrawing ? 'Reopen the recovered PDF drawing set' : 'Open a PDF drawing set'}</b>
              <span>{pendingRecoveredDrawing ? `Recovered Takeoff data is preserved. Reopen ${fileName} to restore the drawing beneath it.` : 'Takeoff quantities remain separate from Estimate quantities until you explicitly approve Sync Review changes.'}</span>
            </div>
          )}
          {pdfDoc && (
            <div
              ref={drawingViewportRef}
              className={mode === 'pan' || spaceDown ? 'drawing-scroll pan-mode' : mode === 'count' ? 'drawing-scroll count-mode' : 'drawing-scroll'}
              onWheel={wheelZoom}
              onPointerDown={panPointerDown}
              onPointerMove={panPointerMove}
              onPointerUp={panPointerUp}
              onPointerCancel={panPointerUp}
            >
              <div className="drawing-stage" style={{ width: pageSize.width, height: pageSize.height, transform: `translate(calc(-50% + ${viewOffset.x}px), calc(-50% + ${viewOffset.y}px))` }}>
                <canvas ref={canvasRef} />
                <svg
                  ref={overlayRef}
                  width={pageSize.width}
                  height={pageSize.height}
                  viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
                  onClick={clickOverlay}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={pointerUp}
                >
                  <AnnotationLayer
                    page={page}
                    pageSize={pageSize}
                    markups={markups}
                    snippets={snippets}
                    selectedMarkupId={selectedMarkupId}
                    selectedSnippetId={selectedSnippetId}
                    onSelectMarkup={(id) => {
                      clearSelections();
                      setSelectedMarkupId(id);
                      activatePanel('markups');
                    }}
                    onSelectSnippet={(id) => {
                      clearSelections();
                      setSelectedSnippetId(id);
                      activatePanel('markups');
                    }}
                  />

                  {pageMeasurements.map(({ measurement, value }) => {
                    const points = pointString(measurement.points, pageSize);
                    const selected = measurement.id === selectedMeasurementId;
                    const centerX = measurement.points.reduce((sum, point) => sum + point.x, 0) / measurement.points.length * pageSize.width;
                    const centerY = measurement.points.reduce((sum, point) => sum + point.y, 0) / measurement.points.length * pageSize.height;
                    const clickMeasurement = (event: ReactMouseEvent<SVGElement>) => {
                      event.stopPropagation();
                      clearSelections();
                      setSelectedMeasurementId(measurement.id);
                    };
                    return (
                      <g key={measurement.id} className={selected ? `measurement-graphic ${measurement.kind} selected` : `measurement-graphic ${measurement.kind}`} style={{ color: measurement.color || '#4B6623', opacity: measurement.opacity ?? 1, ['--measurement-line-width' as string]: `${measurement.lineWidth || 2.25}` }}>
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
                        clearSelections();
                        setSelectedMarkId(mark.id);
                      },
                    };
                    const symbolSize = clamp(tool.size || 16, 8, 40);
                    const radius = symbolSize / 2;
                    const opacity = tool.opacity ?? 1;
                    if (tool.shape === 'circle') return <circle key={mark.id} {...common} cx={x} cy={y} r={radius} fill={tool.color} opacity={opacity} />;
                    if (tool.shape === 'square') return <rect key={mark.id} {...common} x={x - radius} y={y - radius} width={symbolSize} height={symbolSize} fill={tool.color} opacity={opacity} />;
                    if (tool.shape === 'diamond') return <rect key={mark.id} {...common} x={x - radius * .88} y={y - radius * .88} width={radius * 1.76} height={radius * 1.76} fill={tool.color} opacity={opacity} transform={`rotate(45 ${x} ${y})`} />;
                    return <polygon key={mark.id} {...common} points={`${x},${y - radius} ${x - radius},${y + radius * .9} ${x + radius},${y + radius * .9}`} fill={tool.color} opacity={opacity} />;
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

                  {annotationDraft.length > 0 && (
                    <g className={`annotation-draft ${mode}`}>
                      {mode === 'freehand' && <polyline points={pointString(annotationDraft, pageSize)} />}
                      {(mode === 'line' || mode === 'arrow') && annotationDraft.length === 2 && (
                        <line x1={annotationDraft[0].x * pageSize.width} y1={annotationDraft[0].y * pageSize.height} x2={annotationDraft[1].x * pageSize.width} y2={annotationDraft[1].y * pageSize.height} />
                      )}
                      {(mode === 'rectangle' || mode === 'cloud' || mode === 'highlight' || mode === 'snippet') && markupDraftRect && (
                        <rect {...markupDraftRect} />
                      )}
                      {annotationDraft.map((point, index) => <circle key={`ann-draft-${index}`} cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="4" />)}
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

        <aside
          className="right-rail"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dockPanel(event, 'right')}
        >
          <div className="right-tabs dock-tabbar">
            {(Object.keys(PANEL_LABELS) as DockPanel[]).filter((panel) => panelDock[panel] === 'right').map((panel) => (
              <button key={panel} draggable onDragStart={(event) => dragPanel(event, panel)} className={activeRightPanel === panel ? 'active' : ''} onClick={() => setActiveRightPanel(panel)}>{PANEL_LABELS[panel]}</button>
            ))}
          </div>
          <div className="right-content dock-content">
            {activeRightPanel === 'measurements' && panelDock.measurements === 'right' && (
              <>
                <div className="panel-title"><b>Measurements</b><span>{measurementRows.length}</span></div>
                <div className="measurement-list">{measurementRows.map(({ measurement, value }) => <button key={measurement.id} className={measurement.id === selectedMeasurementId ? 'measurement-row selected' : 'measurement-row'} onClick={() => { setPage(measurement.page); clearSelections(); setSelectedMeasurementId(measurement.id); }}><span className={`measurement-kind-icon ${measurement.kind}`} /><span><b>{measurement.name}</b><small>Page {measurement.page} · {measurement.points.length} points</small></span><strong>{formatMeasurement(value, measurement.kind)}</strong></button>)}</div>
                {!measurementRows.length && <div className="empty-compact">Distance, polyline, area, and perimeter measurements appear here.</div>}
              </>
            )}
            {activeRightPanel === 'markups' && panelDock.markups === 'right' && <AnnotationPanel markups={markups} snippets={snippets} selectedMarkupId={selectedMarkupId} selectedSnippetId={selectedSnippetId} onSelectMarkup={(id) => { clearSelections(); setSelectedMarkupId(id); }} onSelectSnippet={(id) => { clearSelections(); setSelectedSnippetId(id); }} onChangeMarkups={setMarkups} onChangeSnippets={setSnippets} onGoToPage={setPage} onDeleteSelected={deleteSelected} />}
            {activeRightPanel === 'sync' && panelDock.sync === 'right' && (
              <>
                <div className="panel-title"><b>Sync Review</b><span>{syncRequired ? 'Changes pending' : 'No changes'}</span></div>
                <p className="sync-help">Drawing changes never overwrite Estimate/BOM quantities automatically. Review each difference and apply only the rows you intend to change.</p>
                <div className="sync-table">{syncRows.map((row) => <label className="sync-row" key={row.tool.id}><input type="checkbox" checked={syncSelection[row.tool.id] ?? true} onChange={(event) => setSyncSelection({ ...syncSelection, [row.tool.id]: event.target.checked })}/><span><b>{row.tool.name}</b><small>{row.tool.unit}</small></span><span><small>Takeoff</small><b>{fmt(row.qty)}</b></span><span><small>Estimate</small><b>{fmt(row.current)}</b></span><span className={row.difference === 0 ? 'diff zero' : 'diff'}><small>Difference</small><b>{row.difference > 0 ? '+' : ''}{fmt(row.difference)}</b></span></label>)}</div>
                <button className="button primary wide" disabled={!syncRows.some((row) => (syncSelection[row.tool.id] ?? true) && row.difference !== 0)} onClick={applySelectedSync}>Apply Selected Changes</button>
                <div className="local-preview-note">This desktop demo applies approved changes to a local estimate preview. Browser Quote/BOM writeback remains a later integration step.</div>
              </>
            )}
          </div>
        </aside>

        <section className={bottomCollapsed ? 'bottom-dock collapsed' : 'bottom-dock'} style={{ height: bottomCollapsed ? 38 : bottomHeight }}>
          <div className="bottom-resize-handle" onPointerDown={beginBottomResize} onPointerMove={moveBottomResize} onPointerUp={endBottomResize} onPointerCancel={endBottomResize} onDoubleClick={() => setBottomCollapsed((value) => !value)} />
          <div className="bottom-dock-head" onDoubleClick={() => setBottomCollapsed((value) => !value)}>
            <button onClick={() => setBottomCollapsed((value) => !value)}>{bottomCollapsed ? '▲' : '▼'}</button>
            <b>Takeoff Totals</b>
            <span>{filteredCountRows.length} of {countRows.length} rows · {marks.length} count marks</span>
            <small>Drag the divider to resize. Double-click to collapse / restore.</small>
          </div>
          {!bottomCollapsed && (
            <div className="count-table-wrap">
              <div className="count-grid count-header"><span>Category</span><span>Tool</span><span>Page</span><span>Locations</span><span>Qty</span><span>Unit</span></div>
              <div className="count-grid count-filters">
                <input value={countFilters.category} onChange={(event) => setCountFilters({ ...countFilters, category: event.target.value })} placeholder="Filter…" />
                <input value={countFilters.tool} onChange={(event) => setCountFilters({ ...countFilters, tool: event.target.value })} placeholder="Filter…" />
                <input value={countFilters.page} onChange={(event) => setCountFilters({ ...countFilters, page: event.target.value })} placeholder="Page…" />
                <span />
                <span />
                <input value={countFilters.unit} onChange={(event) => setCountFilters({ ...countFilters, unit: event.target.value })} placeholder="Unit…" />
              </div>
              <div className="count-table-body">
                {filteredCountRows.map((row) => <button key={row.key} className="count-grid count-row" onClick={() => { setPage(row.page); setSelectedToolId(row.tool.id); clearSelections(); changeMode('select'); }}><span>{row.category}</span><span><ShapeMark shape={row.tool.shape} color={row.tool.color} size={12}/><b>{row.tool.name}</b></span><span>{row.page}</span><strong>{row.locations}</strong><strong>{fmt(row.qty)}</strong><span>{row.unit}</span></button>)}
                {!filteredCountRows.length && <div className="empty-compact">No count rows match the active column filters.</div>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
