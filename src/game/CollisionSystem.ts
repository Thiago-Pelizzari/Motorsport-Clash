import { GAME_CONFIG } from './gameConfig';
import type { CarState } from '../types/race';

const COLLISION_DISTANCE = GAME_CONFIG.collisionDistanceMetres ?? 16;
const COLLISION_LANE_DISTANCE = GAME_CONFIG.collisionLaneDistance ?? 20;
const MAXIMUM_LANE_OFFSET = GAME_CONFIG.maximumLaneOffset ?? 17;
const COLLISION_COOLDOWN = GAME_CONFIG.collisionCooldown ?? 0.75;
const RESOLUTION_PASSES = 4;

export interface CollisionEvent {
  first: CarState;
  second: CarState;
  impact: number;
}

export function resolveCarCollisions(cars: CarState[], trackLength: number): CollisionEvent[] {
  const activeCars = cars.filter((car) => !car.finished && car.pitTimeRemaining <= 0 && car.distance >= 0);
  const events: CollisionEvent[] = [];
  const registeredContacts = new Set<string>();

  for (let pass = 0; pass < RESOLUTION_PASSES; pass += 1) {
    for (let firstIndex = 0; firstIndex < activeCars.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < activeCars.length; secondIndex += 1) {
        const first = activeCars[firstIndex];
        const second = activeCars[secondIndex];
        const signedGap = signedTrackGap(first.distance, second.distance, trackLength);
        const longitudinalGap = Math.abs(signedGap);
        const lateralGap = Math.abs(first.laneOffset - second.laneOffset);
        const overlap = (longitudinalGap / COLLISION_DISTANCE) ** 2 + (lateralGap / COLLISION_LANE_DISTANCE) ** 2;
        if (!Number.isFinite(overlap) || overlap >= 1) continue;

        const ahead = signedGap >= 0 ? first : second;
        const behind = signedGap >= 0 ? second : first;
        const impact = Math.max(0, behind.speed - ahead.speed);
        const separationSide = first.laneOffset === second.laneOffset
          ? (first.position % 2 === 0 ? 1 : -1)
          : Math.sign(first.laneOffset - second.laneOffset);

        const desiredLateralGap = COLLISION_LANE_DISTANCE * Math.sqrt(Math.max(0, 1 - (longitudinalGap / COLLISION_DISTANCE) ** 2));
        const lateralCorrection = Math.min(6, Math.max(0, desiredLateralGap - lateralGap) * 0.55);
        first.laneOffset = clampLane(first.laneOffset + separationSide * lateralCorrection);
        second.laneOffset = clampLane(second.laneOffset - separationSide * lateralCorrection);
        first.targetLaneOffset = clampLane(first.laneOffset + separationSide * 6);
        second.targetLaneOffset = clampLane(second.laneOffset - separationSide * 6);

        const correctedLateralGap = Math.abs(first.laneOffset - second.laneOffset);
        const requiredLongitudinalGap = COLLISION_DISTANCE * Math.sqrt(Math.max(0, 1 - (correctedLateralGap / COLLISION_LANE_DISTANCE) ** 2));
        behind.distance -= Math.max(0, requiredLongitudinalGap - longitudinalGap) + 0.15;

        const sharedSpeed = Math.max(25, ahead.speed * 0.985);
        behind.speed = Math.min(behind.speed, sharedSpeed - Math.min(8, impact * 0.22));
        ahead.speed = Math.max(ahead.speed, Math.min(behind.speed + 3, ahead.speed + impact * 0.06));

        const pairKey = first.id < second.id ? `${first.id}:${second.id}` : `${second.id}:${first.id}`;
        if (!registeredContacts.has(pairKey) && first.collisionCooldown <= 0 && second.collisionCooldown <= 0) {
          const damage = Math.min(0.018, 0.0025 + impact * 0.00035);
          first.condition = Math.max(0.72, first.condition - damage);
          second.condition = Math.max(0.72, second.condition - damage);
          first.contactCount += 1;
          second.contactCount += 1;
          events.push({ first, second, impact });
          registeredContacts.add(pairKey);
        }
        first.collisionCooldown = COLLISION_COOLDOWN;
        second.collisionCooldown = COLLISION_COOLDOWN;
      }
    }
  }
  return events;
}

function signedTrackGap(firstDistance: number, secondDistance: number, trackLength: number): number {
  let gap = ((firstDistance - secondDistance) % trackLength + trackLength) % trackLength;
  if (gap > trackLength / 2) gap -= trackLength;
  return gap;
}

function clampLane(offset: number): number {
  return Math.max(-MAXIMUM_LANE_OFFSET, Math.min(MAXIMUM_LANE_OFFSET, offset));
}
