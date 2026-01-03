"use client"

import { useEffect } from "react"
import { Circle, FabricObject } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"

interface ControlPoint extends Circle {
  line?: { set: (props: object) => void; setCoords: () => void }
  data?: {
    type: "anchor" | "handle_in" | "handle_out"
    nodeIndex: number
  }
}

export interface ZoomScalingOptions {
  /** Ref to control points array */
  controlsRef: React.MutableRefObject<FabricObject[]>
  /** Ref to the editing path */
  editingPathRef: React.MutableRefObject<unknown>
}

/**
 * Hook for updating control point sizes when zoom changes.
 *
 * Responsibilities:
 * - Update control point radius inversely with zoom
 * - Update control line stroke width
 * - Update hover indicator size
 * - Update canvas rendering quality
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasZoomScaling({
  controlsRef,
  editingPathRef,
}: ZoomScalingOptions) {
  const canvas = useEditorStore((s) => s.canvas)
  const zoom = useEditorStore((s) => s.zoom)

  useEffect(() => {
    if (!canvas) return

    // Update canvas rendering quality for crisp display
    const canvasElement = canvas.getElement()
    if (canvasElement) {
      const ctx = canvasElement.getContext("2d")
      if (ctx) {
        ctx.imageSmoothingEnabled = zoom <= 1
        ctx.imageSmoothingQuality = "high"
      }
    }

    // Update all control points with inverse zoom scaling
    if (controlsRef.current.length > 0) {
      controlsRef.current.forEach((ctrl) => {
        const cp = ctrl as ControlPoint
        const data = cp.data
        if (!data) return

        const baseRadius = data.type === "anchor" ? 5 : 3
        const baseStrokeWidth = 1
        const basePadding = data.type === "anchor" ? 10 : 5

        cp.set({
          radius: baseRadius / zoom,
          strokeWidth: baseStrokeWidth / zoom,
          padding: basePadding / zoom,
        })
        cp.setCoords()

        // Update associated line strokeWidth
        if (cp.line) {
          cp.line.set({ strokeWidth: 1 / zoom })
          cp.line.setCoords()
        }
      })
    }

    // Update hover indicator size if it exists
    if (editingPathRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathAny = editingPathRef.current as any
      const state = pathAny._ghostHoverState
      if (state?.hoverIndicator) {
        state.hoverIndicator.set({
          radius: 6 / zoom,
          strokeWidth: 2 / zoom,
        })
        state.hoverIndicator.setCoords()
      }
    }

    canvas.requestRenderAll()
  }, [canvas, zoom, controlsRef, editingPathRef])
}
