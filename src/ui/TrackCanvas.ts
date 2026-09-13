import { GAME_CONFIG, TYRES } from '../game/gameConfig';
import { TrackGeometry } from '../game/TrackGeometry';
import type { Point, RaceState, Track } from '../types/race';
import { separateMarkers } from './MarkerLayout';

interface VisualCarState {
  previousDistance: number;
  targetDistance: number;
  distance: number;
  previousLaneOffset: number;
  targetLaneOffset: number;
  laneOffset: number;
  transitionStartedAt: number;
}

export class TrackCanvas {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly geometry: TrackGeometry;
  private readonly track: Track;
  private readonly onZoomChange: (zoom: number) => void;
  private readonly onFollowChange: (following: boolean) => void;
  private resizeObserver: ResizeObserver;
  private zoom = 1;
  private cameraX = 500;
  private cameraY = 310;
  private dragging = false;
  private pointerX = 0;
  private pointerY = 0;
  private lastState: RaceState | null = null;
  private selectedCarId: string | null = null;
  private followingSelectedCar = false;
  private readonly visualCars = new Map<string, VisualCarState>();

  constructor(canvas: HTMLCanvasElement, track: Track, onZoomChange: (zoom: number) => void, onFollowChange: (following: boolean) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D não disponível');
    this.context = context;
    this.track = track;
    this.onZoomChange = onZoomChange;
    this.onFollowChange = onFollowChange;
    this.geometry = new TrackGeometry(track);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('dblclick', this.resetView);
    this.resize();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('dblclick', this.resetView);
  }

  zoomIn(): void {
    const focusCar = this.lastState?.cars.find((car) => car.id === this.selectedCarId)
      ?? this.lastState?.cars.find((car) => car.isPlayer && !car.finished)
      ?? this.lastState?.cars[0];
    if (!focusCar) {
      this.setZoom(this.zoom * 1.35, 500, 310);
      return;
    }
    const focus = this.carPosition(focusCar);
    this.zoom = Math.max(1, Math.min(4, this.zoom * 1.35));
    this.cameraX = focus.x;
    this.cameraY = focus.y;
    this.clampCamera();
    this.onZoomChange(this.zoom);
  }

  zoomOut(): void {
    this.setZoom(this.zoom / 1.35, 500, 310);
  }

  resetView = (): void => {
    this.stopFollowing();
    this.zoom = 1;
    this.cameraX = 500;
    this.cameraY = 310;
    this.onZoomChange(this.zoom);
  };

  followCar(carId: string): void {
    this.selectedCarId = carId;
    this.followingSelectedCar = true;
    if (this.zoom < 1.8) this.zoom = 1.8;
    const car = this.lastState?.cars.find((candidate) => candidate.id === carId);
    if (car) {
      const position = this.carPosition(car);
      this.cameraX = position.x;
      this.cameraY = position.y;
      this.clampCamera();
    }
    this.onZoomChange(this.zoom);
    this.onFollowChange(true);
  }

  stopFollowing(): void {
    if (!this.followingSelectedCar) return;
    this.followingSelectedCar = false;
    this.onFollowChange(false);
  }

  draw(state: RaceState): void {
    this.lastState = state;
    this.updateVisualCars(state, performance.now());
    this.updateFollowCamera(state);
    const context = this.context;
    const scaleX = this.canvas.width / 1000;
    const scaleY = this.canvas.height / 620;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.setTransform(
      scaleX * this.zoom,
      0,
      0,
      scaleY * this.zoom,
      scaleX * (500 - this.cameraX * this.zoom),
      scaleY * (310 - this.cameraY * this.zoom),
    );
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

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const point = this.canvasPoint(event.clientX, event.clientY);
    this.setZoom(this.zoom * (event.deltaY < 0 ? 1.16 : 1 / 1.16), point.x, point.y);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.zoom <= 1) return;
    this.stopFollowing();
    this.dragging = true;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.classList.add('is-dragging');
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const deltaX = ((event.clientX - this.pointerX) / Math.max(1, rect.width)) * 1000;
    const deltaY = ((event.clientY - this.pointerY) / Math.max(1, rect.height)) * 620;
    this.cameraX -= deltaX / this.zoom;
    this.cameraY -= deltaY / this.zoom;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.clampCamera();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.canvas.classList.remove('is-dragging');
  };

  private canvasPoint(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * 1000,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * 620,
    };
  }

  private setZoom(nextZoom: number, anchorX: number, anchorY: number): void {
    const worldX = this.cameraX + (anchorX - 500) / this.zoom;
    const worldY = this.cameraY + (anchorY - 310) / this.zoom;
    this.zoom = Math.max(1, Math.min(4, nextZoom));
    this.cameraX = worldX - (anchorX - 500) / this.zoom;
    this.cameraY = worldY - (anchorY - 310) / this.zoom;
    this.clampCamera();
    this.onZoomChange(this.zoom);
  }

  private clampCamera(): void {
    const halfWidth = 500 / this.zoom;
    const halfHeight = 310 / this.zoom;
    this.cameraX = Math.max(halfWidth, Math.min(1000 - halfWidth, this.cameraX));
    this.cameraY = Math.max(halfHeight, Math.min(620 - halfHeight, this.cameraY));
  }

  private updateFollowCamera(state: RaceState): void {
    if (!this.followingSelectedCar || !this.selectedCarId || this.zoom <= 1) return;
    const car = state.cars.find((candidate) => candidate.id === this.selectedCarId);
    if (!car) return;
    const target = this.carPosition(car);
    this.cameraX = target.x;
    this.cameraY = target.y;
    this.clampCamera();
  }

  private updateVisualCars(state: RaceState, now: number): void {
    const transitionDuration = GAME_CONFIG.fixedStep * 1000;
    const activeIds = new Set(state.cars.map((car) => car.id));

    for (const car of state.cars) {
      let visual = this.visualCars.get(car.id);
      if (!visual) {
        visual = {
          previousDistance: car.distance,
          targetDistance: car.distance,
          distance: car.distance,
          previousLaneOffset: car.laneOffset,
          targetLaneOffset: car.laneOffset,
          laneOffset: car.laneOffset,
          transitionStartedAt: now,
        };
        this.visualCars.set(car.id, visual);
      }

      const progress = Math.min(1, Math.max(0, (now - visual.transitionStartedAt) / transitionDuration));
      visual.distance = visual.previousDistance + (visual.targetDistance - visual.previousDistance) * progress;
      visual.laneOffset = visual.previousLaneOffset + (visual.targetLaneOffset - visual.previousLaneOffset) * progress;

      if (Math.abs(car.distance - visual.targetDistance) > 0.0001 || Math.abs(car.laneOffset - visual.targetLaneOffset) > 0.0001) {
        visual.previousDistance = visual.distance;
        visual.previousLaneOffset = visual.laneOffset;
        visual.targetDistance = car.distance;
        visual.targetLaneOffset = car.laneOffset;
        visual.transitionStartedAt = now;
      }
    }

    for (const carId of this.visualCars.keys()) {
      if (!activeIds.has(carId)) this.visualCars.delete(carId);
    }
  }

  private carPosition(car: RaceState['cars'][number]): Point {
    const visual = this.visualCars.get(car.id);
    const distance = visual?.distance ?? car.distance;
    const laneOffset = visual?.laneOffset ?? car.laneOffset;
    return this.geometry.at(distance / this.track.length, laneOffset);
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
    const radiusScale = 1 / Math.sqrt(this.zoom);
    const markerPositions = separateMarkers(drawOrder.map((car) => {
      const position = this.carPosition(car);
      return {
        id: car.id,
        x: position.x,
        y: position.y,
        radius: (car.isPlayer ? 13 : 11) * radiusScale,
        raceDistance: car.distance,
      };
    }), this.track.length);
    const positionByCar = new Map(markerPositions.map((position) => [position.id, position]));
    for (const car of drawOrder) {
      const position = positionByCar.get(car.id)!;
      context.save();
      context.translate(position.x, position.y);
      if (car.id === this.selectedCarId) {
        context.beginPath();
        context.arc(0, 0, 22 * radiusScale, 0, Math.PI * 2);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2 * radiusScale;
        context.setLineDash([4 * radiusScale, 3 * radiusScale]);
        context.stroke();
        context.setLineDash([]);
      }
      if (car.collisionCooldown > 0) {
        const collisionLife = car.collisionCooldown / (GAME_CONFIG.collisionCooldown ?? 0.75);
        context.globalAlpha = Math.max(0.2, collisionLife);
        context.beginPath();
        context.arc(0, 0, (20 + (1 - collisionLife) * 8) * radiusScale, 0, Math.PI * 2);
        context.strokeStyle = '#ffb627';
        context.lineWidth = 3 * radiusScale;
        context.stroke();
        for (let spark = 0; spark < 5; spark += 1) {
          const sparkAngle = car.variationPhase + spark * (Math.PI * 2 / 5);
          context.beginPath();
          context.moveTo(Math.cos(sparkAngle) * 16 * radiusScale, Math.sin(sparkAngle) * 16 * radiusScale);
          context.lineTo(Math.cos(sparkAngle) * 24 * radiusScale, Math.sin(sparkAngle) * 24 * radiusScale);
          context.stroke();
        }
        context.globalAlpha = 1;
      }
      if (car.isPlayer) {
        context.beginPath();
        context.arc(0, 0, 18 * radiusScale, 0, Math.PI * 2);
        context.fillStyle = `${car.color}35`;
        context.fill();
      }
      context.shadowColor = 'rgba(0,0,0,.65)';
      context.shadowBlur = 8;
      context.shadowOffsetY = 3;
      context.beginPath();
      context.arc(0, 0, (car.isPlayer ? 13 : 11) * radiusScale, 0, Math.PI * 2);
      context.fillStyle = car.color;
      context.fill();
      context.lineWidth = 2.5 * radiusScale;
      context.strokeStyle = car.isPlayer ? '#fff' : TYRES[car.tyreType].color;
      context.stroke();
      context.shadowColor = 'transparent';
      context.fillStyle = '#071015';
      context.font = `800 ${(car.number > 9 ? 8.5 : 10) * radiusScale}px Inter, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(car.number), 0, 0.5);
      context.restore();
    }
    if (this.zoom >= 1.35) this.drawDistanceLabels(context, state);
  }

  private drawDistanceLabels(context: CanvasRenderingContext2D, state: RaceState): void {
    const inverseZoom = 1 / this.zoom;
    state.cars.forEach((car, index) => {
      if (index === 0 || car.finished) return;
      const carAhead = state.cars[index - 1];
      const gap = Math.max(0, carAhead.distance - car.distance);
      const label = gap >= this.track.length
        ? `+${Math.floor(gap / this.track.length)} volta`
        : `${Math.round(gap)} m`;
      const position = this.carPosition(car);
      const width = (label.length * 5.2 + 12) * inverseZoom;
      const height = 16 * inverseZoom;
      const labelSide = index % 2 === 0 ? -1 : 1;
      const labelTier = Math.floor(index / 2) % 3;
      const y = labelSide * (25 + labelTier * 14) * inverseZoom;
      context.save();
      context.translate(position.x, position.y);
      context.fillStyle = 'rgba(7, 10, 14, .86)';
      context.strokeStyle = car.isPlayer ? car.color : 'rgba(255,255,255,.28)';
      context.lineWidth = inverseZoom;
      context.beginPath();
      context.roundRect(-width / 2, y - height / 2, width, height, 3 * inverseZoom);
      context.fill();
      context.stroke();
      context.fillStyle = '#f5f7fa';
      context.font = `800 ${8 * inverseZoom}px Inter, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, 0, y + .5 * inverseZoom);
      context.restore();
    });
  }
}
