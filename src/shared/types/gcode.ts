import type { Bounds } from '@shared/types/workspace'

export type GCodeDocument = {
  lines: string[]
  estimatedTime: number
  bounds: Bounds
}
