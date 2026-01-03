"use client"

import { useEffect } from "react"
import type { FabricObject } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"

interface EditableObject extends FabricObject {
  isGhost?: boolean
  data?: unknown
}

/**
 * Hook for syncing canvas objects to layer panel.
 *
 * Responsibilities:
 * - Listen to object:added, object:removed, object:modified
 * - Sync layers to store
 * - Ensure loaded objects are selectable
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasLayerSync() {
  const canvas = useEditorStore((s) => s.canvas)
  const syncLayers = useEditorStore((s) => s.syncLayers)

  useEffect(() => {
    if (!canvas) return

    const handleObjectAdded = (e: { target?: FabricObject }) => {
      syncLayers(canvas)

      // Ensure loaded objects are selectable (fix for objects saved during edit mode)
      const obj = e.target as EditableObject
      if (obj && !obj.isGhost && !obj.excludeFromExport) {
        obj.selectable = true
        obj.evented = true
      }
    }

    const handleObjectRemoved = () => {
      syncLayers(canvas)
    }

    const handleObjectModified = () => {
      syncLayers(canvas)
    }

    canvas.on("object:added", handleObjectAdded)
    canvas.on("object:removed", handleObjectRemoved)
    canvas.on("object:modified", handleObjectModified)

    // Initial sync
    syncLayers(canvas)

    return () => {
      canvas.off("object:added", handleObjectAdded)
      canvas.off("object:removed", handleObjectRemoved)
      canvas.off("object:modified", handleObjectModified)
    }
  }, [canvas, syncLayers])
}
