"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import Toolbar from "@/components/editor/Toolbar"
import Header from "@/components/editor/Header"
import FabricCanvas from "@/components/editor/FabricCanvas"
import RightSidebar from "@/components/editor/RightSidebar"
import ContextMenu from "@/components/editor/ContextMenu"
import { useEditorStore } from "@/store/useEditorStore"

interface ProjectData {
  id: string
  name: string
  json: Record<string, unknown>
}

export default function EditorPage() {
  const params = useParams()
  const { canvas } = useEditorStore()
  const [projectData, setProjectData] = useState<ProjectData | null>(null)

  // Fetch project data (JSON)
  useEffect(() => {
    if (params.id) {
      fetch(`/api/projects/${params.id}`)
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error("Failed to load project")
        })
        .then((data) => {
          setProjectData(data)
        })
        .catch((err) => console.error(err))
    }
  }, [params.id])

  // Load JSON into Canvas when both are ready
  // We use a flag 'loaded' to prevent re-loading if not needed,
  // though simple check is effectively: if canvas is empty? or just once on mount?
  // Use a ref or simple check to ensure we only load once per project load.
  useEffect(() => {
    if (
      canvas &&
      projectData &&
      projectData.json &&
      Object.keys(projectData.json).length > 0
    ) {
      // Avoid overwriting if user already started editing?
      // For now, assume this runs on initial load.
      // We might check if canvas is empty.
      const objects = canvas.getObjects()
      if (objects.length === 0) {
        canvas.loadFromJSON(projectData.json, () => {
          canvas.requestRenderAll()
          console.log("Project loaded into canvas")
        })
      }
    }
  }, [canvas, projectData])

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      {/* Header (Top Layer) */}
      <Header />

      {/* Main Workspace with Resizable Panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full items-stretch"
        >
          {/* Left Sidebar (Resources/Tools) */}
          <ResizablePanel defaultSize={25} className="border-r">
            <Toolbar />
          </ResizablePanel>

          <ResizableHandle />

          {/* Center Canvas */}
          <ResizablePanel defaultSize={50}>
            <main className="relative flex h-full w-full flex-1 flex-col overflow-hidden bg-gray-100 dark:bg-zinc-900/50">
              <div className="relative flex-1">
                <FabricCanvas />
                <ContextMenu />
              </div>
            </main>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Sidebar (Properties/Layers) */}
          <ResizablePanel defaultSize={25} className="border-l">
            <RightSidebar />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
