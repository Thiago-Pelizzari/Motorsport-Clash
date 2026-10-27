import { updateAI } from './AIController';
import { createCars } from './CarFactory';
import { resolveCarCollisions, signedTrackGap } from './CollisionSystem';
import { FLAG_CONFIG, GAME_CONFIG, STRATEGIES, TYRES, WEATHER_LABELS } from './gameConfig';
import { calculateRacingLine, getCachedTrackGeometry } from './RacingLineSystem';
import type { TrackGeometry } from './TrackGeometry';
import { createInitialWeather, updateWeather, weatherGripMultiplier, weatherWearMultiplier } from './WeatherSystem';
import type {
  CarState,
  RaceEventLog,
  RaceSettings,
  RaceState,
  SimulationSpeed,
  StrategyMode,
  Track,
  TrackFlag,
  TyreType,
} from '../types/race';
import { formatTime } from '../utils/format';
import { SeededRandom } from '../utils/random';

export class RaceEngine {
  readonly state: RaceState;
  readonly track: Track;
  readonly settings: RaceSettings;
  readonly geometry: TrackGeometry;
  private readonly random: SeededRandom;
  private eventCounter = 0;

  constructor(settings: RaceSettings, track: Track, seed = Date.now()) {
    this.settings = structuredClone(settings);
    this.track = track;
    this.geometry = getCachedTrackGeometry(track);
    this.random = new SeededRandom(seed);
    const weather = createInitialWeather(settings.weatherPreset ?? 'clear', this.random);
    const cars = createCars(settings, track, this.random, weather.trackWetness);

    this.state = {
      phase: 'ready',
      elapsedTime: 0,
      simulationSpeed: 1,
      totalLaps: settings.laps,
      cars,
      eventMessage: 'Grid pronto',
      eventMessageUntil: 2,
      flag: 'green',
      flagTimer: 0,
      weather,
      fastestLapCarId: null,
      fastestLapTime: null,
      bestSectors: [null, null, null],
      eventLog: [],
    };
    this.updatePositions();
    this.logEvent('Grid alinhado para a largada', 'info');
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

  toggleErs(carId: string, forceState?: boolean): void {
    const car = this.getPlayerCar(carId);
    if (!car || car.finished) return;
    const next = forceState !== undefined ? forceState : !car.ersDeploy;
    if (next && car.ersCharge < 0.05) return;
    car.ersDeploy = next;
  }

  setPitRepair(carId: string, repair: boolean): void {
    const car = this.getPlayerCar(carId);
    if (car && !car.finished) car.pendingPitRepair = repair;
  }

  requestPitStop(carId: string, tyre: TyreType, repair?: boolean): void {
    const car = this.getPlayerCar(carId);
    if (!car || car.finished || car.pitTimeRemaining > 0) return;
    car.pendingPitTyre = tyre;
    if (repair !== undefined) car.pendingPitRepair = repair;
    const repairSuffix = car.pendingPitRepair && car.condition < 0.98 ? ' + reparo' : '';
    this.announce(`#${car.number} entrará nos boxes: pneu ${TYRES[tyre].label}${repairSuffix}`, 'pit');
  }

  cancelPitStop(carId: string): void {
    const car = this.getPlayerCar(carId);
    if (car && car.pitTimeRemaining <= 0) {
      car.pendingPitTyre = null;
      if (car.pitState === 'entering') car.pitState = 'none';
      this.announce(`#${car.number} permanece na pista`, 'info');
    }
  }

  update(realDeltaTime: number): void {
    if (this.state.phase !== 'running' || this.state.simulationSpeed === 0) return;
    const deltaTime = Math.min(realDeltaTime, GAME_CONFIG.maxFrameDelta) * this.state.simulationSpeed;
    this.state.elapsedTime += deltaTime;

    // Update dynamic weather
    const changedWeather = updateWeather(
      this.state.weather,
      this.settings.weatherPreset ?? 'clear',
      deltaTime,
      this.random,
    );
    if (changedWeather) {
      const info = WEATHER_LABELS[changedWeather];
      this.announce(`${info.icon} Clima mudou: ${info.label}`, 'weather');
    }

    // Update track flags (Yellow / VSC / SC)
    if (this.state.flag !== 'green') {
      this.state.flagTimer = Math.max(0, this.state.flagTimer - deltaTime);
      if (this.state.flagTimer <= 0) {
        this.state.flag = 'green';
        this.announce('Bandeira verde — pista livre!', 'flag');
      }
    }

    for (const car of this.state.cars) {
      if (car.finished) continue;
      car.collisionCooldown = Math.max(0, car.collisionCooldown - deltaTime);
      updateAI(car, this.track, this.state.totalLaps, deltaTime, this.random, this.state.weather, this.state.flag);
      this.updateCar(car, deltaTime);
    }

    const collisions = this.state.elapsedTime > 2.5
      ? resolveCarCollisions(this.state.cars, this.track.length)
      : [];
    const strongestCollision = collisions.sort((first, second) => second.impact - first.impact)[0];
    if (strongestCollision) {
      this.announce(`Contato entre #${strongestCollision.first.number} e #${strongestCollision.second.number}`, 'incident');
      // High-impact crash can trigger Yellow Flag or VSC
      if (
        strongestCollision.impact > 22
        && this.state.flag === 'green'
        && this.state.totalLaps >= 3
        && this.state.cars[0].lap < this.state.totalLaps - 1
        && this.random.next() < 0.25
      ) {
        const nextFlag: TrackFlag = strongestCollision.impact > 32 ? 'vsc' : 'yellow';
        this.state.flag = nextFlag;
        this.state.flagTimer = this.random.range(9, 15);
        this.announce(`${FLAG_CONFIG[nextFlag].label} após incidente na pista`, 'flag');
      }
    }

    this.updatePositions();
    if (this.state.cars.every((car) => car.finished)) {
      this.state.phase = 'finished';
      this.state.simulationSpeed = 0;
      this.announce('Bandeira quadriculada!', 'flag');
    }
  }

  private updateCar(car: CarState, deltaTime: number): void {
    car.totalTime += deltaTime;
    car.currentLapTime += deltaTime;

    const progress = ((car.distance / this.track.length) % 1 + 1) % 1;
    const distToLapEnd = (1 - progress) * this.track.length;
    const distFromLapStart = progress * this.track.length;

    if (car.pitTimeRemaining > 0) {
      car.pitState = 'stationary';
      car.targetLaneOffset = GAME_CONFIG.pitLaneOffset;
      car.laneOffset += (car.targetLaneOffset - car.laneOffset) * Math.min(1, deltaTime * 7);
      car.pitTimeRemaining = Math.max(0, car.pitTimeRemaining - deltaTime);
      car.speed = 0;
      if (car.pitTimeRemaining === 0) {
        car.tyreCondition = 1;
        car.tyreTemperature = 0.48;
        car.pitState = 'exiting';
        car.speed = GAME_CONFIG.pitLaneSpeedLimit;
        this.announce(`#${car.number} voltou à pista`, 'pit');
      }
      return;
    }

    if (
      car.pendingPitTyre
      && car.distance >= 0
      && distToLapEnd <= GAME_CONFIG.pitEntryDistanceBeforeLine
      && car.lap + 1 < this.state.totalLaps
    ) {
      car.pitState = 'entering';
      car.targetLaneOffset = GAME_CONFIG.pitLaneOffset;
    } else if (car.pitState === 'exiting' && distFromLapStart <= GAME_CONFIG.pitExitDistanceAfterLine) {
      car.targetLaneOffset = GAME_CONFIG.pitLaneOffset * 0.65;
    } else if (car.pitState !== 'none') {
      car.pitState = 'none';
    }

    car.laneOffset += (car.targetLaneOffset - car.laneOffset) * Math.min(1, deltaTime * 3.8);

    const targetSpeed = this.calculateTargetSpeed(car, deltaTime, progress);
    const speedDifference = targetSpeed - car.speed;
    const maxChange = car.acceleration * deltaTime;
    // Stronger braking into corners than acceleration
    car.speed += Math.max(-maxChange * 2.35, Math.min(maxChange * 1.15, speedDifference));

    const oldCompletedLaps = Math.floor(Math.max(0, car.distance) / this.track.length);
    const distanceDelta = Math.max(0, car.speed / 3.6) * deltaTime;
    car.distance += distanceDelta;

    this.updateSectors(car, progress, ((car.distance / this.track.length) % 1 + 1) % 1);
    this.wearTyresAndResources(car, distanceDelta, deltaTime, progress);

    const newCompletedLaps = Math.floor(Math.max(0, car.distance) / this.track.length);

    if (newCompletedLaps > oldCompletedLaps && car.distance >= this.track.length) {
      this.completeLap(car, newCompletedLaps);
      if (!car.finished && newCompletedLaps < this.state.totalLaps && car.pendingPitTyre) {
        this.beginPitStop(car, car.pendingPitTyre);
      }
    }

    car.lap = Math.min(this.state.totalLaps, newCompletedLaps);
    if (car.distance >= this.track.length * this.state.totalLaps) this.finishCar(car);
  }

  private updateSectors(car: CarState, oldProgress: number, newProgress: number): void {
    if (car.distance < 0) return;
    if (car.currentSector === 0 && oldProgress < 1 / 3 && newProgress >= 1 / 3) {
      const s1 = car.currentLapTime - car.sectorStartTime;
      car.sectorTimes[0] = s1;
      if (car.bestSectorTimes[0] === null || s1 < car.bestSectorTimes[0]) car.bestSectorTimes[0] = s1;
      if (this.state.bestSectors[0] === null || s1 < this.state.bestSectors[0]) this.state.bestSectors[0] = s1;
      car.currentSector = 1;
      car.sectorStartTime = car.currentLapTime;
    } else if (car.currentSector === 1 && oldProgress < 2 / 3 && newProgress >= 2 / 3) {
      const s2 = car.currentLapTime - car.sectorStartTime;
      car.sectorTimes[1] = s2;
      if (car.bestSectorTimes[1] === null || s2 < car.bestSectorTimes[1]) car.bestSectorTimes[1] = s2;
      if (this.state.bestSectors[1] === null || s2 < this.state.bestSectors[1]) this.state.bestSectors[1] = s2;
      car.currentSector = 2;
      car.sectorStartTime = car.currentLapTime;
    }
  }

  private calculateTargetSpeed(car: CarState, deltaTime: number, progress: number): number {
    const tyre = TYRES[car.tyreType];
    const strategy = STRATEGIES[car.strategyMode];
    const tyreLife = Math.max(0, car.tyreCondition);
    const tyrePerformance = tyreLife > GAME_CONFIG.tyreCliff
      ? 0.93 + 0.07 * ((tyreLife - GAME_CONFIG.tyreCliff) / (1 - GAME_CONFIG.tyreCliff))
      : GAME_CONFIG.minimumTyrePerformance + (0.93 - GAME_CONFIG.minimumTyrePerformance) * (tyreLife / GAME_CONFIG.tyreCliff);

    // Tyre temperature factor (optimal window: 0.60 - 0.88)
    let tempFactor = 1;
    if (car.tyreTemperature < 0.55) {
      tempFactor = 0.972 + (car.tyreTemperature / 0.55) * 0.028;
    } else if (car.tyreTemperature > 0.9) {
      tempFactor = 1 - (car.tyreTemperature - 0.9) * 0.18;
    }

    const wetGrip = weatherGripMultiplier(car.tyreType, this.state.weather.trackWetness, car.driver.wetSkill ?? 0.85);
    const cornerSpeedFactor = this.geometry.speedFactorAt(progress, tyrePerformance * wetGrip);

    const driverPerformance = 0.93 + car.driver.skill * 0.09;
    const variation = 1 + Math.sin(this.state.elapsedTime * 0.2 + car.variationPhase) * (1 - car.driver.consistency) * 0.04;
    const traffic = this.trafficFactor(car, deltaTime, progress);
    const carCondition = 0.94 + car.condition * 0.06;

    // Fuel weight effect: lighter as fuel burns off, penalty if empty
    const fuelBurned = Math.max(0, car.maxFuelLoad - car.fuelLoad);
    const fuelFactor = car.fuelLoad > 0.04
      ? 1 + fuelBurned * GAME_CONFIG.fuelWeightPenaltyPerKg
      : 0.89;

    // ERS speed boost
    const ersBonus = car.ersDeploy && car.ersCharge > 0.02 ? GAME_CONFIG.ersSpeedBonus : 1;
    const flagMultiplier = FLAG_CONFIG[this.state.flag].speedMultiplier;

    let computedSpeed =
      car.baseSpeed
      * driverPerformance
      * tyre.speed
      * tyrePerformance
      * tempFactor
      * wetGrip
      * cornerSpeedFactor
      * strategy.speed
      * variation
      * traffic
      * carCondition
      * fuelFactor
      * ersBonus
      * flagMultiplier;

    if (car.pitState === 'entering' || car.pitState === 'exiting') {
      computedSpeed = Math.min(computedSpeed, GAME_CONFIG.pitLaneSpeedLimit * 1.35);
    }

    return computedSpeed;
  }

  private trafficFactor(car: CarState, deltaTime: number, progress: number): number {
    car.inSlipstream = false;
    car.inDirtyAir = false;

    if (car.pitState === 'entering' || car.pitState === 'exiting') {
      return 1;
    }

    // Find closest car physically ahead on the circuit (including lapped backmarkers)
    let closestAhead: CarState | null = null;
    let smallestPositiveGap = Infinity;

    for (const other of this.state.cars) {
      if (other.id === car.id || other.finished || other.pitTimeRemaining > 0 || other.pitState !== 'none') continue;
      if (other.distance < 0 && car.distance >= 0) continue;
      const gap = signedTrackGap(other.distance, car.distance, this.track.length);
      if (gap > 0.2 && gap < smallestPositiveGap) {
        smallestPositiveGap = gap;
        closestAhead = other;
      }
    }

    if (!closestAhead || smallestPositiveGap > GAME_CONFIG.slipstreamRangeMetres) {
      car.targetLaneOffset = calculateRacingLine(car, this.track);
      return 1;
    }

    const ahead = closestAhead;
    const gap = smallestPositiveGap;
    const isBackmarker = ahead.lap < car.lap && car.distance > ahead.distance + this.track.length * 0.5;
    const curvature = Math.abs(this.geometry.curvatureAt(progress));
    const laneLimit = GAME_CONFIG.maximumLaneOffset ?? 17;
    const side = Math.sin(car.variationPhase + car.lap * 1.7 + this.state.elapsedTime * 0.09) >= 0 ? 1 : -1;

    // Blue flag: backmarker yields racing line
    if (isBackmarker) {
      ahead.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, -side * (laneLimit - 2)));
      car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, side * 10));
      return 1.008;
    }

    // Slipstream on straights when within 44m
    if (curvature < 0.18 && gap <= GAME_CONFIG.slipstreamRangeMetres) {
      car.inSlipstream = true;
    } else if (curvature >= 0.22 && gap <= 28) {
      car.inDirtyAir = true;
    }

    if (gap > GAME_CONFIG.trafficRangeMetres) {
      car.targetLaneOffset = calculateRacingLine(car, this.track);
      return car.inSlipstream ? GAME_CONFIG.slipstreamBonus : 1;
    }

    // Under Yellow / VSC / SC: no overtaking
    if (this.state.flag !== 'green') {
      car.targetLaneOffset = calculateRacingLine(car, this.track);
      return 0.94;
    }

    const advantage = car.speed - ahead.speed + (car.driver.skill - ahead.driver.skill) * 18;
    const chance = this.track.overtakeChance * car.driver.aggression * Math.max(0.05, 0.35 + advantage / 30);
    const lateralGap = Math.abs(car.laneOffset - ahead.laneOffset);

    if (gap < (GAME_CONFIG.collisionDistanceMetres ?? 16) * 1.45 && lateralGap < (GAME_CONFIG.collisionLaneDistance ?? 20)) {
      car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, ahead.laneOffset + side * 18));
      return 0.91;
    }
    if (this.random.next() < chance * deltaTime) {
      car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, ahead.laneOffset + side * 16));
      return 1.022;
    }
    car.targetLaneOffset = Math.max(-laneLimit, Math.min(laneLimit, ahead.laneOffset + side * 4));
    const basePenalty = car.inDirtyAir ? GAME_CONFIG.dirtyAirPenalty * GAME_CONFIG.trafficSpeedPenalty : GAME_CONFIG.trafficSpeedPenalty;
    return car.inSlipstream ? Math.min(1.01, basePenalty * GAME_CONFIG.slipstreamBonus) : basePenalty;
  }

  private wearTyresAndResources(car: CarState, distanceDelta: number, deltaTime: number, progress: number): void {
    const lapFraction = distanceDelta / this.track.length;
    const compound = TYRES[car.tyreType];
    const strategy = STRATEGIES[car.strategyMode];
    const weatherWear = weatherWearMultiplier(car.tyreType, this.state.weather.trackWetness);
    const overheatWear = car.tyreTemperature > 0.88 ? 1 + (car.tyreTemperature - 0.88) * 1.4 : 1;

    const perLapWear = 0.12;
    const wear = lapFraction * perLapWear * this.track.tyreWear * compound.wear * strategy.wear * car.tyreWearRate * weatherWear * overheatWear;
    car.tyreCondition = Math.max(0, car.tyreCondition - wear);

    // Update tyre temperature
    const targetTemp = Math.min(
      1,
      0.58
        + strategy.wear * 0.18
        + (this.state.weather.trackTemp - 25) * 0.006
        - this.state.weather.trackWetness * 0.16,
    );
    car.tyreTemperature += (targetTemp - car.tyreTemperature) * Math.min(1, deltaTime * 0.18 * compound.warmupRate);

    // Fuel consumption (uses car.fuelEfficiency!)
    const efficiencyFactor = 1.92 - car.fuelEfficiency; // ~0.94 to 1.04
    const fuelUsed = lapFraction * GAME_CONFIG.fuelPerLapKg * strategy.fuel * efficiencyFactor;
    car.fuelLoad = Math.max(0, car.fuelLoad - fuelUsed);

    // ERS battery charge & drain
    const curvature = Math.abs(this.geometry.curvatureAt(progress));
    if (car.ersDeploy && car.ersCharge > 0) {
      car.ersCharge = Math.max(0, car.ersCharge - GAME_CONFIG.ersDrainPerSecond * deltaTime);
      if (car.ersCharge <= 0.01) car.ersDeploy = false;
    } else {
      const brakingHarvest = curvature > 0.22 ? 1.65 : 0.6;
      const modeHarvest = car.strategyMode === 'conserve' ? 1.4 : 1;
      car.ersCharge = Math.min(1, car.ersCharge + GAME_CONFIG.ersChargePerSecond * brakingHarvest * modeHarvest * deltaTime);
    }
  }

  private completeLap(car: CarState, completedLaps: number): void {
    const lapTime = car.currentLapTime;
    const s3 = Math.max(0.1, lapTime - car.sectorStartTime);
    car.sectorTimes[2] = s3;
    if (car.bestSectorTimes[2] === null || s3 < car.bestSectorTimes[2]) car.bestSectorTimes[2] = s3;
    if (this.state.bestSectors[2] === null || s3 < this.state.bestSectors[2]) this.state.bestSectors[2] = s3;

    car.lastLapTime = lapTime;
    car.bestLapTime = car.bestLapTime === null ? lapTime : Math.min(car.bestLapTime, lapTime);

    if (this.state.fastestLapTime === null || lapTime < this.state.fastestLapTime) {
      this.state.fastestLapTime = lapTime;
      this.state.fastestLapCarId = car.id;
      if (completedLaps > 1 || car.isPlayer) {
        this.logEvent(`#${car.number} marcou a melhor volta: ${formatTime(lapTime)}`, 'fastest_lap');
      }
    }

    car.laps.push({
      lap: completedLaps,
      time: lapTime,
      tyre: car.tyreType,
      position: car.position,
      sectors: [...car.sectorTimes] as [number, number, number],
    });
    car.positionHistory.push(car.position);
    car.currentLapTime = 0;
    car.currentSector = 0;
    car.sectorStartTime = 0;
  }

  private beginPitStop(car: CarState, tyre: TyreType): void {
    const fromTyre = car.tyreType;
    const repairDone = car.pendingPitRepair && car.condition < 0.99;
    const repairTime = repairDone ? GAME_CONFIG.pitRepairDuration : 0;
    const duration =
      GAME_CONFIG.pitStopBaseDuration
      + this.random.range(-GAME_CONFIG.pitStopVariation, GAME_CONFIG.pitStopVariation)
      + repairTime;

    car.pendingPitTyre = null;
    car.pendingPitRepair = false;
    car.tyreType = tyre;
    car.pitState = 'stationary';
    car.pitTimeRemaining = duration;
    if (repairDone) {
      car.condition = Math.min(1, car.condition + 0.25);
    }
    car.pitStops.push({ lap: car.lap + 1, duration, fromTyre, toTyre: tyre, repaired: repairDone });
    this.announce(`#${car.number} nos boxes · ${duration.toFixed(1)}s${repairDone ? ' (Reparo)' : ''}`, 'pit');
  }

  private finishCar(car: CarState): void {
    if (car.finished) return;
    car.finished = true;
    car.distance = this.track.length * this.state.totalLaps;
    car.finishTime = car.totalTime;
    car.speed = 0;
    car.ersDeploy = false;
    car.pitState = 'none';
    const finishingPosition = this.state.cars.filter((candidate) => candidate.finished).length;
    this.announce(`#${car.number} terminou em ${finishingPosition}º`, 'flag');
  }

  private updatePositions(): void {
    const previousPositions = new Map<string, number>();
    for (const car of this.state.cars) {
      previousPositions.set(car.id, car.position);
    }

    const sorted = [...this.state.cars].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    });

    sorted.forEach((car, index) => {
      const newPos = index + 1;
      const oldPos = previousPositions.get(car.id) ?? newPos;
      if (newPos < oldPos && this.state.elapsedTime > 1) {
        car.overtakesMade += oldPos - newPos;
        if (car.isPlayer && newPos <= 3 && oldPos > newPos) {
          this.logEvent(`#${car.number} assumiu o ${newPos}º lugar!`, 'overtake');
        }
      }
      car.position = newPos;
    });
    this.state.cars.sort((a, b) => a.position - b.position);
  }

  private getPlayerCar(carId: string): CarState | undefined {
    return this.state.cars.find((car) => car.id === carId && car.isPlayer);
  }

  private announce(message: string, type: RaceEventLog['type'] = 'info'): void {
    this.state.eventMessage = message;
    this.state.eventMessageUntil = this.state.elapsedTime + 3.2;
    this.logEvent(message, type);
  }

  private logEvent(message: string, type: RaceEventLog['type']): void {
    const leaderLap = Math.min(this.state.totalLaps, Math.max(1, (this.state.cars[0]?.lap ?? 0) + 1));
    this.eventCounter += 1;
    this.state.eventLog.unshift({
      id: `evt-${this.eventCounter}`,
      time: this.state.elapsedTime,
      lap: leaderLap,
      message,
      type,
    });
    if (this.state.eventLog.length > 40) {
      this.state.eventLog.length = 40;
    }
  }
}
