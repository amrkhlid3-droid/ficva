"use client"

import { useEffect, useState } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { Trash2 } from "lucide-react"
import { RemoveObjectCommand } from "@/lib/editor/history/commands/RemoveObjectCommand"

export default function ContextMenu() {
  const { canvas, history } = useEditorStore()
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  )
  const [hasTarget, setHasTarget] = useState(false)

  useEffect(() => {
    if (!canvas) return

    // Use Fabric's event system
    const handleContextMenu = (opt: any) => {
      const e = opt.e as MouseEvent
      e.preventDefault()

      const target = opt.target

      if (target) {
        canvas.setActiveObject(target)
        canvas.requestRenderAll()
        setHasTarget(true)
        // Use raw client coordinates from the original event
        setPosition({ x: e.clientX, y: e.clientY })
      } else {
        setHasTarget(false)
        setPosition(null)
      }
    }

    const handleClick = () => {
      if (position) setPosition(null)
    }

    canvas.on("contextmenu", handleContextMenu)
    window.addEventListener("click", handleClick)
    window.addEventListener("scroll", handleClick, true) // Close on scroll too

    return () => {
      canvas.off("contextmenu", handleContextMenu)
      window.removeEventListener("click", handleClick)
      window.removeEventListener("scroll", handleClick, true)
    }
  }, [canvas, position])

  const handleDelete = () => {
    if (!canvas) return
    const activeObjects = [...canvas.getActiveObjects()] // Clone array
    if (activeObjects.length > 0) {
      canvas.discardActiveObject()
      canvas.requestRenderAll()

      activeObjects.forEach((obj) => {
        const command = new RemoveObjectCommand(canvas, obj)
        history.execute(command)
      })
      canvas.requestRenderAll()
    }
    setPosition(null)
  }

  if (!position || !hasTarget) return null

  return (
    <div
      className="animate-in fade-in zoom-in-95 fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={handleDelete}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
      >
        <Trash2 className="h-4 w-4" />
        <span>Delete</span>
      </button>
    </div>
  )
}
