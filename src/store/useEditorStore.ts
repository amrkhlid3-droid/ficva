import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { castDraft } from "immer"
import type { Canvas, FabricObject } from "fabric"
import { HistoryManager } from "@/lib/editor/history/HistoryManager"

interface EditorState {
  canvas: Canvas | null
  selectedObjects: FabricObject[]
  history: HistoryManager
  canUndo: boolean
  canRedo: boolean
}

interface EditorActions {
  setCanvas: (canvas: Canvas | null) => void
  setSelectedObjects: (objects: FabricObject[]) => void
  updateHistoryState: () => void
}

const historyManager = new HistoryManager()

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set) => {
    // Connect history manager to store
    // When history stack changes, it calls this callback to update store state
    // historyManager.onUpdate = () => { ... } // Circular dependency if defined here directly without careful handling

    return {
      canvas: null,
      selectedObjects: [],
      history: castDraft(historyManager) as unknown as HistoryManager, // Treat as immutable reference and force type match
      canUndo: false,
      canRedo: false,

      setCanvas: (canvas) =>
        set((state) => {
          state.canvas = castDraft(canvas)
        }),
      setSelectedObjects: (selectedObjects) =>
        set((state) => {
          state.selectedObjects = castDraft(selectedObjects)
        }),

      updateHistoryState: () =>
        set((state) => {
          state.canUndo = historyManager.canUndo
          state.canRedo = historyManager.canRedo
        }),
    }
  })
)

// Inject store updater into the singleton history manager
// This ensures that whenever HistoryManager changes, it triggers a React re-render via Zustand
// We do this outside the store creation to avoid circular referencing issues during initialization if possible,
// or simply keep it simple.
historyManager["onUpdate"] = () => {
  useEditorStore.getState().updateHistoryState()
}
