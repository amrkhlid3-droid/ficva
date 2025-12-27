import { create } from "zustand"
// Removed immer middleware to handle raw Canvas objects correctly
import type { Canvas, FabricObject } from "fabric"
import { HistoryManager } from "@/lib/editor/history/HistoryManager"

interface EditorState {
  canvas: Canvas | null
  selectedObjects: FabricObject[]
  layers: FabricObject[]
  history: HistoryManager
  canUndo: boolean
  canRedo: boolean
}

interface EditorActions {
  setCanvas: (canvas: Canvas | null) => void
  setSelectedObjects: (objects: FabricObject[]) => void
  syncLayers: (canvas?: Canvas) => void
  updateHistoryState: () => void
}

const historyManager = new HistoryManager()

export const useEditorStore = create<EditorState & EditorActions>()((set, get) => {
  // Connect history manager to store
  // When history stack changes, it calls this callback to update store state
  // historyManager.onUpdate = () => { ... } // Circular dependency if defined here directly without careful handling

  return {
    canvas: null,
    selectedObjects: [],
    layers: [],
    history: historyManager, // Raw object
    canUndo: false,
    canRedo: false,

    setCanvas: (canvas) =>
      set({ canvas }),

    setSelectedObjects: (selectedObjects) =>
      set({ selectedObjects }),

    syncLayers: (externalCanvas?: Canvas) => {
      const state = get()
      // Use external canvas (raw) if provided, otherwise fallback to store state (which is now RAW too!)
      const targetCanvas = externalCanvas || state.canvas

      if (targetCanvas) {
        const objs = targetCanvas.getObjects() as FabricObject[]
        const seenIds = new Set<string>()
        const uniqueObjects: FabricObject[] = []

        // Ensure every object has a UNIQUE ID for Drag & Drop
        objs.forEach((obj) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let id = (obj as any).id

          // Critical Check: If this object is an ActiveSelection or invalid, skip it?
          // Only include objects that are "real".
          if (obj.type === 'activeSelection' || (obj.type === 'group' && (obj as any)._isActiveSelection)) {
              return;
          }

          if (!id || seenIds.has(id)) {
            const oldId = id
            id = crypto.randomUUID()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(obj as any).set("id", id) // Works because obj is RAW
            console.warn(`[syncLayers] Duplicate/Missing ID detected. Renaming ${obj.type} from ${oldId} to ${id}`)
          }

          seenIds.add(id)
          uniqueObjects.push(obj)
        })

        // We reverse the array so top layer is first in list (UI convention)
        set({ layers: [...uniqueObjects].reverse() })
      }
    },

    updateHistoryState: () =>
      set({
        canUndo: historyManager.canUndo,
        canRedo: historyManager.canRedo,
      }),
  }
})

// Inject store updater into the singleton history manager
// This ensures that whenever HistoryManager changes, it triggers a React re-render via Zustand
historyManager["onUpdate"] = () => {
  useEditorStore.getState().updateHistoryState()
}
