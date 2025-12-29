"use client"

import Link from "next/link"
import { useEditorStore } from "@/store/useEditorStore"
import {
  Download,
  Undo2,
  Redo2,
  LayoutTemplate,
  Loader2,
  Cloud,
} from "lucide-react"
import { EditableTitle } from "./EditableTitle"
import { useAutoSave } from "@/hooks/useAutoSave"
import { ThemeToggle } from "@/components/ThemeToggle"

export default function Header() {
  const { canvas, history, canUndo, canRedo, projectName, setProjectName } =
    useEditorStore()

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

  const { status } = useAutoSave()

  return (
    <header className="bg-background relative z-10 flex h-14 items-center justify-between border-b px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-white transition-opacity hover:opacity-80"
        >
          <div className="rounded-lg bg-blue-600 p-1.5 text-white">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <span>Ficva</span>
        </Link>
        <div className="bg-border h-6 w-px" />
        <EditableTitle
          initialValue={projectName}
          onSave={async (newName) => {
            // Optimistic update
            setProjectName(newName)
            // Name saving logic (optional, as auto-save handles it too via projectName dependency)
            // But immediate explicit save for title is good UX.
            // We can leave this or let auto-save handle it.
            // If we let auto-save handle it, we might need to update the hook to watch projectName.
            // (The hook ALREADY watches projectName).
          }}
        />

        <div className="bg-border mx-2 h-6 w-px" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => history.undo()}
            disabled={!canUndo}
            className="rounded p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => history.redo()}
            disabled={!canRedo}
            className="rounded p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Auto-save Status */}
        <div className="text-muted-foreground mr-2 flex items-center text-xs font-medium">
          {status === "saving" && (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Saving...
            </>
          )}
          {status === "saved" && (
            <>
              <Cloud className="mr-1 h-3 w-3" />
              Saved
            </>
          )}
          {status === "error" && (
            <span className="text-red-500">Error saving</span>
          )}
        </div>

        {/* Deprecated Manual Save Button Removed */}

        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>
        <div className="bg-border mx-2 h-6 w-px" />
        <ThemeToggle className="text-zinc-400 hover:bg-zinc-800 hover:text-white" />
      </div>
    </header>
  )
}
