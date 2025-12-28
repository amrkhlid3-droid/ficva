"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

import Toolbar from "@/components/editor/Toolbar"
import Header from "@/components/editor/Header"
import FabricCanvas from "@/components/editor/FabricCanvas"
import RightSidebar from "@/components/editor/RightSidebar"
import LeftSidebar from "@/components/editor/LeftSidebar"
import ContextMenu from "@/components/editor/ContextMenu"
import SlideList from "@/components/editor/slides/SlideList"
import { useEditorStore } from "@/store/useEditorStore"

interface ProjectData {
  id: string
  name: string
  json: Record<string, unknown>
}

export default function EditorPage() {
  const params = useParams()
  const { canvas, activeSidebar } = useEditorStore()
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
          // Sync name to store
          useEditorStore
            .getState()
            .setProjectName(data.name || "Untitled Design")
        })
        .catch((err) => console.error(err))
    }
  }, [params.id])

  // Load JSON into Canvas when both are ready
  // We use a flag 'loaded' to prevent re-loading if not needed,
  // though simple check is effectively: if canvas is empty? or just once on mount?
  // Use a ref or simple check to ensure we only load once per project load.
  // Load data into Store & Canvas
  useEffect(() => {
    if (!projectData || !canvas) return

    // Initialize Store with Project ID
    useEditorStore.getState().setProjectId(projectData.id)

    // Check if data is new multi-page structure or legacy single-page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = projectData.json as any

    // Check for "pages" key indicating new structure
    if (
      json &&
      json.pages &&
      Array.isArray(json.pages) &&
      json.pages.length > 0
    ) {
      console.log("Loading multi-page project...")
      const { pages, activePageId } = json

      // Update Store
      useEditorStore.setState({
        pages: pages,
        activePageId: activePageId || pages[0].id,
      })

      // Load active page into canvas
      const activePage = pages.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.id === (activePageId || pages[0].id)
      )
      if (activePage && activePage.json) {
        canvas.loadFromJSON(activePage.json).then(() => {
          if (!canvas.getElement()) return // Check if disposed
          canvas.requestRenderAll()
          useEditorStore.getState().syncLayers(canvas)
        })
      }
    } else if (json && Object.keys(json).length > 0) {
      // Fallback: Legacy single page project
      // Convert to multi-page structure in Store (but don't save to DB until user clicks save)
      console.log("Loading legacy single-page project...")

      // Just load directly into canvas as before
      canvas.loadFromJSON(json).then(() => {
        if (!canvas.getElement()) return // Check if disposed
        canvas.requestRenderAll()
        useEditorStore.getState().syncLayers(canvas)

        // Also update store to have at least one page with this content
        // effectively "migrating" it in memory
        const pageId = crypto.randomUUID()
        useEditorStore.setState({
          pages: [{ id: pageId, json: json }],
          activePageId: pageId,
        })
      })
    } else {
      // Empty project
      console.log("Empty project, initializing defaults...")
      // Store already has default empty page from initialization if needed,
      // or we can ensure it here.
    }
  }, [canvas, projectData])

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      {/* Header (Top Layer) */}
      <Header />

      {/* Main Workspace with Fixed Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed Toolbar (Left Strip) */}
        <Toolbar />

        {/* Left Sidebar (Collapsible, Fixed Width) */}
        {activeSidebar !== "none" && (
          <div className="bg-background flex w-[300px] flex-col border-r">
            <LeftSidebar />
          </div>
        )}

        {/* Center Canvas (Flexible) */}
        <main className="bg-muted/30 relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex-1">
            <FabricCanvas />
            <ContextMenu />
          </div>
          {/* Bottom Filmstrip */}
          <div className="bg-background h-32 shrink-0 border-t">
            <SlideList />
          </div>
        </main>

        {/* Right Sidebar (Fixed Width) */}
        <div className="bg-background flex w-[300px] flex-col border-l">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
