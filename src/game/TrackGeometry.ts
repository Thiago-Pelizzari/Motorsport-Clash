import type { Point, Track } from '../types/race';

export interface TrackPosition extends Point {
  angle: number;
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export class TrackGeometry {
  readonly samples: Point[];
  private readonly cumulative: number[];
  private readonly totalVisualLength: number;

  constructor(track: Track, samplesPerSegment = 30) {
    this.samples = [];
    const points = track.points;
    for (let index = 0; index < points.length; index += 1) {
      const p0 = points[(index - 1 + points.length) % points.length];
      const p1 = points[index];
      const p2 = points[(index + 1) % points.length];
      const p3 = points[(index + 2) % points.length];
      for (let step = 0; step < samplesPerSegment; step += 1) {
        this.samples.push(catmullRom(p0, p1, p2, p3, step / samplesPerSegment));
      }
    }
    this.cumulative = [0];
    for (let index = 1; index <= this.samples.length; index += 1) {
      const previous = this.samples[index - 1];
      const current = this.samples[index % this.samples.length];
      this.cumulative.push(this.cumulative[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
    }
    this.totalVisualLength = this.cumulative[this.cumulative.length - 1];
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
}
