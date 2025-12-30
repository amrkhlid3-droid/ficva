import { create } from "zustand"
// Removed immer middleware to handle raw Canvas objects correctly
import type { Canvas, FabricObject } from "fabric"
import { HistoryManager } from "@/lib/editor/history/HistoryManager"

export interface Page {
  id: string
  thumbnail?: string // Base64 image
  json: object // Fabric.js serialization data
  background?: string
}

export interface PenToolConfig {
  stroke: string
  strokeWidth: number
  strokeDashArray: number[] | null
  strokeLineCap: "butt" | "round" | "square"
  strokeLineJoin: "miter" | "round" | "bevel"
}

interface EditorState {
  canvas: Canvas | null
  // Drawing State
  isDrawingMode: boolean
  brushColor: string
  brushWidth: number
  pages: Page[]
  activePageId: string
  selectedObjects: FabricObject[]
  layers: FabricObject[]
  history: HistoryManager
  canUndo: boolean
  canRedo: boolean
  activeSidebar: "none" | "assets"
  projectName: string
  projectId: string | null
  penToolConfig: PenToolConfig

  editingPath: FabricObject | null
}

interface EditorActions {
  setCanvas: (canvas: Canvas | null) => void
  setSelectedObjects: (objects: FabricObject[]) => void
  syncLayers: (canvas?: Canvas) => void
  updateHistoryState: () => void
  setActiveSidebar: (sidebar: "none" | "assets") => void
  setProjectName: (name: string) => void
  setProjectId: (id: string) => void

  setEditingPath: (path: FabricObject | null) => void

  // Tool State
  activeTool: "select" | "hand" | "draw" | "pen"
  setActiveTool: (tool: "select" | "hand" | "draw" | "pen") => void
  setPenToolConfig: (config: Partial<PenToolConfig>) => void

  addPage: () => void
  duplicatePage: (id: string) => void
  reorderPages: (oldIndex: number, newIndex: number) => void
  removePage: (id: string) => void
  setActivePage: (id: string) => void
  updatePage: (id: string, updates: Partial<Page>) => void

  // Drawing Actions
  toggleDrawingMode: (enabled?: boolean) => void
  setBrushColor: (color: string) => void
  setBrushWidth: (width: number) => void
}

const historyManager = new HistoryManager()

export const useEditorStore = create<EditorState & EditorActions>()((
  set,
  get
) => {
  return {
    canvas: null,
    pages: [],
    activePageId: "",
    selectedObjects: [],
    layers: [],
    history: historyManager,
    canUndo: false, // Fix missing property
    canRedo: false,
    activeSidebar: "none",
    projectName: "Untitled Design",
    projectId: null,

    // Drawing Defaults
    isDrawingMode: false,
    brushColor: "#000000",
    brushWidth: 5,

    // Pen Tool Defaults
    penToolConfig: {
      stroke: "#000000",
      strokeWidth: 2,
      strokeDashArray: null,
      strokeLineCap: "round",
      strokeLineJoin: "round",
    },

    // Tool Defaults
    activeTool: "select",
    setActiveTool: (tool) =>
      set(() => ({
        activeTool: tool,
        // Sync legacy isDrawingMode
        isDrawingMode: tool === "draw",
      })),

    setPenToolConfig: (config) =>
      set((state) => ({
        penToolConfig: { ...state.penToolConfig, ...config },
      })),

    setProjectName: (name) => set({ projectName: name }),
    setProjectId: (id) => set({ projectId: id }),

    // Path Editing State

    editingPath: null,

    setEditingPath: (path) => set({ editingPath: path }),

    setCanvas: (canvas) => {
      set({ canvas })

      // Initialize with one empty page if none exist
      const state = get()
      if (canvas && state.pages.length === 0) {
        const initialPageId = "default-page"
        set({
          pages: [
            {
              id: initialPageId,
              json: {
                version: "5.3.0",
                objects: [],
                backgroundColor: "#ffffff", // Explicit default white
              },
            },
          ],
          activePageId: initialPageId,
        })
      }
    },

    setSelectedObjects: (selectedObjects) => set({ selectedObjects }),

    syncLayers: (externalCanvas?: Canvas) => {
      const state = get()
      const targetCanvas = externalCanvas || state.canvas

      if (targetCanvas) {
        const objs = targetCanvas.getObjects() as FabricObject[]
        const seenIds = new Set<string>()
        const uniqueObjects: FabricObject[] = []

        objs.forEach((obj) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let id = (obj as any).id

          if (
            obj.type === "activeSelection" ||
            (obj.type === "group" &&
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (obj as any)._isActiveSelection)
          ) {
            return
          }

          if (!id || seenIds.has(id)) {
            const oldId = id
            id = crypto.randomUUID()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(obj as any).set("id", id)
            console.warn(
              `[syncLayers] Duplicate/Missing ID detected. Renaming ${obj.type} from ${oldId} to ${id}`
            )
          }

          seenIds.add(id)
          uniqueObjects.push(obj)
        })

        set({ layers: [...uniqueObjects].reverse() })
      }
    },

    updateHistoryState: () =>
      set({
        canUndo: historyManager.canUndo,
        canRedo: historyManager.canRedo,
      }),

    setActiveSidebar: (activeSidebar) => set({ activeSidebar }),

    // --- Page Management Actions ---

    addPage: () => {
      const newPageId = crypto.randomUUID()
      // Create new page
      const newPage: Page = {
        id: newPageId,
        json: {
          version: "5.3.0",
          objects: [],
          backgroundColor: "#ffffff",
        },
      }

      set((state) => {
        const newPages = [...state.pages, newPage]
        if (state.projectId) {
          import("@/utils/storage").then(({ saveToLocalStorage }) => {
            saveToLocalStorage(state.projectId!, {
              pages: newPages,
              activePageId: newPageId,
              projectName: state.projectName,
            })
          })
        }
        return { pages: newPages }
      })
      get().setActivePage(newPageId)
      // Trigger immediate server sync check in useAutoSave via a flag or just let the hook handle it?
      // Since useAutoSave watches pages, it will pick this up.
      // AND we want IMMEDIATE sync for structural changes.
      // We'll handle the "Immediate" part in useAutoSave by checking the TYPE of change?
      // Actually simpler: let's export a triggerSync function or use a timestamp in store.
      // For now, let's rely on useAutoSave detecting the page change.
    },

    duplicatePage: (pageId) => {
      const state = get()
      const pageToDuplicate = state.pages.find((p) => p.id === pageId)
      if (!pageToDuplicate) return

      const newPageId = crypto.randomUUID()

      // Deep clone JSON to prevent reference issues
      const clonedJson = JSON.parse(JSON.stringify(pageToDuplicate.json))

      // We need to re-generate IDs for all objects in the cloned JSON to avoid collisions
      // if we were to merge them, but since they are on a separate page, it might be fine.
      // However, good practice to give them new IDs if they are considered "instances".
      // For now, simple clone is enough for separate pages.

      const newPage: Page = {
        id: newPageId,
        thumbnail: pageToDuplicate.thumbnail,
        json: clonedJson,
        background: pageToDuplicate.background,
      }

      // Insert after the current page
      const index = state.pages.findIndex((p) => p.id === pageId)
      const newPages = [...state.pages]
      newPages.splice(index + 1, 0, newPage)

      set({ pages: newPages })
      if (state.projectId) {
        import("@/utils/storage").then(({ saveToLocalStorage }) => {
          saveToLocalStorage(state.projectId!, {
            pages: newPages,
            activePageId: newPageId,
            projectName: state.projectName,
          })
        })
      }
      get().setActivePage(newPageId)
    },

    reorderPages: (oldIndex, newIndex) => {
      set((state) => {
        const newPages = [...state.pages]
        const [movedPage] = newPages.splice(oldIndex, 1)
        if (movedPage) {
          newPages.splice(newIndex, 0, movedPage)
        }

        if (state.projectId) {
          import("@/utils/storage").then(({ saveToLocalStorage }) => {
            saveToLocalStorage(state.projectId!, {
              pages: newPages,
              activePageId: state.activePageId,
              projectName: state.projectName,
            })
          })
        }
        return { pages: newPages }
      })
    },

    removePage: (id) => {
      const state = get()
      if (state.pages.length <= 1) return // Don't delete the last page

      const newPages = state.pages.filter((p) => p.id !== id)
      let newActiveId = state.activePageId

      // If we deleted the active page, switch to the previous one (or first)
      if (id === newActiveId && newPages.length > 0) {
        const firstPage = newPages[0]
        if (firstPage) {
          newActiveId = firstPage.id
          get().setActivePage(newActiveId)
        }
      }

      set({ pages: newPages })
      if (state.projectId) {
        import("@/utils/storage").then(({ saveToLocalStorage }) => {
          saveToLocalStorage(state.projectId!, {
            pages: newPages,
            activePageId: newActiveId,
            projectName: state.projectName,
          })
        })
      }
    },

    setActivePage: async (id) => {
      const state = get()
      const { canvas, pages, activePageId } = state

      if (!canvas || id === activePageId) return

      // CRITICAL: Exit edit mode before saving to prevent control points from being saved
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (canvas as any).exitEditMode === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(canvas as any).exitEditMode()
      }

      // 1. Save current page state
      const currentIndex = pages.findIndex((p) => p.id === activePageId)

      if (currentIndex !== -1) {
        // Serialize canvas
        // We need to be careful with JSON export.
        // fabric.Canvas#toJSON or toObject
        const json = canvas.toObject(["id", "selectable", "name"]) // Include custom props

        // CRITICAL: Fabric.js toObject() doesn't include width/height by default!
        json.width = canvas.width
        json.height = canvas.height

        // Update the page in store
        const updatedPages = [...pages]
        const pageToUpdate = updatedPages[currentIndex]

        if (pageToUpdate) {
          updatedPages[currentIndex] = {
            ...pageToUpdate,
            json: json,
            id: pageToUpdate.id, // Ensure ID is preserved
          }
          set({ pages: updatedPages })
        }
      }

      // 2. Clear Canvas
      canvas.clear()
      // Determine background of new page? (Fabric handles bg in JSON usually)

      // 3. Load new page state
      const targetPage = get().pages.find((p) => p.id === id)
      if (
        targetPage &&
        targetPage.json &&
        Object.keys(targetPage.json).length > 0
      ) {
        await canvas.loadFromJSON(targetPage.json)
      }

      // Update active ID
      set({ activePageId: id })

      // Render
      canvas.requestRenderAll()

      // Re-sync layers
      get().syncLayers(canvas)
    },

    updatePage: (id, updates) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }))
    },

    // --- Drawing Actions ---

    toggleDrawingMode: (enabled) => {
      set((state) => ({
        isDrawingMode: enabled ?? !state.isDrawingMode,
      }))
    },

    setBrushColor: (color) => set({ brushColor: color }),
    setBrushWidth: (width) => set({ brushWidth: width }),
  }
})

// Inject store updater into the singleton history manager
// This ensures that whenever HistoryManager changes, it triggers a React re-render via Zustand
historyManager["onUpdate"] = () => {
  useEditorStore.getState().updateHistoryState()
}
