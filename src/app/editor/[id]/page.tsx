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
  const [isCanvasReady, setIsCanvasReady] = useState(false)

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
  useEffect(() => {
    if (!projectData || !canvas) return

    // If we've already marked it ready, don't re-run this logic
    // (unless we want to support external updates, but for now this is initial load)
    if (useEditorStore.getState().projectId === projectData.id && isCanvasReady)
      return

    // Initialize Store with Project ID
    useEditorStore.getState().setProjectId(projectData.id)

    // Check if data is new multi-page structure or legacy single-page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = projectData.json as any

    const finishLoading = () => {
      setIsCanvasReady(true)
    }

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
          finishLoading()
        })
      } else {
        finishLoading()
      }
    } else if (json && Object.keys(json).length > 0) {
      // Fallback: Legacy single page project
      console.log("Loading legacy single-page project...")

      // Just load directly into canvas as before
      canvas.loadFromJSON(json).then(() => {
        if (!canvas.getElement()) return // Check if disposed
        canvas.requestRenderAll()
        useEditorStore.getState().syncLayers(canvas)

        // Also update store to have at least one page with this content
        const pageId = crypto.randomUUID()
        useEditorStore.setState({
          pages: [{ id: pageId, json: json }],
          activePageId: pageId,
        })
        finishLoading()
      })
    } else {
      // Empty project
      console.log("Empty project, initializing defaults...")
      finishLoading()
    }
  }, [canvas, projectData, isCanvasReady]) // We added isCanvasReady check inside to prevent loop

  return (
    <div className="bg-background text-foreground relative flex h-screen flex-col">
      {/* Loading Overlay */}
      {(!projectData || !isCanvasReady) && (
        <div className="bg-background absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center">
          <div className="relative h-16 w-16">
            {/* Logo or Spinner */}
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20"></div>
            <div className="absolute inset-2 animate-pulse rounded-full bg-blue-600"></div>
          </div>
          <p className="text-muted-foreground mt-4 animate-pulse font-medium">
            Loading Editor...
          </p>
        </div>
      )}

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
