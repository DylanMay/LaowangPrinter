import { useEffect, useRef } from 'react'
import { workspacePaths } from '@shared/geometry/CoordinateTransformer'
import { pointAlongPaths, totalPathLength } from '@shared/geometry/polyline'
import { drawWorkspace } from '../canvas/CanvasRenderer'
import { layoutViewport } from '../canvas/Viewport'
import { useAppStore } from '../store/appStore'

const LOOP_MS = 8000

export function PreviewCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const sceneRef = useRef({ imported, placement, workArea })

  useEffect(() => {
    sceneRef.current = { imported, placement, workArea }
  }, [imported, placement, workArea])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    let frame = 0
    const started = performance.now()

    const paint = (now: number) => {
      const scene = sceneRef.current
      if (!scene.imported || !scene.placement || !scene.workArea) return
      const rect = host.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const viewport = layoutViewport(scene.workArea, width, height)
      const paths = workspacePaths(scene.imported.document, scene.placement)
      const total = totalPathLength(paths)
      const t = ((now - started) % LOOP_MS) / LOOP_MS
      const head = total > 0 ? pointAlongPaths(paths, t * total) : null
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawWorkspace(
        ctx,
        viewport,
        {
          workArea: scene.workArea,
          document: scene.imported.document,
          placement: scene.placement,
          outOfBounds: false,
          head,
        },
        dpr,
      )
    }

    const loop = (now: number) => {
      paint(now)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    const observer = new ResizeObserver(() => paint(performance.now()))
    observer.observe(host)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={hostRef} className="min-h-0 flex-1">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
