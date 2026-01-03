"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, Undo2, Redo2, Loader2, Cloud } from "lucide-react"

import { useEditorStore } from "@/store/useEditorStore"
import { useAutoSave } from "@/hooks/useAutoSave"
import { EditableTitle } from "./EditableTitle"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Logo } from "@/components/Logo"
import { ExportDialog } from "./ExportDialog"

export default function Header() {
  const {
    history,
    canUndo,
    canRedo,
    projectName,
    setProjectName,
    editingPath,
  } = useEditorStore()

  // Disable undo/redo when in path edit mode
  const isInEditMode = !!editingPath

  // 高级导出对话框状态（模块化：可注释掉禁用）
  const [showExportDialog, setShowExportDialog] = useState(false)

  const { status } = useAutoSave()

  return (
    <header className="bg-background relative z-10 flex h-14 items-center justify-between border-b px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Logo size="sm" showTitle={true} />
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
            disabled={!canUndo || isInEditMode}
            className="rounded p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            title={isInEditMode ? "Exit edit mode to undo" : "Undo (Ctrl+Z)"}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => history.redo()}
            disabled={!canRedo || isInEditMode}
            className="rounded p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            title={
              isInEditMode ? "Exit edit mode to redo" : "Redo (Ctrl+Shift+Z)"
            }
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
          onClick={() => setShowExportDialog(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>

        {/* 高级导出对话框（模块化：可注释掉禁用） */}
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
        />
        <div className="bg-border mx-2 h-6 w-px" />
        <ThemeToggle className="text-zinc-400 hover:bg-zinc-800 hover:text-white" />
      </div>
    </header>
  )
}
