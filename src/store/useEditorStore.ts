import { create } from "zustand"
// Removed immer middleware to handle raw Canvas objects correctly
import type { Canvas, FabricObject } from "fabric"
import { HistoryManager } from "@/lib/editor/history/HistoryManager"

interface Page {
  id: string
  thumbnail?: string // Base64 image
  json: object // Fabric.js serialization data
  background?: string
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
}

interface EditorActions {
  setCanvas: (canvas: Canvas | null) => void
  setSelectedObjects: (objects: FabricObject[]) => void
  syncLayers: (canvas?: Canvas) => void
  updateHistoryState: () => void
  setActiveSidebar: (sidebar: "none" | "assets") => void
  setProjectName: (name: string) => void
  setProjectId: (id: string) => void

  // Page Management
  addPage: () => void
  removePage: (id: string) => void
  setActivePage: (id: string) => void
  updatePageThumbnail: (id: string, thumbnail: string) => void

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

    setProjectName: (name) => set({ projectName: name }),
    setProjectId: (id) => set({ projectId: id }),

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

      set((state) => ({
        pages: [...state.pages, newPage],
        activePageId: newPageId, // Auto-switch to new page? Or stay? Let's switch for now.
      }))

      // If we switch immediately, we need to trigger the load logic.
      // Re-using setActivePage might be cleaner, but we can't call an action from an action easily in Zustand v4 without `get().setActivePage`
      get().setActivePage(newPageId)
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
    },

    setActivePage: async (id) => {
      const state = get()
      const { canvas, pages, activePageId } = state

      if (!canvas || id === activePageId) return

      // 1. Save current page state
      const currentIndex = pages.findIndex((p) => p.id === activePageId)

      if (currentIndex !== -1) {
        // Serialize canvas
        // We need to be careful with JSON export.
        // fabric.Canvas#toJSON or toObject
        const json = canvas.toObject(["id", "selectable", "name"]) // Include custom props

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

    updatePageThumbnail: (id, thumbnail) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === id ? { ...p, thumbnail } : p)),
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
