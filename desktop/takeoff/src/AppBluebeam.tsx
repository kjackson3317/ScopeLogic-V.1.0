import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import DrawingPagesRail from './DrawingPagesRail';
import RecoveryPrompt from './RecoveryPrompt';
import {
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
import { clearTakeoffRecovery, loadTakeoffRecovery, saveTakeoffRecovery } from './persistence';
import type { Mark, Shape, TakeoffRecoverySnapshot, Tool } from './takeoff-model';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Mode = 'select' | 'pan' | 'count' | 'calibrate' | MeasurementKind;
type BottomTab = 'takeoff' | 'measurements' | 'rules' | 'sync';
type DemoTool = Tool & { system?: string; ruleLabel?: string };
type SummaryRow = { tool: DemoTool; page: number; locations: number; qty: number };
type HistoryState = {
  marks: Mark[];
  measurements: Measurement[];
  calibrations: Record<number, PageCalibration>;
};

type DragPoint = { x: number; y: number };
type PanDrag = { active: boolean; pointerId: number; x: number; y: number; startX: number; startY: number };
type MarkDrag = { active: boolean; pointerId: number; id: string };

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 8;
const COLLAPSED_HEIGHT = 36;
const DEFAULT_BOTTOM_HEIGHT = 240;
const PANEL_STORAGE_KEY = 'technology-preconstruction-takeoff.bottom-panel-height';
const PANEL_COLLAPSED_KEY = 'technology-preconstruction-takeoff.bottom-panel-collapsed';
const uid = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
const fileStem = (value: string) => value.replace(/\.pdf$/i, '') || 'Takeoff Project';
const COLORS = ['#2d5f91', '#4b789b', '#238a8d', '#c27616', '#b4473a', '#7257a8', '#31363d', '#26736a'];
const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond'];

const initialTools: DemoTool[] = [
  { id: 'single-data', name: 'Single Data', system: 'Structured Cabling', shape: 'square', color: '#2d5f91', multiplier: 1, unit: 'channel', ruleLabel: 'Single Data Outlet' },
  { id: 'dual-data', name: 'Dual Data', system: 'Structured Cabling', shape: 'square', color: '#238a8d', multiplier: 2, unit: 'channels', ruleLabel: 'Dual Data Outlet' },
  { id: 'camera', name: 'Camera', system: 'CCTV', shape: 'circle', color: '#b4473a', multiplier: 1, unit: 'ea', ruleLabel: 'Camera Drop' },
  { id: 'card-reader', name: 'Card Reader', system: 'Access Control', shape: 'diamond', color: '#7257a8', multiplier: 1, unit: 'ea', ruleLabel: 'Single Reader Door' },
  { id: 'speaker', name: 'Speaker', system: 'Paging / Intercom', shape: 'triangle', color: '#c27616', multiplier: 1, unit: 'ea', ruleLabel: 'Ceiling Speaker' },
];

function ShapeMark({ shape, color, size = 14 }: { shape: Shape; color: string; size?: number }) {
  if (shape === 'circle') return <span className="bb-tool-shape circle" style={{ width: size, height: size, background: color }} />;
  if (shape === 'square') return <span className="bb-tool-shape square" style={{ width: size, height: size, background: color }} />;
  if (shape === 'diamond') return <span className="bb-tool-shape diamond" style={{ width: size, height: size, background: color }} />;
  return <span className="bb-tool-shape triangle" style={{ borderLeftWidth: size / 2, borderRightWidth: size / 2, borderBottomWidth: size, borderBottomColor: color }} />;
}

export default function AppBluebeam() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<PanDrag>({ active: false, pointerId: -1, x: 0, y: 0, startX: 0, startY: 0 });
  const markDragRef = useRef<MarkDrag>({ active: false, pointerId: -1, id: '' });
  const resizingRef = useRef(false);
  const historyRef = useRef<HistoryState[]>([]);
  const fitOnNextRenderRef = useRef(true);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [drawingFingerprint, setDrawingFingerprint] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageBaseSize, setPageBaseSize] = useState<PageSize>({ width: 792, height: 612 });
  const [pageBaseSizes, setPageBaseSizes] = useState<Record<number, PageSize>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState(() => uid());
  const [projectName, setProjectName] = useState('Takeoff Project');
  const [recoveryCandidate, setRecoveryCandidate] = useState<TakeoffRecoverySnapshot | null>(null);
  const [recoveryDecisionMade, setRecoveryDecisionMade] = useState(false);
  const [pendingRecoveredDrawing, setPendingRecoveredDrawing] = useState(false);

  const [mode, setMode] = useState<Mode>('select');
  const [spacePan, setSpacePan] = useState(false);
  const [viewScale, setViewScale] = useState(1);
  const [offset, setOffset] = useState<DragPoint>({ x: 0, y: 0 });
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selectedMarkId, setSelectedMarkId] = useState('');
  const [highlightToolId, setHighlightToolId] = useState('');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState('');
  const [measurementDraft, setMeasurementDraft] = useState<Point[]>([]);
  const [calibrationDraft, setCalibrationDraft] = useState<Point[]>([]);
  const [pageCalibrations, setPageCalibrations] = useState<Record<number, PageCalibration>>({});
  const [calibrationKnownLength, setCalibrationKnownLength] = useState('60');
  const [tools, setTools] = useState<DemoTool[]>(initialTools);
  const [selectedToolId, setSelectedToolId] = useState('dual-data');
  const [showToolForm, setShowToolForm] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', system: 'Structured Cabling', shape: 'square' as Shape, color: COLORS[0], multiplier: 1, unit: 'ea', ruleLabel: '' });

  const [estimateQty, setEstimateQty] = useState<Record<string, number>>({});
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({});
  const [bottomTab, setBottomTab] = useState<BottomTab>('takeoff');
  const [bottomHeight, setBottomHeight] = useState(() => {
    const raw = Number(window.localStorage.getItem(PANEL_STORAGE_KEY));
    return Number.isFinite(raw) && raw >= 120 ? raw : DEFAULT_BOTTOM_HEIGHT;
  });
  const [bottomCollapsed, setBottomCollapsed] = useState(() => window.localStorage.getItem(PANEL_COLLAPSED_KEY) === '1');
  const [activity, setActivity] = useState('Open a PDF drawing set to begin.');

  const isPanMode = mode === 'pan' || spacePan;
  const selectedTool = tools.find((tool) => tool.id === selectedToolId);
  const selectedMark = marks.find((mark) => mark.id === selectedMarkId);
  const selectedMarkTool = selectedMark ? tools.find((tool) => tool.id === selectedMark.toolId) : undefined;
  const pageCalibration = pageCalibrations[page];

  const snapshotHistory = () => {
    historyRef.current = [...historyRef.current.slice(-24), {
      marks: marks.map((item) => ({ ...item })),
      measurements: measurements.map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })) })),
      calibrations: { ...pageCalibrations },
    }];
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setMarks(previous.marks);
    setMeasurements(previous.measurements);
    setPageCalibrations(previous.calibrations);
    setSelectedMarkId('');
    setSelectedMeasurementId('');
    setActivity('Undid the last Takeoff change.');
  };

  const fitPage = () => {
    const area = viewportRef.current;
    if (!area || !pdfDoc || pageBaseSize.width <= 0 || pageBaseSize.height <= 0) return;
    const availableWidth = Math.max(160, area.clientWidth - 56);
    const availableHeight = Math.max(160, area.clientHeight - 56);
    const scale = clamp(Math.min(availableWidth / pageBaseSize.width, availableHeight / pageBaseSize.height), MIN_ZOOM, MAX_ZOOM);
    setViewScale(scale);
    setOffset({
      x: (area.clientWidth - pageBaseSize.width * scale) / 2,
      y: (area.clientHeight - pageBaseSize.height * scale) / 2,
    });
  };

  const fitWidth = () => {
    const area = viewportRef.current;
    if (!area || !pdfDoc || pageBaseSize.width <= 0) return;
    const scale = clamp((area.clientWidth - 56) / pageBaseSize.width, MIN_ZOOM, MAX_ZOOM);
    setViewScale(scale);
    setOffset({ x: 28, y: 28 });
  };

  useEffect(() => {
    const recovered = loadTakeoffRecovery();
    if (recovered) setRecoveryCandidate(recovered);
    else setRecoveryDecisionMade(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (event.code === 'Space' && !editing) { event.preventDefault(); setSpacePan(true); }
      if (event.key === 'Delete' && !editing && selectedMarkId) {
        event.preventDefault();
        snapshotHistory();
        setMarks((items) => items.filter((item) => item.id !== selectedMarkId));
        setSelectedMarkId('');
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editing) {
        event.preventDefault();
        undo();
      }
      if (event.key === 'Escape') {
        setMeasurementDraft([]);
        setCalibrationDraft([]);
        setSelectedMarkId('');
        setSelectedMeasurementId('');
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === 'Space') setSpacePan(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [selectedMarkId, marks, measurements, pageCalibrations]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_STORAGE_KEY, String(bottomHeight));
  }, [bottomHeight]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_COLLAPSED_KEY, bottomCollapsed ? '1' : '0');
    requestAnimationFrame(() => {
      if (pdfDoc) fitPage();
    });
  }, [bottomCollapsed]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | undefined;
    if (!pdfDoc || !canvasRef.current) return;
    setLoading(true);
    setError('');
    (async () => {
      const pdfPage = await pdfDoc.getPage(page);
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const qualityScale = Math.min(3, Math.max(1.25, viewScale * dpr));
      const renderViewport = pdfPage.getViewport({ scale: qualityScale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);
      canvas.style.width = `${baseViewport.width}px`;
      canvas.style.height = `${baseViewport.height}px`;
      const size = { width: baseViewport.width, height: baseViewport.height };
      setPageBaseSize(size);
      setPageBaseSizes((current) => ({ ...current, [page]: size }));
      renderTask = pdfPage.render({ canvasContext: context, viewport: renderViewport });
      await renderTask.promise;
      if (!cancelled && fitOnNextRenderRef.current) {
        fitOnNextRenderRef.current = false;
        requestAnimationFrame(fitPage);
      }
    })().catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'The drawing page could not be rendered.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdfDoc, page, viewScale]);

  useEffect(() => {
    if (!recoveryDecisionMade || !fileName) return;
    const timeout = window.setTimeout(() => {
      saveTakeoffRecovery({
        id: projectId,
        name: projectName,
        drawing: { fileName, pageCount, fingerprint: drawingFingerprint || undefined },
        view: { page, zoom: viewScale },
        tools,
        marks,
        measurements,
        calibrations: pageCalibrations,
        markups: [],
        snippets: [],
        estimatePreview: estimateQty,
        syncSelection,
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [recoveryDecisionMade, projectId, projectName, fileName, pageCount, drawingFingerprint, page, viewScale, tools, marks, measurements, pageCalibrations, estimateQty, syncSelection]);

  useEffect(() => {
    setMeasurementDraft([]);
    setCalibrationDraft([]);
    setSelectedMarkId('');
    setSelectedMeasurementId('');
    setHighlightToolId('');
    fitOnNextRenderRef.current = true;
  }, [page]);

  const markCountByPage = useMemo(() => marks.reduce<Record<number, number>>((counts, mark) => {
    counts[mark.page] = (counts[mark.page] || 0) + 1;
    return counts;
  }, {}), [marks]);

  const measurementCountByPage = useMemo(() => measurements.reduce<Record<number, number>>((counts, measurement) => {
    counts[measurement.page] = (counts[measurement.page] || 0) + 1;
    return counts;
  }, {}), [measurements]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const map = new Map<string, SummaryRow>();
    for (const mark of marks) {
      const tool = tools.find((item) => item.id === mark.toolId);
      if (!tool) continue;
      const key = `${mark.page}:${tool.id}`;
      const row = map.get(key) || { tool, page: mark.page, locations: 0, qty: 0 };
      row.locations += 1;
      row.qty += Number(tool.multiplier) || 0;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => a.page - b.page || a.tool.name.localeCompare(b.tool.name));
  }, [marks, tools]);

  const toolTotals = useMemo(() => {
    const map = new Map<string, { tool: DemoTool; locations: number; qty: number }>();
    for (const row of summaryRows) {
      const current = map.get(row.tool.id) || { tool: row.tool, locations: 0, qty: 0 };
      current.locations += row.locations;
      current.qty += row.qty;
      map.set(row.tool.id, current);
    }
    return [...map.values()].sort((a, b) => a.tool.name.localeCompare(b.tool.name));
  }, [summaryRows]);

  const syncRows = useMemo(() => toolTotals.map((row) => ({
    ...row,
    current: estimateQty[row.tool.id] || 0,
    difference: row.qty - (estimateQty[row.tool.id] || 0),
  })), [toolTotals, estimateQty]);

  useEffect(() => {
    setSyncSelection((current) => {
      const next = { ...current };
      for (const row of toolTotals) if (!(row.tool.id in next)) next[row.tool.id] = true;
      return next;
    });
  }, [toolTotals]);

  const measurementRows = useMemo(() => measurements.map((measurement) => ({
    measurement,
    value: measurementValue(measurement, pageCalibrations[measurement.page], pageBaseSizes[measurement.page]),
  })), [measurements, pageCalibrations, pageBaseSizes]);

  const syncRequired = syncRows.some((row) => row.difference !== 0);

  const restoreRecovery = () => {
    if (!recoveryCandidate) return;
    const recovered = recoveryCandidate;
    setProjectId(recovered.id);
    setProjectName(recovered.name || fileStem(recovered.drawing.fileName));
    setFileName(recovered.drawing.fileName);
    setDrawingFingerprint(recovered.drawing.fingerprint || '');
    setPageCount(recovered.drawing.pageCount || 0);
    setPage(Math.max(1, recovered.view.page || 1));
    setViewScale(clamp(recovered.view.zoom || 1, MIN_ZOOM, MAX_ZOOM));
    setTools(recovered.tools.length ? recovered.tools as DemoTool[] : initialTools);
    setMarks(recovered.marks || []);
    setMeasurements(recovered.measurements || []);
    setPageCalibrations(recovered.calibrations || {});
    setEstimateQty(recovered.estimatePreview || {});
    setSyncSelection(recovered.syncSelection || {});
    setPendingRecoveredDrawing(true);
    setRecoveryCandidate(null);
    setRecoveryDecisionMade(true);
    setActivity(`Recovered ${recovered.name || 'Takeoff Project'}. Reopen ${recovered.drawing.fileName} to reconnect the drawing.`);
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
      const recoveredMatches = pendingRecoveredDrawing && file.name === fileName && (!drawingFingerprint || !fingerprint || drawingFingerprint === fingerprint);
      setPdfDoc(doc);
      setFileName(file.name);
      setDrawingFingerprint(fingerprint);
      setPageCount(doc.numPages);
      setPageBaseSizes({});
      fitOnNextRenderRef.current = true;
      if (recoveredMatches) {
        setPage((value) => clamp(value, 1, doc.numPages));
        setPendingRecoveredDrawing(false);
        setActivity(`${file.name} reopened. Recovered marks, measurements, scale, and Sync Review state are retained.`);
      } else {
        setProjectId(uid());
        setProjectName(fileStem(file.name));
        setPage(1);
        setMarks([]);
        setMeasurements([]);
        setPageCalibrations({});
        setEstimateQty({});
        setSyncSelection({});
        setSelectedMarkId('');
        setPendingRecoveredDrawing(false);
        setMode('select');
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

  const normalizedPoint = (clientX: number, clientY: number): Point | null => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const zoomAt = (nextScale: number, clientX?: number, clientY?: number) => {
    const area = viewportRef.current;
    if (!area) return;
    const next = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(next - viewScale) < 0.0005) return;
    const rect = area.getBoundingClientRect();
    const anchorX = clientX == null ? area.clientWidth / 2 : clientX - rect.left;
    const anchorY = clientY == null ? area.clientHeight / 2 : clientY - rect.top;
    const worldX = (anchorX - offset.x) / viewScale;
    const worldY = (anchorY - offset.y) / viewScale;
    setOffset({ x: anchorX - worldX * next, y: anchorY - worldY * next });
    setViewScale(next);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!pdfDoc) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0016);
    zoomAt(viewScale * factor, event.clientX, event.clientY);
  };

  const viewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((!isPanMode && event.button !== 1) || !pdfDoc) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panDragRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: offset.x, startY: offset.y };
  };

  const viewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panDragRef.current;
    if (pan.active && pan.pointerId === event.pointerId) {
      setOffset({ x: pan.startX + event.clientX - pan.x, y: pan.startY + event.clientY - pan.y });
      return;
    }
    const markDrag = markDragRef.current;
    if (markDrag.active && markDrag.pointerId === event.pointerId) {
      const point = normalizedPoint(event.clientX, event.clientY);
      if (!point) return;
      setMarks((items) => items.map((item) => item.id === markDrag.id ? { ...item, x: point.x, y: point.y } : item));
    }
  };

  const viewportPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panDragRef.current.pointerId === event.pointerId) panDragRef.current.active = false;
    if (markDragRef.current.pointerId === event.pointerId) markDragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const clickOverlay = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!pdfDoc || isPanMode) return;
    if ((event.target as Element).closest?.('.bb-drawing-mark, .bb-measurement')) return;
    const point = normalizedPoint(event.clientX, event.clientY);
    if (!point) return;
    if (mode === 'select') {
      setSelectedMarkId('');
      setSelectedMeasurementId('');
      return;
    }
    if (mode === 'count') {
      if (!selectedTool) return;
      snapshotHistory();
      const mark: Mark = { id: uid(), page, toolId: selectedTool.id, x: point.x, y: point.y };
      setMarks((items) => [...items, mark]);
      setSelectedMarkId(mark.id);
      setHighlightToolId('');
      setActivity(`${selectedTool.name} added on page ${page}.`);
      return;
    }
    if (mode === 'calibrate') {
      const next = calibrationDraft.length >= 2 ? [point] : [...calibrationDraft, point];
      setCalibrationDraft(next);
      setActivity(next.length === 1 ? 'Calibration start point set. Pick the second point.' : 'Calibration line set. Enter the known distance and click Set Scale.');
      return;
    }
    if (mode === 'distance') {
      if (!pageCalibration) return setActivity('Calibrate the page before measuring.');
      if (!measurementDraft.length) setMeasurementDraft([point]);
      else createMeasurement('distance', [measurementDraft[0], point]);
      return;
    }
    if (['polyline', 'area', 'perimeter'].includes(mode)) {
      if (!pageCalibration) return setActivity('Calibrate the page before measuring.');
      setMeasurementDraft((items) => [...items, point]);
    }
  };

  const createMeasurement = (kind: MeasurementKind, points: Point[]) => {
    if (!pageCalibration) return;
    snapshotHistory();
    const ordinal = measurements.filter((item) => item.kind === kind).length + 1;
    const measurement: Measurement = { id: uid(), page, kind, name: `${measurementKindLabel(kind)} ${ordinal}`, points };
    setMeasurements((items) => [...items, measurement]);
    setSelectedMeasurementId(measurement.id);
    setMeasurementDraft([]);
    setActivity(`${measurement.name} saved.`);
  };

  const finishMeasurement = () => {
    if (!['polyline', 'area', 'perimeter'].includes(mode)) return;
    const kind = mode as MeasurementKind;
    const minimum = kind === 'polyline' ? 2 : 3;
    if (measurementDraft.length < minimum) return setActivity(`${measurementKindLabel(kind)} requires at least ${minimum} points.`);
    createMeasurement(kind, measurementDraft);
  };

  const setScale = () => {
    if (calibrationDraft.length !== 2 || !pageBaseSize) return;
    const knownFeet = Number(calibrationKnownLength);
    if (!Number.isFinite(knownFeet) || knownFeet <= 0) return;
    const pdfDistance = pointDistance(calibrationDraft[0], calibrationDraft[1], pageBaseSize);
    if (pdfDistance <= 0) return;
    snapshotHistory();
    setPageCalibrations((current) => ({ ...current, [page]: { feetPerPdfPoint: knownFeet / pdfDistance, label: `Manual · ${fmt(knownFeet)} ft`, source: 'manual' } }));
    setCalibrationDraft([]);
    setMode('select');
    setActivity(`Page ${page} calibrated to ${fmt(knownFeet)} ft.`);
  };

  const markPointerDown = (event: ReactPointerEvent<SVGElement>, mark: Mark) => {
    event.stopPropagation();
    setSelectedMarkId(mark.id);
    setSelectedMeasurementId('');
    setHighlightToolId('');
    if (mode !== 'select') return;
    snapshotHistory();
    markDragRef.current = { active: true, pointerId: event.pointerId, id: mark.id };
    viewportRef.current?.setPointerCapture?.(event.pointerId);
  };

  const addTool = () => {
    if (!newTool.name.trim()) return;
    const tool: DemoTool = {
      id: uid(),
      name: newTool.name.trim(),
      system: newTool.system.trim() || 'Other',
      shape: newTool.shape,
      color: newTool.color,
      multiplier: Math.max(0.01, Number(newTool.multiplier) || 1),
      unit: newTool.unit.trim() || 'ea',
      ruleLabel: newTool.ruleLabel.trim() || undefined,
    };
    setTools((items) => [...items, tool]);
    setSelectedToolId(tool.id);
    setShowToolForm(false);
    setNewTool({ name: '', system: 'Structured Cabling', shape: 'square', color: COLORS[0], multiplier: 1, unit: 'ea', ruleLabel: '' });
    setMode('count');
  };

  const deleteSelected = () => {
    if (selectedMarkId) {
      snapshotHistory();
      setMarks((items) => items.filter((item) => item.id !== selectedMarkId));
      setSelectedMarkId('');
      return;
    }
    if (selectedMeasurementId) {
      snapshotHistory();
      setMeasurements((items) => items.filter((item) => item.id !== selectedMeasurementId));
      setSelectedMeasurementId('');
    }
  };

  const applySelectedSync = () => {
    setEstimateQty((current) => {
      const next = { ...current };
      for (const row of syncRows) if (syncSelection[row.tool.id] ?? true) next[row.tool.id] = row.qty;
      return next;
    });
    setActivity('Selected Takeoff quantities applied to the local estimate preview.');
  };

  const beginResizeBottom = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveResizeBottom = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current || !workspaceRef.current) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const next = clamp(rect.bottom - event.clientY, 120, Math.max(160, rect.height * 0.62));
    setBottomHeight(next);
    setBottomCollapsed(false);
  };

  const endResizeBottom = (event: ReactPointerEvent<HTMLDivElement>) => {
    resizingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const pageMarks = marks.filter((mark) => mark.page === page);
  const pageMeasurements = measurementRows.filter((row) => row.measurement.page === page);
  const bottomSize = bottomCollapsed ? COLLAPSED_HEIGHT : bottomHeight;

  return (
    <div className="bb-shell">
      {recoveryCandidate && <RecoveryPrompt snapshot={recoveryCandidate} onRestore={restoreRecovery} onStartFresh={startFresh} />}

      <header className="bb-titlebar">
        <div className="bb-brand"><span className="bb-brand-mark">T</span><div><strong>Technology Preconstruction</strong><small>Drawing Takeoff</small></div></div>
        <div className="bb-document-title"><span>DRAWING SET</span><b>{fileName || 'No PDF open'}</b></div>
        <div className="bb-sync-state"><span className={syncRequired ? 'warning' : 'ok'} /><div><b>{syncRequired ? 'Sync Review Needed' : 'Takeoff In Sync'}</b><small>Estimate changes require approval</small></div></div>
      </header>

      <div className="bb-toolbar">
        <label className="bb-button primary file-button">Open PDF<input type="file" accept="application/pdf,.pdf" onChange={openPdf} /></label>
        <span className="bb-separator" />
        {(['select', 'pan', 'count', 'calibrate', 'distance', 'polyline', 'area', 'perimeter'] as Mode[]).map((item) => (
          <button key={item} className={mode === item ? 'bb-button active' : 'bb-button'} disabled={!pdfDoc && item !== 'select' && item !== 'pan' && item !== 'count'} onClick={() => { setMode(item); setMeasurementDraft([]); setCalibrationDraft([]); }}>
            {item === 'select' ? 'Select' : item === 'pan' ? 'Pan' : item === 'count' ? 'Count' : item === 'calibrate' ? 'Calibrate' : measurementKindLabel(item as MeasurementKind)}
          </button>
        ))}
        {['polyline', 'area', 'perimeter'].includes(mode) && measurementDraft.length > 0 && <button className="bb-button primary" onClick={finishMeasurement}>Finish</button>}
        {mode === 'calibrate' && <><span className="bb-separator" /><label className="bb-inline-field">Known ft<input type="number" min="0.01" value={calibrationKnownLength} onChange={(event) => setCalibrationKnownLength(event.target.value)} /></label><button className="bb-button primary" disabled={calibrationDraft.length !== 2} onClick={setScale}>Set Scale</button></>}
        <span className="bb-separator" />
        <button className="bb-button" disabled={!pdfDoc} onClick={() => zoomAt(viewScale / 1.2)}>−</button>
        <span className="bb-zoom">{Math.round(viewScale * 100)}%</span>
        <button className="bb-button" disabled={!pdfDoc} onClick={() => zoomAt(viewScale * 1.2)}>+</button>
        <button className="bb-button" disabled={!pdfDoc} onClick={fitPage}>Fit Page</button>
        <button className="bb-button" disabled={!pdfDoc} onClick={fitWidth}>Fit Width</button>
        <button className="bb-button" disabled={!pdfDoc} onClick={() => { setViewScale(1); setOffset({ x: 28, y: 28 }); }}>100%</button>
        <span className="bb-separator" />
        <button className="bb-button" disabled={!historyRef.current.length} onClick={undo}>Undo</button>
        <button className="bb-button danger" disabled={!selectedMarkId && !selectedMeasurementId} onClick={deleteSelected}>Delete</button>
        <span className="bb-toolbar-spacer" />
        <span className={pageCalibration ? 'bb-scale scaled' : 'bb-scale'}>{pageCalibration?.label || 'UNSCALED'}</span>
      </div>

      <div ref={workspaceRef} className="bb-workspace" style={{ gridTemplateRows: `minmax(0, 1fr) ${bottomSize}px` }}>
        <aside className="bb-left-dock">
          <DrawingPagesRail pdfDoc={pdfDoc} pageCount={pageCount} activePage={page} onSelectPage={setPage} markCountByPage={markCountByPage} measurementCountByPage={measurementCountByPage} pageCalibrations={pageCalibrations} />
          <section className="bb-tool-chest">
            <div className="bb-dock-heading"><b>Tool Chest</b><button onClick={() => setShowToolForm((value) => !value)}>+ Tool</button></div>
            {showToolForm && <div className="bb-tool-form">
              <label>Name<input value={newTool.name} onChange={(event) => setNewTool({ ...newTool, name: event.target.value })} /></label>
              <label>System<input value={newTool.system} onChange={(event) => setNewTool({ ...newTool, system: event.target.value })} /></label>
              <div className="bb-form-row"><label>Shape<select value={newTool.shape} onChange={(event) => setNewTool({ ...newTool, shape: event.target.value as Shape })}>{SHAPES.map((shape) => <option key={shape}>{shape}</option>)}</select></label><label>Multiplier<input type="number" min="0.01" step="0.01" value={newTool.multiplier} onChange={(event) => setNewTool({ ...newTool, multiplier: Number(event.target.value) })} /></label></div>
              <div className="bb-form-row"><label>Unit<input value={newTool.unit} onChange={(event) => setNewTool({ ...newTool, unit: event.target.value })} /></label><label>Rule Link<input value={newTool.ruleLabel} onChange={(event) => setNewTool({ ...newTool, ruleLabel: event.target.value })} /></label></div>
              <div className="bb-color-row">{COLORS.map((color) => <button key={color} className={newTool.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => setNewTool({ ...newTool, color })} aria-label={`Use ${color}`} />)}</div>
              <div className="bb-form-actions"><button className="bb-button" onClick={() => setShowToolForm(false)}>Cancel</button><button className="bb-button primary" disabled={!newTool.name.trim()} onClick={addTool}>Create</button></div>
            </div>}
            <div className="bb-tool-list">{tools.map((tool) => <button key={tool.id} className={selectedToolId === tool.id ? 'bb-tool-row selected' : 'bb-tool-row'} onClick={() => { setSelectedToolId(tool.id); setMode('count'); }}><ShapeMark shape={tool.shape} color={tool.color} /><span><b>{tool.name}</b><small>{tool.system || 'Other'} · ×{fmt(tool.multiplier)} {tool.unit}</small></span></button>)}</div>
          </section>
        </aside>

        <main className="bb-canvas-column">
          <div
            ref={viewportRef}
            className={`bb-viewport ${isPanMode ? 'pan-mode' : mode === 'count' ? 'count-mode' : ''}`}
            onWheel={onWheel}
            onPointerDown={viewportPointerDown}
            onPointerMove={viewportPointerMove}
            onPointerUp={viewportPointerUp}
            onPointerCancel={viewportPointerUp}
          >
            {loading && <div className="bb-drawing-message">Loading drawing…</div>}
            {error && <div className="bb-drawing-message error"><b>PDF could not be opened.</b><span>{error}</span></div>}
            {!pdfDoc && !loading && !error && <div className="bb-drawing-message"><b>{pendingRecoveredDrawing ? 'Reopen the recovered PDF drawing set' : 'Open a PDF drawing set'}</b><span>{pendingRecoveredDrawing ? `Reopen ${fileName} to reconnect the preserved takeoff.` : 'Use Open PDF to start a local drawing takeoff.'}</span></div>}
            {pdfDoc && <div className="bb-stage" style={{ width: pageBaseSize.width, height: pageBaseSize.height, transform: `translate(${offset.x}px, ${offset.y}px) scale(${viewScale})` }}>
              <canvas ref={canvasRef} />
              <svg ref={overlayRef} width={pageBaseSize.width} height={pageBaseSize.height} viewBox={`0 0 ${pageBaseSize.width} ${pageBaseSize.height}`} onClick={clickOverlay}>
                {pageMeasurements.map(({ measurement, value }) => {
                  const points = measurement.points.map((point) => `${point.x * pageBaseSize.width},${point.y * pageBaseSize.height}`).join(' ');
                  const selected = selectedMeasurementId === measurement.id;
                  const cx = measurement.points.reduce((sum, point) => sum + point.x, 0) / measurement.points.length * pageBaseSize.width;
                  const cy = measurement.points.reduce((sum, point) => sum + point.y, 0) / measurement.points.length * pageBaseSize.height;
                  return <g key={measurement.id} className={selected ? 'bb-measurement selected' : 'bb-measurement'} onClick={(event) => { event.stopPropagation(); setSelectedMeasurementId(measurement.id); setSelectedMarkId(''); }}>
                    {measurement.kind === 'area' || measurement.kind === 'perimeter' ? <polygon points={points} /> : <polyline points={points} />}
                    <g className="bb-measurement-label" transform={`translate(${cx} ${cy})`}><rect x="-38" y="-10" width="76" height="20" rx="3" /><text textAnchor="middle" dominantBaseline="central">{formatMeasurement(value, measurement.kind)}</text></g>
                  </g>;
                })}
                {pageMarks.map((mark) => {
                  const tool = tools.find((item) => item.id === mark.toolId);
                  if (!tool) return null;
                  const x = mark.x * pageBaseSize.width;
                  const y = mark.y * pageBaseSize.height;
                  const selected = selectedMarkId === mark.id;
                  const highlighted = highlightToolId === mark.toolId;
                  const common = { className: `bb-drawing-mark${selected ? ' selected' : ''}${highlighted ? ' highlighted' : ''}`, onPointerDown: (event: ReactPointerEvent<SVGElement>) => markPointerDown(event, mark) };
                  if (tool.shape === 'circle') return <circle key={mark.id} {...common} cx={x} cy={y} r="8" fill={tool.color} />;
                  if (tool.shape === 'square') return <rect key={mark.id} {...common} x={x - 8} y={y - 8} width="16" height="16" fill={tool.color} />;
                  if (tool.shape === 'diamond') return <rect key={mark.id} {...common} x={x - 7} y={y - 7} width="14" height="14" fill={tool.color} transform={`rotate(45 ${x} ${y})`} />;
                  return <polygon key={mark.id} {...common} points={`${x},${y - 9} ${x - 9},${y + 8} ${x + 9},${y + 8}`} fill={tool.color} />;
                })}
                {measurementDraft.length > 0 && <g className="bb-draft"><polyline points={measurementDraft.map((point) => `${point.x * pageBaseSize.width},${point.y * pageBaseSize.height}`).join(' ')} />{measurementDraft.map((point, index) => <circle key={index} cx={point.x * pageBaseSize.width} cy={point.y * pageBaseSize.height} r="4" />)}</g>}
                {calibrationDraft.length > 0 && <g className="bb-calibration-draft">{calibrationDraft.length === 2 && <line x1={calibrationDraft[0].x * pageBaseSize.width} y1={calibrationDraft[0].y * pageBaseSize.height} x2={calibrationDraft[1].x * pageBaseSize.width} y2={calibrationDraft[1].y * pageBaseSize.height} />}{calibrationDraft.map((point, index) => <circle key={index} cx={point.x * pageBaseSize.width} cy={point.y * pageBaseSize.height} r="5" />)}</g>}
              </svg>
            </div>}
          </div>
          <div className="bb-statusbar"><span>{activity}</span><b>{mode.toUpperCase()}{spacePan ? ' · TEMP PAN' : ''}</b></div>
        </main>

        <aside className="bb-right-dock">
          <div className="bb-dock-heading"><b>Properties</b><span>{selectedMark ? 'MARK' : selectedMeasurementId ? 'MEASUREMENT' : 'NONE'}</span></div>
          {selectedMark && selectedMarkTool ? <div className="bb-properties">
            <label>Tool<select value={selectedMark.toolId} onChange={(event) => setMarks((items) => items.map((item) => item.id === selectedMark.id ? { ...item, toolId: event.target.value } : item))}>{tools.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select></label>
            <div className="bb-property-pair"><span>System</span><b>{selectedMarkTool.system || 'Other'}</b></div>
            <div className="bb-property-pair"><span>Sheet</span><b>Page {selectedMark.page}</b></div>
            <div className="bb-property-pair"><span>Multiplier</span><b>×{fmt(selectedMarkTool.multiplier)}</b></div>
            <div className="bb-property-pair"><span>Result unit</span><b>{selectedMarkTool.unit}</b></div>
            <div className="bb-property-pair"><span>Rule link</span><b>{selectedMarkTool.ruleLabel || 'Not linked'}</b></div>
            <button className="bb-button danger wide" onClick={deleteSelected}>Delete Selected Mark</button>
          </div> : selectedMeasurementId ? <div className="bb-properties"><p>Select the measurement in the bottom Measurements tab for value and source details.</p><button className="bb-button danger wide" onClick={deleteSelected}>Delete Measurement</button></div> : <div className="bb-empty-properties"><b>Select a mark</b><p>Use Select mode to move, reassign, or delete a count mark.</p></div>}
        </aside>

        <section className={`bb-bottom-dock ${bottomCollapsed ? 'collapsed' : ''}`}>
          <div
            className="bb-resize-handle"
            title="Drag to resize · double-click to collapse/restore"
            onPointerDown={beginResizeBottom}
            onPointerMove={moveResizeBottom}
            onPointerUp={endResizeBottom}
            onPointerCancel={endResizeBottom}
            onDoubleClick={() => setBottomCollapsed((value) => !value)}
          />
          <div className="bb-bottom-header">
            <button className="bb-collapse" onClick={() => setBottomCollapsed((value) => !value)} aria-label={bottomCollapsed ? 'Expand Takeoff Totals' : 'Collapse Takeoff Totals'}>{bottomCollapsed ? '▶' : '▼'}</button>
            <b>TAKEOFF TOTALS</b>
            <span>{marks.length} marks · {measurements.length} measurements</span>
            {!bottomCollapsed && <div className="bb-bottom-tabs">{([['takeoff', 'Takeoff Totals'], ['measurements', 'Measurements'], ['rules', 'Rule Links'], ['sync', 'Sync Review']] as [BottomTab, string][]).map(([id, label]) => <button key={id} className={bottomTab === id ? 'active' : ''} onClick={() => setBottomTab(id)}>{label}</button>)}</div>}
          </div>
          {!bottomCollapsed && <div className="bb-bottom-content">
            {bottomTab === 'takeoff' && <table className="bb-data-table"><thead><tr><th>Symbol</th><th>Tool</th><th>System</th><th>Sheet</th><th>Locations</th><th>Qty</th><th>Unit</th><th>Rule Link</th></tr></thead><tbody>{summaryRows.map((row) => <tr key={`${row.page}-${row.tool.id}`} className={highlightToolId === row.tool.id && page === row.page ? 'selected' : ''} onClick={() => { setPage(row.page); setHighlightToolId(row.tool.id); setSelectedMarkId(''); }}><td><ShapeMark shape={row.tool.shape} color={row.tool.color} /></td><td><b>{row.tool.name}</b></td><td>{row.tool.system || 'Other'}</td><td>Page {row.page}</td><td>{row.locations}</td><td><b>{fmt(row.qty)}</b></td><td>{row.tool.unit}</td><td>{row.tool.ruleLabel || '—'}</td></tr>)}</tbody></table>}
            {bottomTab === 'measurements' && <table className="bb-data-table"><thead><tr><th>Type</th><th>Name</th><th>Sheet</th><th>Value</th><th>Scale</th></tr></thead><tbody>{measurementRows.map(({ measurement, value }) => <tr key={measurement.id} className={selectedMeasurementId === measurement.id ? 'selected' : ''} onClick={() => { setPage(measurement.page); setSelectedMeasurementId(measurement.id); setSelectedMarkId(''); }}><td>{measurementKindLabel(measurement.kind)}</td><td>{measurement.name}</td><td>Page {measurement.page}</td><td><b>{formatMeasurement(value, measurement.kind)}</b></td><td>{pageCalibrations[measurement.page]?.label || 'Unscaled'}</td></tr>)}</tbody></table>}
            {bottomTab === 'rules' && <table className="bb-data-table"><thead><tr><th>Tool</th><th>System</th><th>Multiplier</th><th>Result Unit</th><th>Linked Take Off Rule</th></tr></thead><tbody>{tools.map((tool) => <tr key={tool.id}><td><b>{tool.name}</b></td><td>{tool.system || 'Other'}</td><td>×{fmt(tool.multiplier)}</td><td>{tool.unit}</td><td>{tool.ruleLabel || 'Not linked'}</td></tr>)}</tbody></table>}
            {bottomTab === 'sync' && <div className="bb-sync-panel"><p>Drawing changes never silently overwrite the estimate. Review each difference and apply only the intended rows.</p><table className="bb-data-table"><thead><tr><th>Apply</th><th>Tool</th><th>Takeoff Qty</th><th>Estimate Qty</th><th>Difference</th></tr></thead><tbody>{syncRows.map((row) => <tr key={row.tool.id}><td><input type="checkbox" checked={syncSelection[row.tool.id] ?? true} onChange={(event) => setSyncSelection({ ...syncSelection, [row.tool.id]: event.target.checked })} /></td><td><b>{row.tool.name}</b></td><td>{fmt(row.qty)}</td><td>{fmt(row.current)}</td><td className={row.difference === 0 ? 'zero' : 'diff'}>{row.difference > 0 ? '+' : ''}{fmt(row.difference)}</td></tr>)}</tbody></table><button className="bb-button primary" disabled={!syncRows.some((row) => (syncSelection[row.tool.id] ?? true) && row.difference !== 0)} onClick={applySelectedSync}>Apply Selected Changes</button></div>}
          </div>}
        </section>
      </div>
    </div>
  );
}
