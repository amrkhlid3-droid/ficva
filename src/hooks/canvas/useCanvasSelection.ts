"use client"

import { useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * Hook for handling canvas selection events.
 *
 * Responsibilities:
 * - Listen to selection:created, selection:updated, selection:cleared
 * - Sync selected objects to store
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasSelection() {
  const canvas = useEditorStore((s) => s.canvas)
  const setSelectedObjects = useEditorStore((s) => s.setSelectedObjects)

  useEffect(() => {
    if (!canvas) return

    const updateSelection = () => {
      setSelectedObjects(canvas.getActiveObjects())
    }

    canvas.on("selection:created", updateSelection)
    canvas.on("selection:updated", updateSelection)
    canvas.on("selection:cleared", updateSelection)

    return () => {
      canvas.off("selection:created", updateSelection)
      canvas.off("selection:updated", updateSelection)
      canvas.off("selection:cleared", updateSelection)
    }
  }, [canvas, setSelectedObjects])
}
