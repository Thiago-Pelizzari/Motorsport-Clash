export function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${minutes}:${remaining.toFixed(3).padStart(6, '0')}`;
}

export function formatShortTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds.toFixed(3)}s`;
  return formatTime(seconds);
}

export function formatGap(seconds: number): string {
  if (seconds <= 0.05) return 'LÍDER';
  return `+${seconds.toFixed(1)}s`;
}

export function formatInterval(seconds: number): string {
  if (seconds <= 0.02) return '—';
  return `+${seconds.toFixed(1)}s`;
}

export function ordinal(position: number): string {
  return `${position}º`;
}
