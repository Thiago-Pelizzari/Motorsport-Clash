export interface MarkerPosition {
  id: string;
  x: number;
  y: number;
  radius: number;
  raceDistance: number;
}

const MAX_RELEVANT_TRACK_GAP = 65;
const SEPARATION_PASSES = 10;

export function separateMarkers(markers: MarkerPosition[], trackLength: number): MarkerPosition[] {
  const separated = markers.map((marker) => ({ ...marker }));

  for (let pass = 0; pass < SEPARATION_PASSES; pass += 1) {
    for (let firstIndex = 0; firstIndex < separated.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < separated.length; secondIndex += 1) {
        const first = separated[firstIndex];
        const second = separated[secondIndex];
        if (wrappedGap(first.raceDistance, second.raceDistance, trackLength) > MAX_RELEVANT_TRACK_GAP) continue;

        let differenceX = second.x - first.x;
        let differenceY = second.y - first.y;
        let distance = Math.hypot(differenceX, differenceY);
        const minimumDistance = first.radius + second.radius + 2;
        if (distance >= minimumDistance) continue;
        if (distance < 0.001) {
          const angle = ((firstIndex * 7 + secondIndex * 11) % 12) * Math.PI / 6;
          differenceX = Math.cos(angle);
          differenceY = Math.sin(angle);
          distance = 1;
        }

        const correction = (minimumDistance - distance) / 2 + 0.05;
        const normalX = differenceX / distance;
        const normalY = differenceY / distance;
        first.x -= normalX * correction;
        first.y -= normalY * correction;
        second.x += normalX * correction;
        second.y += normalY * correction;
      }
    }
  }
  return separated;
}

function wrappedGap(firstDistance: number, secondDistance: number, trackLength: number): number {
  const directGap = Math.abs(firstDistance - secondDistance) % trackLength;
  return Math.min(directGap, trackLength - directGap);
}
