import { FLAG_CONFIG, GAME_CONFIG, TYRES } from '../game/gameConfig';
import { TrackGeometry } from '../game/TrackGeometry';
import type { Point, RaceState, Track } from '../types/race';
import { separateMarkers, type MarkerPosition } from './MarkerLayout';

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
  private readonly onSelectCar?: (carId: string) => void;
  private resizeObserver: ResizeObserver;
  private zoom = 1;
  private cameraX = 500;
  private cameraY = 310;
  private dragging = false;
  private dragMoved = false;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private lastState: RaceState | null = null;
  private lastRenderedMarkers: MarkerPosition[] = [];
  private selectedCarId: string | null = null;
  private followingSelectedCar = false;
  private readonly visualCars = new Map<string, VisualCarState>();

  constructor(
    canvas: HTMLCanvasElement,
    track: Track,
    onZoomChange: (zoom: number) => void,
    onFollowChange: (following: boolean) => void,
    onSelectCar?: (carId: string) => void,
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D não disponível');
    this.context = context;
    this.track = track;
    this.onZoomChange = onZoomChange;
    this.onFollowChange = onFollowChange;
    this.onSelectCar = onSelectCar;
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
    const now = performance.now();
    this.updateVisualCars(state, now);
    this.updateFollowCamera(state);

    const context = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const baseScale = Math.min(width / 1000, height / 620);
    const effectiveScale = baseScale * this.zoom;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    this.drawScreenBackground(context, width, height, state);

    context.setTransform(
      effectiveScale,
      0,
      0,
      effectiveScale,
      width / 2 - this.cameraX * effectiveScale,
      height / 2 - this.cameraY * effectiveScale,
    );

    this.drawWorldGrid(context);
    this.drawPitLane(context);
    this.drawTrack(context, state);
    this.drawCars(context, state);

    if (state.weather.rainIntensity > 0.05) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      this.drawRainOverlay(context, width, height, state.weather.rainIntensity, now);
    }
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
    if (event.button !== 0) return;
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.dragMoved = false;

    if (this.zoom > 1) {
      this.dragging = true;
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const moveDist = Math.hypot(event.clientX - this.pointerDownX, event.clientY - this.pointerDownY);
    if (moveDist > 5) {
      if (!this.dragMoved) {
        this.dragMoved = true;
        this.stopFollowing();
        this.canvas.classList.add('is-dragging');
      }
    }
    if (!this.dragMoved) return;

    const rect = this.canvas.getBoundingClientRect();
    const baseScale = Math.min(rect.width / 1000, rect.height / 620);
    const deltaX = (event.clientX - this.pointerX) / Math.max(0.1, baseScale);
    const deltaY = (event.clientY - this.pointerY) / Math.max(0.1, baseScale);
    this.cameraX -= deltaX / this.zoom;
    this.cameraY -= deltaY / this.zoom;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.clampCamera();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.dragging) {
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      this.canvas.classList.remove('is-dragging');
    }

    // Direct click on car marker to select & follow
    const moveDist = Math.hypot(event.clientX - this.pointerDownX, event.clientY - this.pointerDownY);
    if (moveDist <= 5 && this.onSelectCar && this.lastRenderedMarkers.length > 0) {
      const worldPt = this.screenToWorld(event.clientX, event.clientY);
      const hitRadius = 18 / Math.sqrt(this.zoom);
      let closestId: string | null = null;
      let closestDist = hitRadius;
      for (const marker of this.lastRenderedMarkers) {
        const d = Math.hypot(marker.x - worldPt.x, marker.y - worldPt.y);
        if (d <= closestDist) {
          closestDist = d;
          closestId = marker.id;
        }
      }
      if (closestId) {
        this.onSelectCar(closestId);
      }
    }
  };

  private canvasPoint(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const baseScale = Math.min(rect.width / 1000, rect.height / 620);
    return {
      x: 500 + (clientX - (rect.left + rect.width / 2)) / Math.max(0.1, baseScale),
      y: 310 + (clientY - (rect.top + rect.height / 2)) / Math.max(0.1, baseScale),
    };
  }

  private screenToWorld(clientX: number, clientY: number): Point {
    const anchor = this.canvasPoint(clientX, clientY);
    return {
      x: this.cameraX + (anchor.x - 500) / this.zoom,
      y: this.cameraY + (anchor.y - 310) / this.zoom,
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
    const reducedMotion = document.documentElement.classList.contains('reduced-motion');
    const lerpFactor = reducedMotion ? 1 : 0.25;
    this.cameraX += (target.x - this.cameraX) * lerpFactor;
    this.cameraY += (target.y - this.cameraY) * lerpFactor;
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

  private drawScreenBackground(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: RaceState,
  ): void {
    const gradient = context.createRadialGradient(width * 0.52, height * 0.5, 30, width * 0.52, height * 0.5, Math.max(width, height) * 0.75);
    const isWet = state.weather.trackWetness > 0.2;
    gradient.addColorStop(0, isWet ? '#132028' : '#17251f');
    gradient.addColorStop(1, isWet ? '#070d12' : '#09100e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  private drawWorldGrid(context: CanvasRenderingContext2D): void {
    context.strokeStyle = 'rgba(255,255,255,.025)';
    context.lineWidth = 1;
    for (let x = -200; x <= 1200; x += 40) {
      context.beginPath();
      context.moveTo(x, -200);
      context.lineTo(x, 820);
      context.stroke();
    }
    for (let y = -200; y <= 820; y += 40) {
      context.beginPath();
      context.moveTo(-200, y);
      context.lineTo(1200, y);
      context.stroke();
    }
  }

  private path(context: CanvasRenderingContext2D): void {
    context.beginPath();
    this.geometry.samples.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
    context.closePath();
  }

  private drawPitLane(context: CanvasRenderingContext2D): void {
    const pitOffset = GAME_CONFIG.pitLaneOffset ?? 24;
    context.save();
    context.beginPath();
    const steps = 28;
    for (let i = 0; i <= steps; i += 1) {
      const progress = (0.91 + (i / steps) * 0.16) % 1;
      const edgeBlend = i < 5 ? i / 5 : i > steps - 5 ? (steps - i) / 5 : 1;
      const point = this.geometry.at(progress, pitOffset * edgeBlend);
      if (i === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.strokeStyle = '#252a32';
    context.lineWidth = 14;
    context.lineCap = 'round';
    context.stroke();

    context.strokeStyle = 'rgba(255, 182, 39, 0.45)';
    context.lineWidth = 1.5;
    context.setLineDash([4, 4]);
    context.stroke();
    context.setLineDash([]);

    const boxPos = this.geometry.at(0.995, pitOffset);
    context.fillStyle = '#141920';
    context.strokeStyle = this.track.accent;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(boxPos.x, boxPos.y, 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  private drawTrack(context: CanvasRenderingContext2D, state: RaceState): void {
    context.lineJoin = 'round';
    context.lineCap = 'round';

    // Track outer shadow / runoff
    this.path(context);
    context.strokeStyle = 'rgba(0,0,0,.58)';
    context.lineWidth = 72;
    context.stroke();

    // Track border / shoulders
    this.path(context);
    context.strokeStyle = state.flag !== 'green' ? `${FLAG_CONFIG[state.flag].color}66` : '#343941';
    context.lineWidth = 58;
    context.stroke();

    // Main asphalt surface
    this.path(context);
    const wetness = state.weather.trackWetness;
    context.strokeStyle = wetness > 0.3 ? '#323c47' : '#444a53';
    context.lineWidth = 44;
    context.stroke();

    // Wet sheen highlight
    if (wetness > 0.08) {
      this.path(context);
      context.strokeStyle = `rgba(110, 195, 255, ${(wetness * 0.18).toFixed(3)})`;
      context.lineWidth = 34;
      context.stroke();
    }

    // Corner Kerbs (Zebras)
    this.drawCornerKerbs(context);

    // Center dashed line
    this.path(context);
    context.strokeStyle = 'rgba(255,255,255,.19)';
    context.setLineDash([4, 15]);
    context.lineWidth = 1.5;
    context.stroke();
    context.setLineDash([]);

    // Sector timing markers (S1 at 1/3, S2 at 2/3)
    this.drawSectorLine(context, 1 / 3, 'S1');
    this.drawSectorLine(context, 2 / 3, 'S2');

    // Start / Finish checkered line
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

  private drawCornerKerbs(context: CanvasRenderingContext2D): void {
    context.save();
    for (const apex of this.geometry.cornerApexes) {
      const kerbOffset = apex.sign * 21;
      const stripeCount = 5;
      for (let s = -stripeCount; s <= stripeCount; s += 1) {
        const p1 = this.geometry.at(apex.progress + s * 0.0032, kerbOffset);
        const p2 = this.geometry.at(apex.progress + (s + 0.85) * 0.0032, kerbOffset);
        context.beginPath();
        context.moveTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.strokeStyle = Math.abs(s) % 2 === 0 ? this.track.accent : '#f4f6f8';
        context.lineWidth = 4.2;
        context.stroke();
      }
    }
    context.restore();
  }

  private drawSectorLine(context: CanvasRenderingContext2D, progress: number, label: string): void {
    const pos = this.geometry.at(progress, 0);
    context.save();
    context.translate(pos.x, pos.y);
    context.rotate(pos.angle);
    context.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -22);
    context.lineTo(0, 22);
    context.stroke();

    context.rotate(-pos.angle);
    const badgePos = this.geometry.at(progress, -32);
    context.fillStyle = 'rgba(10, 14, 20, 0.82)';
    context.fillRect(badgePos.x - pos.x - 10, badgePos.y - pos.y - 6, 20, 12);
    context.fillStyle = '#9aa4b2';
    context.font = '800 7px Inter, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, badgePos.x - pos.x, badgePos.y - pos.y + 0.5);
    context.restore();
  }

  private drawCars(context: CanvasRenderingContext2D, state: RaceState): void {
    const drawOrder = [...state.cars].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
    const radiusScale = 1 / Math.sqrt(this.zoom);
    const markerPositions = separateMarkers(
      drawOrder.map((car) => {
        const position = this.carPosition(car);
        return {
          id: car.id,
          x: position.x,
          y: position.y,
          radius: (car.isPlayer ? 13 : 11) * radiusScale,
          raceDistance: car.distance,
        };
      }),
      this.track.length,
    );
    this.lastRenderedMarkers = markerPositions;
    const positionByCar = new Map(markerPositions.map((position) => [position.id, position]));

    for (const car of drawOrder) {
      const position = positionByCar.get(car.id)!;
      const trackPos = this.geometry.at(car.distance / this.track.length, car.laneOffset);
      context.save();
      context.translate(position.x, position.y);

      // Water spray in wet conditions
      if (state.weather.trackWetness > 0.22 && car.speed > 60 && car.pitTimeRemaining <= 0) {
        const sprayAngle = trackPos.angle + Math.PI;
        context.fillStyle = `rgba(185, 225, 255, ${(state.weather.trackWetness * 0.28).toFixed(2)})`;
        context.beginPath();
        context.arc(
          Math.cos(sprayAngle) * 14 * radiusScale,
          Math.sin(sprayAngle) * 14 * radiusScale,
          9 * radiusScale,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      // Selected car dashed ring
      if (car.id === this.selectedCarId) {
        context.beginPath();
        context.arc(0, 0, 22 * radiusScale, 0, Math.PI * 2);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2 * radiusScale;
        context.setLineDash([4 * radiusScale, 3 * radiusScale]);
        context.stroke();
        context.setLineDash([]);
      }

      // Fastest lap holder purple ring
      if (state.fastestLapCarId === car.id) {
        context.beginPath();
        context.arc(0, 0, 19.5 * radiusScale, 0, Math.PI * 2);
        context.strokeStyle = '#c264ff';
        context.lineWidth = 2 * radiusScale;
        context.stroke();
      }

      // ERS Deploy active ring
      if (car.ersDeploy && car.ersCharge > 0.05) {
        context.beginPath();
        context.arc(0, 0, 17 * radiusScale, 0, Math.PI * 2);
        context.strokeStyle = '#38f8b2';
        context.lineWidth = 2 * radiusScale;
        context.stroke();
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
          const sparkAngle = car.variationPhase + spark * ((Math.PI * 2) / 5);
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
      const baseLabel = gap >= this.track.length
        ? `+${Math.floor(gap / this.track.length)} volta`
        : `${Math.round(gap)} m`;
      const label = car.pendingPitTyre ? `${baseLabel} · BOX` : car.inSlipstream ? `${baseLabel} · DRS` : baseLabel;
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
      context.fillText(label, 0, y + 0.5 * inverseZoom);
      context.restore();
    });
  }

  private drawRainOverlay(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    now: number,
  ): void {
    if (document.documentElement.classList.contains('reduced-motion')) return;
    const dropCount = Math.round(45 * intensity);
    context.save();
    context.strokeStyle = `rgba(175, 215, 255, ${(0.18 + intensity * 0.16).toFixed(2)})`;
    context.lineWidth = 1.2;
    context.beginPath();
    const t = now * 0.85;
    for (let i = 0; i < dropCount; i += 1) {
      const x = ((i * 197 + t * 0.4) % (width + 80)) - 40;
      const y = ((i * 311 + t * 1.3) % (height + 80)) - 40;
      context.moveTo(x, y);
      context.lineTo(x - 7, y + 22);
    }
    context.stroke();
    context.restore();
  }
}
