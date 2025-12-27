"use client"

import Link from "next/link"
import { useEditorStore } from "@/store/useEditorStore"
import { Download, Undo2, Redo2 } from "lucide-react"

export default function Header() {
  const { canvas, history, canUndo, canRedo } = useEditorStore()

  const handleExport = () => {
    if (!canvas) return

    // Export to PNG
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2, // Export at 2x resolution/retina
    })

    const link = document.createElement("a")
    link.download = "ficva-design.png"
    link.href = dataURL
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <header className="relative z-10 flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xl font-bold">
          Ficva
        </Link>
        <div className="h-6 w-px bg-gray-300" />
        <span className="text-sm text-gray-500">Untitled Design</span>

        <div className="mx-2 h-6 w-px bg-gray-300" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => history.undo()}
            disabled={!canUndo}
            className="rounded p-2 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4 text-gray-700" />
          </button>
          <button
            onClick={() => history.redo()}
            disabled={!canRedo}
            className="rounded p-2 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>
      </div>
    </header>
  )
}
