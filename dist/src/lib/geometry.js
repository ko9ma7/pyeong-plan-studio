export const PYEONG_M2 = 3.305785;

export const UNIT_META = {
  mm: { label: 'mm (밀리미터)', meters: 0.001, decimals: 0 },
  cm: { label: 'cm (센티미터)', meters: 0.01, decimals: 1 },
  m: { label: 'm (미터)', meters: 1, decimals: 3 },
};

export function toMeters(value, unit) {
  return Number(value || 0) * UNIT_META[unit].meters;
}

export function fromMeters(value, unit) {
  return value / UNIT_META[unit].meters;
}

export function formatLength(meters, unit, compact = false) {
  const meta = UNIT_META[unit];
  const value = fromMeters(meters, unit);
  const digits = unit === 'm' ? (compact ? 2 : 3) : unit === 'cm' ? 1 : 0;
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: digits })} ${unit}`;
}

export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(points) {
  if (!points?.length) return { x: 0, y: 0 };
  const area = polygonArea(points);
  if (area < 1e-9) {
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    return { x, y };
  }
  let cx = 0;
  let cy = 0;
  let signedArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-9) return points[0];
  return { x: cx / (6 * signedArea), y: cy / (6 * signedArea) };
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polygonPerimeter(points) {
  if (!points || points.length < 2) return 0;
  return points.reduce((total, point, index) => total + distance(point, points[(index + 1) % points.length]), 0);
}

export function bounds(points) {
  if (!points?.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function snap(value, grid) {
  if (!grid || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function pointOnSegment(point, a, b, tolerance = 1e-7) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > tolerance) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -tolerance) return false;
  const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= lenSq + tolerance;
}

export function pointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  for (let i = 0; i < polygon.length; i += 1) {
    if (pointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length])) return true;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

export function polygonContainsPolygon(container, inner, samplesPerEdge = 12) {
  if (!container?.length || !inner?.length) return false;
  for (let i = 0; i < inner.length; i += 1) {
    const a = inner[i];
    const b = inner[(i + 1) % inner.length];
    for (let s = 0; s <= samplesPerEdge; s += 1) {
      const t = s / samplesPerEdge;
      const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (!pointInPolygon(point, container)) return false;
    }
  }
  return true;
}
