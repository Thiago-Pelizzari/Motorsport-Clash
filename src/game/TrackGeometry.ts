import type { Point, Track } from '../types/race';

export interface TrackPosition extends Point {
  angle: number;
}

export interface CornerApex extends TrackPosition {
  progress: number;
  sign: number;
  severity: number;
}

export function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function sampleSplinePoints(points: Point[], closed = true, samplesPerSegment = 16): Point[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  if (!closed && points.length < 3) return points.map((p) => ({ ...p }));
  const samples: Point[] = [];
  const segmentCount = closed ? points.length : points.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const p0 = closed ? points[(index - 1 + points.length) % points.length] : points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[(index + 1) % points.length];
    const p3 = closed ? points[(index + 2) % points.length] : points[Math.min(points.length - 1, index + 2)];
    for (let step = 0; step < samplesPerSegment; step += 1) {
      samples.push(catmullRom(p0, p1, p2, p3, step / samplesPerSegment));
    }
  }
  if (!closed) {
    samples.push({ ...points[points.length - 1] });
  }
  return samples;
}

export function smoothSvgPoints(points: Point[], closed = true, samplesPerSegment = 14): string {
  const sampled = sampleSplinePoints(points, closed, samplesPerSegment);
  if (sampled.length === 0) return '';
  const list = closed ? [...sampled, sampled[0]] : sampled;
  return list.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function normalizeAngleDelta(delta: number): number {
  let wrapped = delta;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

export class TrackGeometry {
  readonly samples: Point[];
  readonly curvatures: number[];
  readonly cornerApexes: CornerApex[];
  private readonly cumulative: number[];
  readonly totalVisualLength: number;

  constructor(track: Track, samplesPerSegment = 30) {
    this.samples = sampleSplinePoints(track.points, true, samplesPerSegment);
    this.cumulative = [0];
    for (let index = 1; index <= this.samples.length; index += 1) {
      const previous = this.samples[index - 1];
      const current = this.samples[index % this.samples.length];
      this.cumulative.push(this.cumulative[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
    }
    this.totalVisualLength = Math.max(1, this.cumulative[this.cumulative.length - 1]);

    // Compute smoothed signed curvature along samples
    const count = this.samples.length;
    const rawCurvatures: number[] = new Array(count).fill(0);
    const windowStep = Math.max(2, Math.round(samplesPerSegment * 0.35));

    for (let i = 0; i < count; i += 1) {
      const prev = this.samples[(i - windowStep + count) % count];
      const curr = this.samples[i];
      const next = this.samples[(i + windowStep) % count];
      const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      const dist = Math.max(1, Math.hypot(curr.x - prev.x, curr.y - prev.y) + Math.hypot(next.x - curr.x, next.y - curr.y));
      const dAngle = normalizeAngleDelta(angle2 - angle1);
      // Normalized curvature in [-1, 1]
      rawCurvatures[i] = Math.max(-1, Math.min(1, (dAngle / dist) * 42));
    }

    this.curvatures = rawCurvatures.map((_, i) => {
      let sum = 0;
      const smoothRadius = 3;
      for (let offset = -smoothRadius; offset <= smoothRadius; offset += 1) {
        sum += rawCurvatures[(i + offset + count) % count];
      }
      return sum / (smoothRadius * 2 + 1);
    });

    this.cornerApexes = [];
    const minSeparation = Math.max(8, Math.floor(count / 24));
    let lastApexIndex = -minSeparation;
    for (let i = 0; i < count; i += 1) {
      const absCurr = Math.abs(this.curvatures[i]);
      if (absCurr < 0.24) continue;
      const absPrev = Math.abs(this.curvatures[(i - 1 + count) % count]);
      const absNext = Math.abs(this.curvatures[(i + 1) % count]);
      if (absCurr >= absPrev && absCurr >= absNext && i - lastApexIndex >= minSeparation) {
        const progress = this.cumulative[i] / this.totalVisualLength;
        const pos = this.at(progress, 0);
        this.cornerApexes.push({
          ...pos,
          progress,
          sign: Math.sign(this.curvatures[i]) || 1,
          severity: Math.min(1, absCurr),
        });
        lastApexIndex = i;
      }
    }
  }

  at(progress: number, lateralOffset = 0): TrackPosition {
    const normalized = ((progress % 1) + 1) % 1;
    const target = normalized * this.totalVisualLength;
    let low = 0;
    let high = this.cumulative.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.cumulative[middle] < target) low = middle + 1;
      else high = middle;
    }
    const index = Math.max(1, low);
    const startDistance = this.cumulative[index - 1];
    const segmentLength = Math.max(0.001, this.cumulative[index] - startDistance);
    const ratio = (target - startDistance) / segmentLength;
    const from = this.samples[index - 1];
    const to = this.samples[index % this.samples.length];
    const x = from.x + (to.x - from.x) * ratio;
    const y = from.y + (to.y - from.y) * ratio;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    return {
      x: x - Math.sin(angle) * lateralOffset,
      y: y + Math.cos(angle) * lateralOffset,
      angle,
    };
  }

  curvatureAt(progress: number): number {
    if (this.curvatures.length === 0) return 0;
    const normalized = ((progress % 1) + 1) % 1;
    const floatIndex = normalized * this.curvatures.length;
    const index = Math.floor(floatIndex) % this.curvatures.length;
    const nextIndex = (index + 1) % this.curvatures.length;
    const fraction = floatIndex - Math.floor(floatIndex);
    return this.curvatures[index] * (1 - fraction) + this.curvatures[nextIndex] * fraction;
  }

  speedFactorAt(progress: number, gripMultiplier = 1): number {
    // Look ahead slightly for braking zone before corner apex
    const currentCurv = Math.abs(this.curvatureAt(progress));
    const aheadCurv = Math.abs(this.curvatureAt(progress + 0.022));
    const effectiveCurv = Math.max(currentCurv, aheadCurv * 0.88);
    if (effectiveCurv < 0.16) {
      // Straightaway speed boost
      return 1.09;
    }
    const cornerPenalty = Math.min(0.32, effectiveCurv * 0.34 / Math.max(0.65, gripMultiplier));
    return Math.max(0.64, 1.07 - cornerPenalty);
  }
}
