export type Point = { x: number; y: number };
export type PageSize = { width: number; height: number };
export type MeasurementKind = 'distance' | 'polyline' | 'area' | 'perimeter';

export type PageCalibration = {
  feetPerPdfPoint: number;
  label: string;
  source: 'manual' | 'preset';
};

export type Measurement = {
  id: string;
  page: number;
  kind: MeasurementKind;
  name: string;
  points: Point[];
};

export const PRESET_SCALES = [
  { id: '1-16', label: '1/16" = 1\'-0"', feetPerPdfPoint: 16 / 72 },
  { id: '1-8', label: '1/8" = 1\'-0"', feetPerPdfPoint: 8 / 72 },
  { id: '3-16', label: '3/16" = 1\'-0"', feetPerPdfPoint: (16 / 3) / 72 },
  { id: '1-4', label: '1/4" = 1\'-0"', feetPerPdfPoint: 4 / 72 },
  { id: '3-8', label: '3/8" = 1\'-0"', feetPerPdfPoint: (8 / 3) / 72 },
  { id: '1-2', label: '1/2" = 1\'-0"', feetPerPdfPoint: 2 / 72 },
  { id: '3-4', label: '3/4" = 1\'-0"', feetPerPdfPoint: (4 / 3) / 72 },
  { id: '1-1', label: '1" = 1\'-0"', feetPerPdfPoint: 1 / 72 },
] as const;

const toPdfPoint = (point: Point, size: PageSize) => ({
  x: point.x * size.width,
  y: point.y * size.height,
});

export function pointDistance(a: Point, b: Point, size: PageSize) {
  const pa = toPdfPoint(a, size);
  const pb = toPdfPoint(b, size);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

export function pathLength(points: Point[], size: PageSize, close = false) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += pointDistance(points[index - 1], points[index], size);
  }
  if (close && points.length > 2) total += pointDistance(points[points.length - 1], points[0], size);
  return total;
}

export function polygonArea(points: Point[], size: PageSize) {
  if (points.length < 3) return 0;
  const converted = points.map((point) => toPdfPoint(point, size));
  let twiceArea = 0;
  for (let index = 0; index < converted.length; index += 1) {
    const current = converted[index];
    const next = converted[(index + 1) % converted.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

export function measurementValue(
  measurement: Measurement,
  calibration: PageCalibration | undefined,
  size: PageSize | undefined,
) {
  if (!calibration || !size) return null;
  if (measurement.kind === 'area') {
    return polygonArea(measurement.points, size) * calibration.feetPerPdfPoint * calibration.feetPerPdfPoint;
  }
  if (measurement.kind === 'perimeter') {
    return pathLength(measurement.points, size, true) * calibration.feetPerPdfPoint;
  }
  return pathLength(measurement.points, size, false) * calibration.feetPerPdfPoint;
}

export function measurementUnit(kind: MeasurementKind) {
  return kind === 'area' ? 'sf' : 'ft';
}

export function measurementKindLabel(kind: MeasurementKind) {
  if (kind === 'polyline') return 'Polyline';
  if (kind === 'area') return 'Area';
  if (kind === 'perimeter') return 'Perimeter';
  return 'Distance';
}

export function formatMeasurement(value: number | null, kind: MeasurementKind) {
  if (value === null || Number.isNaN(value)) return '—';
  const precision = kind === 'area' ? 1 : 2;
  const rendered = value.toFixed(precision).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${rendered} ${measurementUnit(kind)}`;
}
