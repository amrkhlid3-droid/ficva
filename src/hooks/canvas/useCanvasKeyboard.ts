"use client"

import { useEffect, useCallback } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { RemoveObjectsCommand } from "@/lib/editor/history/commands/RemoveObjectsCommand"

export interface KeyboardOptions {
  /** Enable undo/redo shortcuts (Ctrl+Z, Ctrl+Shift+Z) */
  enableUndoRedo?: boolean
  /** Enable delete shortcuts (Delete, Backspace) */
  enableDelete?: boolean
}

/**
 * Hook for handling canvas keyboard shortcuts.
 *
 * Responsibilities:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: Redo
 * - Delete / Backspace: Delete selected objects
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasKeyboard(options: KeyboardOptions = {}) {
  const { enableUndoRedo = true, enableDelete = true } = options

  const canvas = useEditorStore((s) => s.canvas)
  const history = useEditorStore((s) => s.history)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!canvas) return

      // Ignore if user is typing in an input field
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // Undo/Redo
      if (enableUndoRedo && isCtrlOrMeta && e.key === "z") {
        e.preventDefault()

        // Disable undo/redo in edit mode
        const { editingPath } = useEditorStore.getState()
        if (editingPath) return

        if (e.shiftKey) {
          history.redo()
        } else {
          history.undo()
        }
      }

      // Delete
      if (enableDelete && ["Backspace", "Delete"].includes(e.key)) {
        const activeObjects = [...canvas.getActiveObjects()]

        if (activeObjects.length > 0) {
          canvas.discardActiveObject()
          canvas.requestRenderAll()

          const canvasObjects = canvas.getObjects()
          const validObjects = activeObjects.filter((obj) =>
            canvasObjects.includes(obj)
          )

          if (validObjects.length > 0) {
            const command = new RemoveObjectsCommand(canvas, validObjects)
            history.execute(command)
          }
        }
      }
    },
    [canvas, history, enableUndoRedo, enableDelete]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])
}
