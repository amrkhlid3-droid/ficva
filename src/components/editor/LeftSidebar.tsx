"use client"

import { useEditorStore } from "@/store/useEditorStore"
import AssetLibrary from "@/components/editor/AssetLibrary"
import { ChevronLeft } from "lucide-react"

export default function LeftSidebar() {
  const { activeSidebar, setActiveSidebar } = useEditorStore()

  if (activeSidebar === "none") return null

  return (
    <aside className="bg-background flex h-full w-full flex-col border-r">
      {activeSidebar === "assets" && (
        <>
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="text-foreground font-semibold">My Uploads</h3>
            <button
              onClick={() => setActiveSidebar("none")}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <AssetLibrary refreshKey={0} />
          </div>
        </>
      )}
    </aside>
  )
}
