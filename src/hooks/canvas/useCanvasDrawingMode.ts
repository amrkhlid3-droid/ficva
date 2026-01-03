"use client"

import { useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * Hook for syncing drawing mode settings to canvas.
 *
 * Responsibilities:
 * - Sync isDrawingMode to canvas.isDrawingMode
 * - Sync brush color and width to freeDrawingBrush
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasDrawingMode() {
  const isDrawingMode = useEditorStore((s) => s.isDrawingMode)
  const brushColor = useEditorStore((s) => s.brushColor)
  const brushWidth = useEditorStore((s) => s.brushWidth)

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    canvas.isDrawingMode = isDrawingMode

    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = brushColor
      canvas.freeDrawingBrush.width = brushWidth
    }
  }, [isDrawingMode, brushColor, brushWidth])
}
