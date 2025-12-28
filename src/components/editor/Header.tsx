"use client"

import Link from "next/link"
import { useEditorStore } from "@/store/useEditorStore"
import { Download, Undo2, Redo2, LayoutTemplate } from "lucide-react"
import { EditableTitle } from "./EditableTitle"
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

            // API Call
            const pathParts = window.location.pathname.split("/")
            const id = pathParts[pathParts.length - 1]
            try {
              await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
              })
            } catch (error) {
              console.error("Failed to update project name", error)
            }
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
        <button
          onClick={async () => {
            const state = useEditorStore.getState()
            const { canvas, pages, activePageId, projectId } = state

            if (!canvas || !projectId) {
              if (!projectId) console.error("No Project ID found")
              return
            }

            // 1. Sync current canvas state to the active page in the pages array
            //    (This ensures the currently visible edits are saved)
            const currentJson = canvas.toObject([
              "id",
              "selectable",
              "name",
              "backgroundColor",
            ])
            // Ensure background color is preserved if not in object (Fabric behavior varies)
            if (!currentJson.backgroundColor) {
              currentJson.backgroundColor = canvas.backgroundColor
            }

            const updatedPages = pages.map((p) =>
              p.id === activePageId ? { ...p, json: currentJson } : p
            )

            // 2. Construct the full project data structure
            const projectData = {
              pages: updatedPages,
              activePageId: activePageId,
            }

            try {
              // optimistically update store in case we continue editing
              // actually we shouldn't mute store here if not needed, but good to have latest state
              // We don't update store here to avoid re-renders, assuming syncLayers/etc handles local state.

              const res = await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  json: projectData,
                  updatedAt: new Date(), // Server handles this but good for explicit intent
                }),
              })

              if (res.ok) {
                // Update store pages to match what we just saved (sync complete)
                // This is important so if we switch pages later, we have the latest "current" page state in the array
                useEditorStore.setState({ pages: updatedPages })
                alert("Presentation saved successfully!")
              } else {
                alert("Failed to save")
              }
            } catch (e) {
              console.error(e)
              alert("Error saving")
            }
          }}
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-white"
        >
          Save
        </button>
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
