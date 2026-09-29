import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import DrawingPagesRail from './DrawingPagesRail';
import AnnotationLayer from './AnnotationLayer';
import AnnotationPanel from './AnnotationPanel';
import CountPropertiesPanel from './CountPropertiesPanel';
import MarkupsListDock from './MarkupsListDock';
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
import { TAKEOFF_SYMBOLS, TakeoffSymbol } from './symbol-registry';
import type {
  DrawingMarkup,
  DrawingSnippet,
  Mark,
  MarkupKind,
  TakeoffRecoverySnapshot,
  Tool,
} from './takeoff-model';
import { legacyShapeToSymbolId, summarizeRawCounts } from './tool-normalization';
import './measurements.css';
import './annotations.css';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Mode = 'select' | 'pan' | 'count' | 'calibrate' | 'snippet' | MeasurementKind | MarkupKind;
type RightTab = 'properties' | 'annotations' | 'sync';
type SummaryRow = { tool: Tool; count: number };

const COLORS = ['#4B6623', '#31513b', '#2563eb', '#b45309', '#b91c1c', '#6d28d9', '#111827', '#0e7490'];
const SYSTEMS = ['Fire Alarm', 'Structured Cabling', 'Access Control', 'Video Surveillance', 'Intrusion', 'Intercom', 'AV', 'AoR', 'ERRC', 'PA/Sound', 'Other'];
const MULTI_POINT_MODES: MeasurementKind[] = ['polyline', 'area', 'perimeter'];
const MEASUREMENT_MODES: MeasurementKind[] = ['distance', 'polyline', 'area', 'perimeter'];
const MARKUP_MODES: MarkupKind[] = ['text', 'line', 'arrow', 'rectangle', 'cloud', 'highlight', 'freehand'];
const TWO_POINT_MARKUPS: MarkupKind[] = ['line', 'arrow', 'rectangle', 'cloud', 'highlight'];
const uid = () => crypto.randomUUID();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
const pointString = (points: Point[], size: PageSize) => points.map((point) => `${point.x * size.width},${point.y * size.height}`).join(' ');
const fileStem = (value: string) => value.replace(/\.pdf$/i, '') || 'Takeoff Project';
const toolSymbolId = (tool: Tool) => tool.symbolId || legacyShapeToSymbolId(tool.shape);

export default function AppNext() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const pointerDrawingRef = useRef(false);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [drawingFingerprint, setDrawingFingerprint] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageLabels, setPageLabels] = useState<Record<number, string>>({});
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
    {
      id: 'default-count',
      name: 'Count Item',
      symbolId: 'builtin.generic.circle',
      shape: 'circle',
      color: '#4B6623',
      system: 'Other',
      opacity: 1,
      size: 22,
      showCaption: false,
      multiplier: 1,
      unit: 'each',
    },
  ]);
  const [selectedToolId, setSelectedToolId] = useState('default-count');
  const [showToolForm, setShowToolForm] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', system: 'Other', symbolId: 'builtin.generic.circle', color: '#4B6623' });

  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);
  const [snippets, setSnippets] = useState<DrawingSnippet[]>([]);
  const [selectedMarkupId, setSelectedMarkupId] = useState('');
  const [selectedSnippetId, setSelectedSnippetId] = useState('');
  const [annotationDraft, setAnnotationDraft] = useState<Point[]>([]);
  const [annotationColor, setAnnotationColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [annotationText, setAnnotationText] = useState('');

  const [rightTab, setRightTab] = useState<RightTab>('properties');
  const [estimateQty, setEstimateQty] = useState<Record<string, number>>({});
  const [syncSelection, setSyncSelection] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState('Open a PDF drawing set to begin.');

  useEffect(() => {
    const recovered = loadTakeoffRecovery();
    if (recovered) setRecoveryCandidate(recovered);
    else setRecoveryDecisionMade(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!pdfDoc) {
      setPageLabels({});
      return;
    }
    const loadLabels = async () => {
      try {
        const labels = await pdfDoc.getPageLabels?.();
        if (cancelled || !Array.isArray(labels)) return;
        const next: Record<number, string> = {};
        labels.forEach((label: unknown, index: number) => {
          const value = String(label ?? '').trim();
          if (value) next[index + 1] = value;
        });
        setPageLabels(next);
      } catch {
        if (!cancelled) setPageLabels({});
      }
    };
    void loadLabels();
    return () => { cancelled = true; };
  }, [pdfDoc]);

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

  const summary = useMemo<SummaryRow[]>(() => summarizeRawCounts(marks, tools), [marks, tools]);

  const syncRows = useMemo(() => summary.map((row) => {
    const current = estimateQty[row.tool.id] || 0;
    return { ...row, current, difference: row.count - current };
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

  const toolGroups = useMemo(() => {
    const systems = [...SYSTEMS];
    for (const tool of tools) {
      const system = tool.system || 'Other';
      if (!systems.includes(system)) systems.push(system);
    }
    return systems
      .map((system) => ({ system, tools: tools.filter((tool) => (tool.system || 'Other') === system) }))
      .filter((group) => group.tools.length > 0);
  }, [tools]);

  const syncRequired = syncRows.some((row) => row.difference !== 0);
  const pageCalibration = pageCalibrations[page];
  const pageBaseSize = pageBaseSizes[page];
  const canMeasurePage = Boolean(pdfDoc && pageCalibration && pageBaseSize);
  const selectedMark = marks.find((mark) => mark.id === selectedMarkId) || null;
  const selectedMarkTool = selectedMark ? tools.find((tool) => tool.id === selectedMark.toolId) || null : null;
  const selectedTool = tools.find((item) => item.id === selectedToolId);
  const selectedMarkPageCount = selectedMark && selectedMarkTool ? marks.filter((mark) => mark.toolId === selectedMarkTool.id && mark.page === selectedMark.page).length : 0;
  const selectedMarkProjectCount = selectedMark && selectedMarkTool ? marks.filter((mark) => mark.toolId === selectedMarkTool.id).length : 0;

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
    setTools(recovered.tools.length ? recovered.tools.map((tool) => ({ system: 'Other', opacity: 1, size: 22, showCaption: false, ...tool })) : tools);
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
    setMode('select');
    setActivity(`Recovered ${recovered.name || 'Takeoff Project'}. Reopen ${recovered.drawing.fileName} to restore the drawing beneath the preserved takeoff.`);
  };

  const startFresh = () => {
    clearTakeoffRecovery();
    setRecoveryCandidate(null);
    setRecoveryDecisionMade(true);
    setMode('select');
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
        setMode('select');
        setActivity(`${file.name} reopened. Recovered marks, measurements, annotations, snippets, scales, and pending Sync Review state are retained.`);
      } else {
        setProjectId(uid());
        setProjectName(fileStem(file.name));
        setPage(1);
        setZoom(1);
        resetTakeoffData();
        setMode('select');
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

    if (nextMode === 'select') setActivity('Select mode. Click a count, measurement, or markup to inspect it.');
    else if (nextMode === 'calibrate') setActivity(`Calibration mode. Pick two points on page ${page}, enter the known distance, then set the scale.`);
    else if (nextMode === 'count') setActivity('Count mode. Select a Tool Chest item and place raw count marks. Press Esc to return to Select.');
    else if (nextMode === 'pan') setActivity('Pan mode. Use the drawing scroll bars to navigate the sheet. Press Esc to return to Select.');
    else if (MEASUREMENT_MODES.includes(nextMode as MeasurementKind)) setActivity(`${measurementKindLabel(nextMode as MeasurementKind)} mode. ${nextMode === 'distance' ? 'Pick two points.' : 'Pick points, then use Finish.'} Press Esc to return to Select.`);
    else if (nextMode === 'snippet') setActivity('Snippet mode. Pick two corners of the drawing region to capture. Press Esc to return to Select.');
    else if (nextMode === 'freehand') setActivity('Freehand markup. Press and drag on the drawing. Press Esc to return to Select.');
    else if (nextMode === 'text') setActivity('Text note mode. Enter note text if desired, then click the drawing to place it. Press Esc to return to Select.');
    else setActivity(`${markupLabel(nextMode as MarkupKind)} markup. Pick two points on the drawing. Press Esc to return to Select.`);
  };

  const createMeasurement = (kind: MeasurementKind, points: Point[]) => {
    if (!pageCalibration || !pageBaseSize) {
      setActivity(`Page ${page} must be calibrated before measurement takeoff.`);
      return;
    }
    const ordinal = measurements.filter((item) => item.kind === kind).length + 1;
    const measurement: Measurement = { id: uid(), page, kind, name: `${measurementKindLabel(kind)} ${ordinal}`, points };
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
    if (mode === 'select') {
      clearSelections();
      return;
    }
    const point = normalizeOverlayPoint(event);
    if (!point) return;

    if (mode === 'count') {
      const tool = tools.find((item) => item.id === selectedToolId);
      if (!tool) return;
      const now = new Date().toISOString();
      const mark: Mark = { id: uid(), page, toolId: tool.id, x: point.x, y: point.y, createdAt: now, updatedAt: now };
      setMarks((items) => [...items, mark]);
      clearSelections();
      setSelectedMarkId(mark.id);
      setRightTab('properties');
      setActivity(`${tool.name} raw count added on page ${page}. ScopeLogic estimating logic remains downstream of Sync Review.`);
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
      setRightTab('annotations');
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
        setRightTab('annotations');
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
        setRightTab('annotations');
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
        setRightTab('annotations');
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
    changeMode('select');
    setActivity(`Page ${page} calibrated from a ${fmt(known)} ${calibrationKnownUnit} reference. Existing raw measurement geometry now uses this page scale.`);
  };

  const applyPresetScale = (presetId: string) => {
    const preset = PRESET_SCALES.find((item) => item.id === presetId);
    if (!preset) return;
    setPageCalibrations((current) => ({ ...current, [page]: { feetPerPdfPoint: preset.feetPerPdfPoint, label: preset.label, source: 'preset' } }));
    changeMode('select');
    setActivity(`Page ${page} scale set to ${preset.label}. Preset scale assumes the PDF retains its native print scale.`);
  };

  const clearPageScale = () => {
    setPageCalibrations((current) => {
      const next = { ...current };
      delete next[page];
      return next;
    });
    changeMode('select');
    setActivity(`Page ${page} scale cleared. Measurement geometry is retained but values are unavailable until the page is scaled again.`);
  };

  const addTool = () => {
    const name = newTool.name.trim();
    if (!name) return;
    const tool: Tool = {
      id: uid(),
      name,
      system: newTool.system,
      symbolId: newTool.symbolId,
      shape: 'circle',
      color: newTool.color,
      opacity: 1,
      size: 22,
      showCaption: false,
      multiplier: 1,
      unit: 'each',
    };
    setTools((items) => [...items, tool]);
    setSelectedToolId(tool.id);
    changeMode('count');
    setNewTool({ name: '', system: 'Other', symbolId: 'builtin.generic.circle', color: '#4B6623' });
    setShowToolForm(false);
    setActivity(`${tool.name} added to the local Tool Chest as a raw-count tool.`);
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
      const selected = marks.find((item) => item.id === selectedMarkId);
      if (selected?.locked) {
        setActivity('Selected count is locked. Unlock it in Count Measurement Properties before deleting.');
        return;
      }
      setMarks((items) => items.filter((item) => item.id !== selectedMarkId));
      setSelectedMarkId('');
      setActivity('Selected takeoff mark removed. Sync Review will show the resulting raw-count difference.');
    }
  };

  const applySelectedSync = () => {
    setEstimateQty((current) => {
      const next = { ...current };
      for (const row of syncRows) if (syncSelection[row.tool.id]) next[row.tool.id] = row.count;
      return next;
    });
    setActivity('Selected raw drawing quantities applied to the local estimate preview. Cloud Quote/BOM connection remains an explicit later integration step.');
  };

  const updateSelectedTool = (patch: Partial<Tool>) => {
    if (!selectedMarkTool) return;
    setTools((items) => items.map((tool) => tool.id === selectedMarkTool.id ? { ...tool, ...patch, multiplier: 1, unit: 'each' } : tool));
  };

  const updateSelectedMark = (patch: Partial<Mark>) => {
    if (!selectedMark) return;
    setMarks((items) => items.map((mark) => mark.id === selectedMark.id ? { ...mark, ...patch, updatedAt: new Date().toISOString() } : mark));
  };

  const duplicateSelectedTool = () => {
    if (!selectedMarkTool) return;
    const copy: Tool = { ...selectedMarkTool, id: uid(), name: `${selectedMarkTool.name} Copy`, multiplier: 1, unit: 'each' };
    setTools((items) => [...items, copy]);
    setSelectedToolId(copy.id);
    setActivity(`${copy.name} added to the Tool Chest. Rename or adjust it before use.`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));

      if (event.key === 'Escape') {
        event.preventDefault();
        changeMode('select');
        return;
      }

      if (event.key === 'Delete' && !editing && (selectedMarkId || selectedMeasurementId || selectedMarkupId || selectedSnippetId)) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMarkId, selectedMeasurementId, selectedMarkupId, selectedSnippetId, marks, measurements]);

  const selectCountGroup = (toolId: string, targetPage?: number) => {
    const candidate = marks.find((mark) => mark.toolId === toolId && (targetPage === undefined || mark.page === targetPage));
    setSelectedToolId(toolId);
    if (targetPage !== undefined) setPage(targetPage);
    clearSelections();
    if (candidate) setSelectedMarkId(candidate.id);
    setRightTab('properties');
    changeMode('select');
  };

  const pageMarks = marks.filter((mark) => mark.page === page);
  const pageMeasurements = measurementRows.filter((row) => row.measurement.page === page);
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

  const drawingModeClass = mode === 'pan' ? 'pan-mode' : mode === 'select' ? 'select-mode' : 'action-mode';

  return (
    <div className="desktop-shell">
      {recoveryCandidate && <RecoveryPrompt snapshot={recoveryCandidate} onRestore={restoreRecovery} onStartFresh={startFresh} />}

      <header className="desktop-topbar">
        <div className="desktop-brand">
          <div className="brand-mark">S</div>
          <div><strong>ScopeLogic</strong><span>Takeoff Desktop</span></div>
        </div>
        <div className="project-strip"><span>WORKSPACE</span><b>{fileName || 'No drawing set open'}</b></div>
        <div className="sync-state"><span className={syncRequired ? 'status-dot warning' : 'status-dot ok'} /><div><strong>{syncRequired ? 'Sync Required' : 'In Sync'}</strong><small>Explicit review only</small></div></div>
      </header>

      <div className="command-bar">
        <label className="button primary file-button">Open PDF<input type="file" accept="application/pdf,.pdf" onChange={openPdf} /></label>
        <div className="command-separator" />
        <button className={mode === 'select' ? 'button active' : 'button'} onClick={() => changeMode('select')} title="Select (Esc)">↖ Select</button>
        <button className={mode === 'pan' ? 'button active' : 'button'} onClick={() => changeMode('pan')}>✋ Pan</button>
        <button className={mode === 'count' ? 'button active' : 'button'} onClick={() => changeMode('count')}>⌗ Count</button>
        <button className={mode === 'calibrate' ? 'button active' : 'button'} disabled={!pdfDoc} onClick={() => changeMode('calibrate')}>Calibrate</button>
        <button className={mode === 'distance' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('distance')}>Distance</button>
        <button className={mode === 'polyline' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('polyline')}>Polyline</button>
        <button className={mode === 'area' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('area')}>Area</button>
        <button className={mode === 'perimeter' ? 'button active' : 'button'} disabled={!canMeasurePage} onClick={() => changeMode('perimeter')}>Perimeter</button>

        {MULTI_POINT_MODES.includes(mode as MeasurementKind) && measurementDraft.length > 0 && <><button className="button primary" onClick={finishMeasurementDraft}>Finish</button><button className="button" onClick={cancelDraft}>Cancel</button></>}

        {mode === 'calibrate' && <><div className="command-separator" /><span className="command-label">Known</span><input className="command-input calibration-length" type="number" min="0.01" step="0.01" value={calibrationKnownLength} onChange={(event) => setCalibrationKnownLength(event.target.value)} /><select className="command-select unit-select" value={calibrationKnownUnit} onChange={(event) => setCalibrationKnownUnit(event.target.value as 'ft' | 'in')}><option value="ft">ft</option><option value="in">in</option></select><button className="button primary" disabled={calibrationDraft.length !== 2 || !Number(calibrationKnownLength)} onClick={applyManualCalibration}>Set Scale</button>{calibrationDraft.length > 0 && <button className="button" onClick={cancelDraft}>Cancel</button>}</>}

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
        <select className="command-select scale-select" value="" disabled={!pdfDoc} onChange={(event) => applyPresetScale(event.target.value)}><option value="">Preset…</option>{PRESET_SCALES.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select>
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

      <div className="workspace-stack">
        <div className="desktop-workspace">
          <aside className="left-rail">
            <DrawingPagesRail pdfDoc={pdfDoc} pageCount={pageCount} activePage={page} onSelectPage={setPage} markCountByPage={markCountByPage} measurementCountByPage={measurementCountByPage} pageCalibrations={pageCalibrations} />

            <section className="rail-section tool-section">
              <div className="rail-heading"><b>Tool Chest</b><button onClick={() => setShowToolForm((value) => !value)}>+ Tool</button></div>
              {showToolForm && (
                <div className="tool-form">
                  <label><span>Name</span><input value={newTool.name} onChange={(event) => setNewTool({ ...newTool, name: event.target.value })} placeholder="Count tool name" /></label>
                  <label><span>System</span><select value={newTool.system} onChange={(event) => setNewTool({ ...newTool, system: event.target.value })}>{SYSTEMS.map((system) => <option key={system}>{system}</option>)}</select></label>
                  <label><span>Symbol</span><select value={newTool.symbolId} onChange={(event) => setNewTool({ ...newTool, symbolId: event.target.value })}>{TAKEOFF_SYMBOLS.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.category} · {symbol.name}</option>)}</select></label>
                  <div className="tool-symbol-preview"><TakeoffSymbol symbolId={newTool.symbolId} color={newTool.color} size={28} /><span>1 placed symbol = 1 raw count</span></div>
                  <div className="color-row">{COLORS.map((color) => <button key={color} className={newTool.color === color ? 'selected' : ''} style={{ background: color }} aria-label={`Use ${color}`} onClick={() => setNewTool({ ...newTool, color })} />)}</div>
                  <div className="tool-form-actions"><button className="button" onClick={() => setShowToolForm(false)}>Cancel</button><button className="button primary" disabled={!newTool.name.trim()} onClick={addTool}>Add Tool</button></div>
                </div>
              )}
              <div className="tool-list grouped-tool-list">
                {toolGroups.map((group) => (
                  <details className="tool-system-group" open key={group.system}>
                    <summary><span>{group.system}</span><small>{group.tools.length}</small></summary>
                    {group.tools.map((tool) => (
                      <button key={tool.id} className={tool.id === selectedToolId ? 'tool-row active' : 'tool-row'} onClick={() => { setSelectedToolId(tool.id); changeMode('count'); }}>
                        <TakeoffSymbol symbolId={toolSymbolId(tool)} color={tool.color} size={18} />
                        <span><b>{tool.name}</b><small>Raw count</small></span>
                      </button>
                    ))}
                  </details>
                ))}
              </div>
              {selectedTool && <div className="active-tool"><span>Active count tool</span><b>{selectedTool.name}</b></div>}
              <button className="button danger wide" disabled={!selectedMarkId && !selectedMeasurementId && !selectedMarkupId && !selectedSnippetId} onClick={deleteSelected}>Delete Selected</button>
            </section>
          </aside>

          <main className="drawing-panel">
            {loading && <div className="drawing-message">Loading drawing…</div>}
            {error && <div className="drawing-message error"><b>PDF could not be opened.</b><span>{error}</span></div>}
            {!pdfDoc && !loading && !error && <div className="drawing-message"><b>{pendingRecoveredDrawing ? 'Reopen the recovered PDF drawing set' : 'Open a PDF drawing set'}</b><span>{pendingRecoveredDrawing ? `Recovered Takeoff data is preserved. Reopen ${fileName} to restore the drawing beneath it.` : 'Takeoff stores raw drawing counts. ScopeLogic Rules determine materials, labor, and estimate output after explicit Sync Review.'}</span></div>}
            {pdfDoc && (
              <div className={`drawing-scroll ${drawingModeClass}`}>
                <div className="drawing-stage" style={{ width: pageSize.width, height: pageSize.height }}>
                  <canvas ref={canvasRef} />
                  <svg ref={overlayRef} width={pageSize.width} height={pageSize.height} viewBox={`0 0 ${pageSize.width} ${pageSize.height}`} onClick={clickOverlay} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
                    <AnnotationLayer
                      page={page}
                      pageSize={pageSize}
                      markups={markups}
                      snippets={snippets}
                      selectedMarkupId={selectedMarkupId}
                      selectedSnippetId={selectedSnippetId}
                      onSelectMarkup={(id) => { clearSelections(); setSelectedMarkupId(id); setRightTab('annotations'); }}
                      onSelectSnippet={(id) => { clearSelections(); setSelectedSnippetId(id); setRightTab('annotations'); }}
                    />

                    {pageMeasurements.map(({ measurement, value }) => {
                      const points = pointString(measurement.points, pageSize);
                      const selected = measurement.id === selectedMeasurementId;
                      const centerX = measurement.points.reduce((sum, point) => sum + point.x, 0) / measurement.points.length * pageSize.width;
                      const centerY = measurement.points.reduce((sum, point) => sum + point.y, 0) / measurement.points.length * pageSize.height;
                      const clickMeasurement = (event: ReactMouseEvent<SVGElement>) => { event.stopPropagation(); clearSelections(); setSelectedMeasurementId(measurement.id); changeMode('select'); };
                      return (
                        <g key={measurement.id} className={selected ? `measurement-graphic ${measurement.kind} selected` : `measurement-graphic ${measurement.kind}`}>
                          {measurement.kind === 'area' && <polygon points={points} onClick={clickMeasurement} />}
                          {measurement.kind === 'perimeter' && <polygon points={points} onClick={clickMeasurement} />}
                          {(measurement.kind === 'distance' || measurement.kind === 'polyline') && <polyline points={points} onClick={clickMeasurement} />}
                          {measurement.points.map((point, index) => <circle key={`${measurement.id}-${index}`} className="measurement-node" cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="3.5" />)}
                          <g className="measurement-label" transform={`translate(${centerX} ${centerY})`}><rect x="-42" y="-10" width="84" height="20" rx="4" /><text textAnchor="middle" dominantBaseline="central">{formatMeasurement(value, measurement.kind)}</text></g>
                        </g>
                      );
                    })}

                    {pageMarks.map((mark) => {
                      const tool = tools.find((item) => item.id === mark.toolId);
                      if (!tool) return null;
                      const x = mark.x * pageSize.width;
                      const y = mark.y * pageSize.height;
                      const selected = mark.id === selectedMarkId;
                      const symbolSize = tool.size ?? 22;
                      const opacity = tool.opacity ?? 1;
                      return (
                        <g key={mark.id} className={selected ? 'drawing-count-group selected' : 'drawing-count-group'} opacity={opacity} onClick={(event: ReactMouseEvent<SVGGElement>) => { event.stopPropagation(); clearSelections(); setSelectedMarkId(mark.id); setSelectedToolId(tool.id); setRightTab('properties'); }}>
                          {selected && <rect className="selected-mark-ring" x={x - symbolSize / 2 - 4} y={y - symbolSize / 2 - 4} width={symbolSize + 8} height={symbolSize + 8} rx="3" />}
                          <foreignObject className="drawing-mark device-symbol" x={x - symbolSize / 2} y={y - symbolSize / 2} width={symbolSize} height={symbolSize}>
                            <TakeoffSymbol symbolId={toolSymbolId(tool)} color={tool.color} size={symbolSize} title={tool.name} />
                          </foreignObject>
                          {tool.showCaption && <text className="mark-caption" x={x} y={y + symbolSize / 2 + 12} textAnchor="middle">{mark.label || tool.name}</text>}
                        </g>
                      );
                    })}

                    {measurementDraft.length > 0 && <g className={`measurement-draft ${mode}`}><polyline points={pointString(measurementDraft, pageSize)} />{measurementDraft.map((point, index) => <circle key={`draft-${index}`} cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="4" />)}</g>}
                    {calibrationDraft.length > 0 && <g className="calibration-draft">{calibrationDraft.length === 2 && <line x1={calibrationDraft[0].x * pageSize.width} y1={calibrationDraft[0].y * pageSize.height} x2={calibrationDraft[1].x * pageSize.width} y2={calibrationDraft[1].y * pageSize.height} />}{calibrationDraft.map((point, index) => <circle key={`cal-${index}`} cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="5" />)}</g>}
                    {annotationDraft.length > 0 && <g className={`annotation-draft ${mode}`}>{mode === 'freehand' && <polyline points={pointString(annotationDraft, pageSize)} />}{(mode === 'line' || mode === 'arrow') && annotationDraft.length === 2 && <line x1={annotationDraft[0].x * pageSize.width} y1={annotationDraft[0].y * pageSize.height} x2={annotationDraft[1].x * pageSize.width} y2={annotationDraft[1].y * pageSize.height} />}{(mode === 'rectangle' || mode === 'cloud' || mode === 'highlight' || mode === 'snippet') && markupDraftRect && <rect {...markupDraftRect} />}{annotationDraft.map((point, index) => <circle key={`ann-draft-${index}`} cx={point.x * pageSize.width} cy={point.y * pageSize.height} r="4" />)}</g>}
                  </svg>
                </div>
              </div>
            )}
            <div className="activity-bar"><span>{activity}</span><b>{modeLabel}{pageCalibration ? ` · ${pageCalibration.label}` : pdfDoc ? ' · UNSCALED' : ''}</b></div>
          </main>

          <aside className="right-rail">
            <div className="right-tabs">
              <button className={rightTab === 'properties' ? 'active' : ''} onClick={() => setRightTab('properties')}>⚙ Properties</button>
              <button className={rightTab === 'annotations' ? 'active' : ''} onClick={() => setRightTab('annotations')}>Annotations</button>
              <button className={rightTab === 'sync' ? 'active' : ''} onClick={() => setRightTab('sync')}>Sync Review</button>
            </div>

            {rightTab === 'properties' && (
              <CountPropertiesPanel
                mark={selectedMark}
                tool={selectedMarkTool}
                pageLabel={selectedMark ? pageLabels[selectedMark.page] || `Page ${selectedMark.page}` : undefined}
                countOnPage={selectedMarkPageCount}
                countInProject={selectedMarkProjectCount}
                isDefaultTool={Boolean(selectedMarkTool && selectedMarkTool.id === selectedToolId)}
                onUpdateTool={updateSelectedTool}
                onUpdateMark={updateSelectedMark}
                onSetDefault={() => { if (selectedMarkTool) { setSelectedToolId(selectedMarkTool.id); setActivity(`${selectedMarkTool.name} set as the active/default count tool.`); } }}
                onDuplicateTool={duplicateSelectedTool}
                onDelete={deleteSelected}
              />
            )}

            {rightTab === 'annotations' && <AnnotationPanel markups={markups} snippets={snippets} selectedMarkupId={selectedMarkupId} selectedSnippetId={selectedSnippetId} onSelectMarkup={(id) => { clearSelections(); setSelectedMarkupId(id); }} onSelectSnippet={(id) => { clearSelections(); setSelectedSnippetId(id); }} onChangeMarkups={setMarkups} onChangeSnippets={setSnippets} onGoToPage={setPage} onDeleteSelected={deleteSelected} />}

            {rightTab === 'sync' && (
              <div className="right-content">
                <div className="panel-title"><b>Sync Review</b><span>{syncRequired ? 'Changes pending' : 'No changes'}</span></div>
                <p className="sync-help">Drawing changes never overwrite Estimate/BOM quantities automatically. Review each raw-count difference and apply only the rows you intend to change.</p>
                {!syncRows.length && <div className="empty-compact">Complete a count takeoff first.</div>}
                <div className="sync-table">
                  {syncRows.map((row) => <label className="sync-row" key={row.tool.id}><input type="checkbox" checked={syncSelection[row.tool.id] ?? true} onChange={(event) => setSyncSelection({ ...syncSelection, [row.tool.id]: event.target.checked })} /><span><b>{row.tool.name}</b><small>each</small></span><span><small>Drawing</small><b>{fmt(row.count)}</b></span><span><small>Applied</small><b>{fmt(row.current)}</b></span><span className={row.difference === 0 ? 'diff zero' : 'diff'}><small>Difference</small><b>{row.difference > 0 ? '+' : ''}{fmt(row.difference)}</b></span></label>)}
                </div>
                <button className="button primary wide" disabled={!syncRows.some((row) => (syncSelection[row.tool.id] ?? true) && row.difference !== 0)} onClick={applySelectedSync}>Apply Selected Changes</button>
                <div className="local-preview-note">This build applies approved changes to a local estimate preview only. The shared ScopeLogic writeback adapter will replace this preview in the next integration patch.</div>
              </div>
            )}
          </aside>
        </div>

        <MarkupsListDock
          marks={marks}
          tools={tools}
          pageLabels={pageLabels}
          activePage={page}
          selectedMarkId={selectedMarkId}
          onSelectTool={setSelectedToolId}
          onSelectCountGroup={selectCountGroup}
        />
      </div>
    </div>
  );
}
