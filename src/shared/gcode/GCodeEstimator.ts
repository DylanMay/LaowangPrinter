import { totalPathLength } from '@shared/geometry/polyline'

export function estimateTimeSeconds(cutLengthMm: number, feedMmPerMin: number): number {
  if (cutLengthMm <= 0 || feedMmPerMin <= 0) return 0
  return (cutLengthMm / feedMmPerMin) * 60
}

export function estimatePathsSeconds(
  paths: { points: { x: number; y: number }[] }[],
  feedMmPerMin: number,
): number {
  return estimateTimeSeconds(totalPathLength(paths), feedMmPerMin)
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 秒'
  const total = Math.max(1, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes === 0) return `${rest} 秒`
  if (rest === 0) return `${minutes} 分`
  return `${minutes} 分 ${rest} 秒`
}
