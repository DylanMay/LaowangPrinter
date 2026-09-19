import { useEffect, useRef } from 'react'
import { isOutOfBounds } from '@shared/geometry/CoordinateTransformer'
import { drawWorkspace, patternHit } from '../canvas/CanvasRenderer'
import { layoutViewport, pixelToWorkspace } from '../canvas/Viewport'
import { useAppStore } from '../store/appStore'

export function WorkspaceCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef(layoutViewport({ widthMm: 300, heightMm: 200 }, 1, 1))
  const imported = useAppStore((state) => state.imported)
  const placement = useAppStore((state) => state.placement)
  const workArea = useAppStore((state) => state.workArea)
  const moveBy = useAppStore((state) => state.moveBy)
  const scaleBy = useAppStore((state) => state.scaleBy)
  const sceneRef = useRef({ imported, placement, workArea, moveBy, scaleBy })
  const paintRef = useRef(() => undefined as void)

  useEffect(() => {
    sceneRef.current = { imported, placement, workArea, moveBy, scaleBy }
  }, [imported, moveBy, placement, scaleBy, workArea])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const drag = { active: false, lastX: 0, lastY: 0 }

    const paint = () => {
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
      viewportRef.current = viewport
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawWorkspace(
        ctx,
        viewport,
        {
          workArea: scene.workArea,
          document: scene.imported.document,
          placement: scene.placement,
          outOfBounds: isOutOfBounds(scene.placement, scene.workArea),
        },
        dpr,
      )
    }
    paintRef.current = paint
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(host)

    const pointerPos = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const onDown = (event: PointerEvent) => {
      const scene = sceneRef.current
      if (!scene.imported || !scene.placement || !scene.workArea) return
      const workspace = pixelToWorkspace(pointerPos(event), viewportRef.current)
      if (
        !patternHit(
          {
            workArea: scene.workArea,
            document: scene.imported.document,
            placement: scene.placement,
            outOfBounds: false,
          },
          workspace,
        )
      ) {
        return
      }
      drag.active = true
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = 'grabbing'
      event.preventDefault()
    }

    const onMove = (event: PointerEvent) => {
      const scene = sceneRef.current
      if (!scene.imported || !scene.placement || !scene.workArea) return
      if (!drag.active) {
        const workspace = pixelToWorkspace(pointerPos(event), viewportRef.current)
        const over = patternHit(
          {
            workArea: scene.workArea,
            document: scene.imported.document,
            placement: scene.placement,
            outOfBounds: false,
          },
          workspace,
        )
        canvas.style.cursor = over ? 'grab' : 'default'
        return
      }
      const pxPerMm = viewportRef.current.pxPerMm
      scene.moveBy((event.clientX - drag.lastX) / pxPerMm, (event.clientY - drag.lastY) / pxPerMm)
      drag.lastX = event.clientX
      drag.lastY = event.clientY
    }

    const onUp = (event: PointerEvent) => {
      if (!drag.active) return
      drag.active = false
      canvas.releasePointerCapture(event.pointerId)
      canvas.style.cursor = 'grab'
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      sceneRef.current.scaleBy(event.deltaY > 0 ? 0.96 : 1.04)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    paintRef.current()
  }, [imported, placement, workArea])

  return (
    <div ref={hostRef} className="min-h-0 flex-1">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  )
}
