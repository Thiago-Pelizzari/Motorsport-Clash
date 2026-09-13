import { updateAI } from './AIController';
import { createCars } from './CarFactory';
import { resolveCarCollisions } from './CollisionSystem';
import { GAME_CONFIG, STRATEGIES, TYRES } from './gameConfig';
import { calculateRacingLine } from './RacingLineSystem';
import type { CarState, RaceSettings, RaceState, SimulationSpeed, StrategyMode, Track, TyreType } from '../types/race';
import { SeededRandom } from '../utils/random';

export class RaceEngine {
  readonly state: RaceState;
  readonly track: Track;
  readonly settings: RaceSettings;
  private readonly random: SeededRandom;

  constructor(settings: RaceSettings, track: Track, seed = Date.now()) {
    this.settings = structuredClone(settings);
    this.track = track;
    this.random = new SeededRandom(seed);
    this.state = {
      phase: 'ready',
      elapsedTime: 0,
      simulationSpeed: 1,
      totalLaps: settings.laps,
      cars: createCars(settings, track, this.random),
      eventMessage: 'Grid pronto',
      eventMessageUntil: 2,
    };
    this.updatePositions();
  }

  start(): void {
    if (this.state.phase === 'ready' || this.state.phase === 'paused') this.state.phase = 'running';
  }

  setSimulationSpeed(speed: SimulationSpeed): void {
    this.state.simulationSpeed = speed;
    if (speed === 0 && this.state.phase === 'running') this.state.phase = 'paused';
    if (speed > 0 && this.state.phase === 'paused') this.state.phase = 'running';
  }

  setStrategy(carId: string, mode: StrategyMode): void {
    const car = this.getPlayerCar(carId);
    if (car && !car.finished) car.strategyMode = mode;
  }

  requestPitStop(carId: string, tyre: TyreType): void {
    const car = this.getPlayerCar(carId);
    if (!car || car.finished || car.pitTimeRemaining > 0) return;
    car.pendingPitTyre = tyre;
    this.announce(`#${car.number} entrará nos boxes: pneu ${TYRES[tyre].label}`);
  }

  cancelPitStop(carId: string): void {
    const car = this.getPlayerCar(carId);
    if (car && car.pitTimeRemaining <= 0) car.pendingPitTyre = null;
  }

  update(realDeltaTime: number): void {
    if (this.state.phase !== 'running' || this.state.simulationSpeed === 0) return;
    const deltaTime = Math.min(realDeltaTime, GAME_CONFIG.maxFrameDelta) * this.state.simulationSpeed;
    this.state.elapsedTime += deltaTime;

    for (const car of this.state.cars) {
      if (car.finished) continue;
      car.collisionCooldown = Math.max(0, car.collisionCooldown - deltaTime);
      updateAI(car, this.track, this.state.totalLaps, deltaTime, this.random);
      this.updateCar(car, deltaTime);
    }

    const collisions = this.state.elapsedTime > 2.5
      ? resolveCarCollisions(this.state.cars, this.track.length)
      : [];
    const strongestCollision = collisions.sort((first, second) => second.impact - first.impact)[0];
    if (strongestCollision) this.announce(`Contato entre #${strongestCollision.first.number} e #${strongestCollision.second.number}`);
    this.updatePositions();
    if (this.state.cars.every((car) => car.finished)) {
      this.state.phase = 'finished';
      this.state.simulationSpeed = 0;
      this.announce('Bandeira quadriculada!');
    }
  }

  private updateCar(car: CarState, deltaTime: number): void {
    car.totalTime += deltaTime;
    car.currentLapTime += deltaTime;
    car.laneOffset += (car.targetLaneOffset - car.laneOffset) * Math.min(1, deltaTime * 3.5);

    if (car.pitTimeRemaining > 0) {
      car.pitTimeRemaining = Math.max(0, car.pitTimeRemaining - deltaTime);
      car.speed = 0;
      if (car.pitTimeRemaining === 0) {
        car.tyreCondition = 1;
        this.announce(`#${car.number} voltou à pista`);
      }
      return;
    }

    const targetSpeed = this.calculateTargetSpeed(car, deltaTime);
    const speedDifference = targetSpeed - car.speed;
    const maxChange = car.acceleration * deltaTime;
    car.speed += Math.max(-maxChange * 1.7, Math.min(maxChange, speedDifference));

    const oldCompletedLaps = Math.floor(Math.max(0, car.distance) / this.track.length);
    const distanceDelta = Math.max(0, car.speed / 3.6) * deltaTime;
    car.distance += distanceDelta;
    this.wearTyres(car, distanceDelta);
    const newCompletedLaps = Math.floor(Math.max(0, car.distance) / this.track.length);

    if (newCompletedLaps > oldCompletedLaps && car.distance >= this.track.length) {
      this.completeLap(car, newCompletedLaps);
      if (!car.finished && newCompletedLaps < this.state.totalLaps && car.pendingPitTyre) this.beginPitStop(car, car.pendingPitTyre);
    }

    car.lap = Math.min(this.state.totalLaps, newCompletedLaps);
    if (car.distance >= this.track.length * this.state.totalLaps) this.finishCar(car);
  }

  private calculateTargetSpeed(car: CarState, deltaTime: number): number {
    const tyre = TYRES[car.tyreType];
    const strategy = STRATEGIES[car.strategyMode];
    const tyreLife = Math.max(0, car.tyreCondition);
    const tyrePerformance = tyreLife > GAME_CONFIG.tyreCliff
      ? 0.93 + 0.07 * ((tyreLife - GAME_CONFIG.tyreCliff) / (1 - GAME_CONFIG.tyreCliff))
      : GAME_CONFIG.minimumTyrePerformance + (0.93 - GAME_CONFIG.minimumTyrePerformance) * (tyreLife / GAME_CONFIG.tyreCliff);
    const driverPerformance = 0.93 + car.driver.skill * 0.09;
    const variation = 1 + Math.sin(this.state.elapsedTime * 0.2 + car.variationPhase) * (1 - car.driver.consistency) * 0.045;
    const traffic = this.trafficFactor(car, deltaTime);
    const carCondition = 0.94 + car.condition * 0.06;
    return car.baseSpeed * driverPerformance * tyre.speed * tyrePerformance * strategy.speed * variation * traffic * carCondition;
  }

  private trafficFactor(car: CarState, deltaTime: number): number {
    const ahead = this.state.cars
      .filter((other) => other.id !== car.id && !other.finished && other.distance > car.distance)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!ahead) {
      car.targetLaneOffset = calculateRacingLine(car, this.track);
      return 1;
    }
    const gap = ahead.distance - car.distance;
    if (gap > GAME_CONFIG.trafficRangeMetres) {
      car.targetLaneOffset = calculateRacingLine(car, this.track);
      return 1;
    }

    const advantage = car.speed - ahead.speed + (car.driver.skill - ahead.driver.skill) * 18;
    const chance = this.track.overtakeChance * car.driver.aggression * Math.max(0.05, 0.35 + advantage / 30);
    const side = Math.sin(car.variationPhase + car.lap * 1.7 + this.state.elapsedTime * 0.09) >= 0 ? 1 : -1;
    const laneLimit = GAME_CONFIG.maximumLaneOffset ?? 17;
    const lateralGap = Math.abs(car.laneOffset - ahead.laneOffset);
    if (gap < (GAME_CONFIG.collisionDistanceMetres ?? 16) * 1.45 && lateralGap < (GAME_CONFIG.collisionLaneDistance ?? 20)) {
      car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, ahead.laneOffset + side * 18));
      return 0.91;
    }
    if (this.random.next() < chance * deltaTime) {
      car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, ahead.laneOffset + side * 16));
      return 1.018;
    }
    car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, ahead.laneOffset + side * 4));
    return GAME_CONFIG.trafficSpeedPenalty;
  }

  private wearTyres(car: CarState, distanceDelta: number): void {
    const perLapWear = 0.12;
    const wear = (distanceDelta / this.track.length) * perLapWear * this.track.tyreWear * TYRES[car.tyreType].wear * STRATEGIES[car.strategyMode].wear * car.tyreWearRate;
    car.tyreCondition = Math.max(0, car.tyreCondition - wear);
  }

  private completeLap(car: CarState, completedLaps: number): void {
    const lapTime = car.currentLapTime;
    car.lastLapTime = lapTime;
    car.bestLapTime = car.bestLapTime === null ? lapTime : Math.min(car.bestLapTime, lapTime);
    car.laps.push({ lap: completedLaps, time: lapTime, tyre: car.tyreType });
    car.currentLapTime = 0;
  }

  private beginPitStop(car: CarState, tyre: TyreType): void {
    const fromTyre = car.tyreType;
    const duration = GAME_CONFIG.pitStopBaseDuration + this.random.range(-GAME_CONFIG.pitStopVariation, GAME_CONFIG.pitStopVariation);
    car.pendingPitTyre = null;
    car.tyreType = tyre;
    car.pitTimeRemaining = duration;
    car.pitStops.push({ lap: car.lap + 1, duration, fromTyre, toTyre: tyre });
    this.announce(`#${car.number} nos boxes · ${duration.toFixed(1)}s`);
  }

  private finishCar(car: CarState): void {
    if (car.finished) return;
    car.finished = true;
    car.distance = this.track.length * this.state.totalLaps;
    car.finishTime = car.totalTime;
    car.speed = 0;
    const finishingPosition = this.state.cars.filter((candidate) => candidate.finished).length;
    this.announce(`#${car.number} terminou em ${finishingPosition}º`);
  }

  private updatePositions(): void {
    const sorted = [...this.state.cars].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    });
    sorted.forEach((car, index) => { car.position = index + 1; });
    this.state.cars.sort((a, b) => a.position - b.position);
  }

  private getPlayerCar(carId: string): CarState | undefined {
    return this.state.cars.find((car) => car.id === carId && car.isPlayer);
  }

  private announce(message: string): void {
    this.state.eventMessage = message;
    this.state.eventMessageUntil = this.state.elapsedTime + 3;
  }
}
