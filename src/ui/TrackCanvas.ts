import { TYRES } from '../game/gameConfig';
import { TrackGeometry } from '../game/TrackGeometry';
import type { RaceState, Track } from '../types/race';

export class TrackCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly geometry: TrackGeometry;
  private readonly track: Track;
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D não disponível');
    this.context = context;
    this.track = track;
    this.geometry = new TrackGeometry(track);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  draw(state: RaceState): void {
    const context = this.context;
    const scaleX = this.canvas.width / 1000;
    const scaleY = this.canvas.height / 620;
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.clearRect(0, 0, 1000, 620);
    this.drawBackground(context);
    this.drawTrack(context);
    this.drawCars(context, state);
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const density = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * density));
    this.canvas.height = Math.max(1, Math.round(rect.height * density));
  }

  private drawBackground(context: CanvasRenderingContext2D): void {
    const gradient = context.createRadialGradient(520, 310, 40, 520, 310, 620);
    gradient.addColorStop(0, '#17251f');
    gradient.addColorStop(1, '#09100e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1000, 620);
    context.strokeStyle = 'rgba(255,255,255,.025)';
    context.lineWidth = 1;
    for (let x = 0; x < 1000; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 620); context.stroke(); }
    for (let y = 0; y < 620; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(1000, y); context.stroke(); }
  }

  private path(context: CanvasRenderingContext2D): void {
    context.beginPath();
    this.geometry.samples.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.closePath();
  }

  private drawTrack(context: CanvasRenderingContext2D): void {
    context.lineJoin = 'round';
    context.lineCap = 'round';
    this.path(context);
    context.strokeStyle = 'rgba(0,0,0,.55)';
    context.lineWidth = 70;
    context.stroke();
    this.path(context);
    context.strokeStyle = '#343941';
    context.lineWidth = 58;
    context.stroke();
    this.path(context);
    context.strokeStyle = '#444a53';
    context.lineWidth = 44;
    context.stroke();
    this.path(context);
    context.strokeStyle = 'rgba(255,255,255,.2)';
    context.setLineDash([4, 15]);
    context.lineWidth = 1.5;
    context.stroke();
    context.setLineDash([]);

    const start = this.geometry.at(0);
    context.save();
    context.translate(start.x, start.y);
    context.rotate(start.angle);
    for (let row = -2; row < 2; row += 1) {
      for (let column = -3; column < 3; column += 1) {
        context.fillStyle = (row + column) % 2 === 0 ? '#f6f7f9' : '#15191f';
        context.fillRect(-4 + row * 4, column * 7, 4, 7);
      }
    }
    context.restore();
  }

  private drawCars(context: CanvasRenderingContext2D, state: RaceState): void {
    const drawOrder = [...state.cars].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
    for (const car of drawOrder) {
      const progress = car.distance / this.track.length;
      const position = this.geometry.at(progress, car.laneOffset);
      context.save();
      context.translate(position.x, position.y);
      if (car.isPlayer) {
        context.beginPath();
        context.arc(0, 0, 18, 0, Math.PI * 2);
        context.fillStyle = `${car.color}35`;
        context.fill();
      }
      context.shadowColor = 'rgba(0,0,0,.65)';
      context.shadowBlur = 8;
      context.shadowOffsetY = 3;
      context.beginPath();
      context.arc(0, 0, car.isPlayer ? 13 : 11, 0, Math.PI * 2);
      context.fillStyle = car.color;
      context.fill();
      context.lineWidth = 2.5;
      context.strokeStyle = car.isPlayer ? '#fff' : TYRES[car.tyreType].color;
      context.stroke();
      context.shadowColor = 'transparent';
      context.fillStyle = '#071015';
      context.font = `800 ${car.number > 9 ? 8.5 : 10}px Inter, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(car.number), 0, 0.5);
      context.restore();
    }
  }
}
