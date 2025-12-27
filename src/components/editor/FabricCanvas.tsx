"use client"

import { useEffect, useRef } from "react"
import { Canvas } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"

export default function FabricCanvas() {
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const { setCanvas, history } = useEditorStore()

  // Track start state for drag operations
  const dragStartRef = useRef<Partial<FabricObject> | null>(null)

  useEffect(() => {
    if (!canvasEl.current) return

    // Initialize Fabric Canvas v7
    // Using a fixed size for MVP 800x600
    const canvas = new Canvas(canvasEl.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
    })

    setCanvas(canvas)

    const updateSelection = () => {
      setCanvas(canvas) // Trigger re-render to update UI if needed
      useEditorStore.getState().setSelectedObjects(canvas.getActiveObjects())
    }

    canvas.on("selection:created", updateSelection)
    canvas.on("selection:updated", updateSelection)
    canvas.on("selection:cleared", updateSelection)

    // History Tracking for Transforms (Move, Scale, Rotate)
    canvas.on("mouse:down", (e) => {
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
    })

    canvas.on("object:modified", (e) => {
      updateSelection() // Sync store

      const target = e.target
      if (!target || !dragStartRef.current) return

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

      dragStartRef.current = null // Reset
    })

    return () => {
      canvas.dispose()
      setCanvas(null)
    }
  }, [setCanvas, history])

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-gray-100">
      <div className="shadow-2xl">
        <canvas ref={canvasEl} />
      </div>
    </div>
  )
}
