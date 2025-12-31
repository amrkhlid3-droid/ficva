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
  updatedAt?: string
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

    const store = useEditorStore.getState()

    // Helper to finish loading
    const finishLoading = () => {
      setIsCanvasReady(true)
    }

    // Scenario 1: Project ID matches and we have pages in store.
    // This implies we are re-mounting (e.g. layout change) or re-hydrating.
    // We should trust the STORE state (which may have unsaved changes) over projectData.
    if (store.projectId === projectData.id && store.pages.length > 0) {
      console.log("Restoring editor state from store (Remount)...")
      const activePage =
        store.pages.find((p) => p.id === store.activePageId) || store.pages[0]

      if (activePage && activePage.json) {
        canvas.loadFromJSON(activePage.json).then(() => {
          if (!canvas.getElement()) return
          canvas.requestRenderAll()

          useEditorStore.getState().syncLayers(canvas)
          finishLoading()
        })
      } else {
        finishLoading()
      }
      return
    }

    // Scenario 2: First load or Project Switch. Trust projectData.
    store.setProjectId(projectData.id)

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
      console.log("Loading multi-page project from server...")
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

      if (
        params.id &&
        typeof params.id === "string" &&
        projectData &&
        params.id === projectData.id
      ) {
        // --- Conflict Resolution Logic ---
        import("@/utils/storage").then(
          ({ loadFromLocalStorage, saveToLocalStorage }) => {
            // Assuming 'toast' is available, e.g., from a context or imported
            // import { toast } from "@/components/ui/use-toast"
            const localData = loadFromLocalStorage(params.id as string)
            let finalData = projectData

            if (localData) {
              const serverTime = projectData.updatedAt
                ? new Date(projectData.updatedAt).getTime()
                : 0
              const localTime = localData.timestamp

              console.log(
                "[Sync] Server Ts:",
                serverTime,
                "Local Ts:",
                localTime
              )

              if (localData.unsavedChanges && localTime > serverTime) {
                console.log("[Sync] Conflict: Local is newer. Using Local.")
                // toast({
                //     title: "Unsaved changes restored",
                //     description: "We recovered your unsaved changes from this device.",
                // })
                // Use local data
                // Map local structure to match API response structure roughly where needed
                // The API returns { data: { json: { pages... } } }
                // Local Storage has { data: { pages... } }
                // We need to feed the store with the 'pages' and 'activePageId'

                // Actually, the store initializes from `projectData` which expects { pages: [], activePageId: ... }
                // The API response `result.data.json` matches this structure.
                // Local storage `localData.data` also matches this structure.

                finalData = {
                  ...projectData,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  json: localData.data as any,
                }

                // Trigger an immediate save to sync this back to server?
                // The store update below will trigger useAutoSave, which will debounce save.
                // That is verifying.
              } else {
                console.log("[Sync] Server is newer or synced. Updating Local.")
                // Update local storage to match server to avoid future stale usage
                saveToLocalStorage(
                  params.id as string,
                  {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pages: (projectData.json as any).pages,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    activePageId: (projectData.json as any).activePageId,
                    projectName: projectData.name,
                  },
                  false
                )
              }
            }

            // Initialize Store
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (finalData.json && (finalData.json as any).pages) {
              // Ensure activePageId is valid
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let initialActiveId = (finalData.json as any).activePageId
              if (
                !initialActiveId &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (finalData.json as any).pages.length > 0
              ) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                initialActiveId = (finalData.json as any).pages[0].id
              }

              useEditorStore.setState({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pages: (finalData.json as any).pages,
                activePageId: initialActiveId,
                // Use name from server or local? Local might have new name?
                // If local won, we should probably use local name too if we stored it?
                // The local storage stores `projectName` in `data`.
                // So if local won, finalData.json is localData.data.
                // But `projectName` is top level property in API, but inside `data` in local.
                projectName:
                  localData &&
                  localData.unsavedChanges &&
                  localData.timestamp >
                    (projectData.updatedAt
                      ? new Date(projectData.updatedAt).getTime()
                      : 0)
                    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (localData.data as any).projectName
                    : finalData.name,
                projectId: params.id as string,
              })
              // Load active page into canvas
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const activePage = (finalData.json as any).pages.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (p: any) => p.id === initialActiveId
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
            } else if (
              finalData.json &&
              Object.keys(finalData.json).length > 0
            ) {
              // Fallback: Legacy single page project (after conflict resolution)
              console.log(
                "Loading legacy single-page project (after conflict resolution)..."
              )
              canvas.loadFromJSON(finalData.json).then(() => {
                if (!canvas.getElement()) return // Check if disposed
                canvas.requestRenderAll()
                useEditorStore.getState().syncLayers(canvas)

                // Also update store to have at least one page with this content
                const pageId = crypto.randomUUID()
                useEditorStore.setState({
                  pages: [{ id: pageId, json: finalData.json }],
                  activePageId: pageId,
                  projectName: finalData.name, // Ensure name is set
                  projectId: params.id as string,
                })
                finishLoading()
              })
            } else {
              // Empty project after conflict resolution
              console.log(
                "Empty project, initializing defaults (after conflict resolution)..."
              )
              const pageId = crypto.randomUUID()
              useEditorStore.setState({
                pages: [
                  {
                    id: pageId,
                    json: {
                      version: "5.3.0",
                      objects: [],
                      backgroundColor: "#ffffff",
                    },
                  },
                ],
                activePageId: pageId,
                projectName: finalData.name,
                projectId: params.id as string,
              })
              finishLoading()
            }
          }
        )
      } else {
        // Original legacy single page project loading if conflict resolution not applicable
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
      }
    } else {
      // Empty project
      console.log("Empty project, initializing defaults...")
      // Initialize store with one empty page
      const pageId = crypto.randomUUID()
      useEditorStore.setState({
        pages: [{ id: pageId, json: {} }],
        activePageId: pageId,
      })
      finishLoading()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, projectData]) // dependency on isCanvasReady removed to allow re-runs on canvas change

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
          <div className="bg-background flex w-75 flex-col border-r">
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
        <div className="bg-background flex w-75 flex-col border-l">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
