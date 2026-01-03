"use client"

import { useEffect, useRef } from "react"
import { FabricObject } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"

/**
 * Hook for tracking canvas history (undo/redo for transforms).
 *
 * Responsibilities:
 * - Track object transform start state on mouse:down
 * - Create ModifyObjectCommand on object:modified
 * - Push commands to history manager
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasHistory() {
  const canvas = useEditorStore((s) => s.canvas)
  const history = useEditorStore((s) => s.history)

  // Track start state for drag operations
  const dragStartRef = useRef<Partial<FabricObject> | null>(null)

  useEffect(() => {
    if (!canvas) return

    const handleMouseDown = (e: { target?: FabricObject }) => {
      if (e.target) {
        // Capture specific transform properties
        dragStartRef.current = {
          left: e.target.left,
          top: e.target.top,
          scaleX: e.target.scaleX,
          scaleY: e.target.scaleY,
          angle: e.target.angle,
        }
      }
    }

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const target = e.target
      if (!target || !dragStartRef.current) return

      // Skip control points and ghost paths (edit mode internal objects)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetAny = target as any
      if (targetAny.excludeFromExport || targetAny.isGhost || targetAny.data) {
        dragStartRef.current = null
        return
      }

      const originalState = dragStartRef.current
      const newState = {
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
      }

      // Check if anything actually changed (avoid micro-movements or clicks)
      const hasChanged = Object.keys(newState).some(
        (key) =>
          newState[key as keyof typeof newState] !==
          originalState[key as keyof typeof originalState]
      )

      if (hasChanged) {
        const command = new ModifyObjectCommand(target, newState, originalState)
        history.push(command)
      }

      dragStartRef.current = null
    }

    canvas.on("mouse:down", handleMouseDown)
    canvas.on("object:modified", handleObjectModified)

    return () => {
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("object:modified", handleObjectModified)
    }
  }, [canvas, history])
}
