import { Canvas, FabricObject } from "fabric"

export const safeRemove = (canvas: Canvas, object: FabricObject) => {
  if (!object || !canvas) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const id = (object as any).id

  // 1. Try to find the LIVE object in the canvas
  // This handles issues where the object reference might be stale or proxied
  const liveObject = canvas.getObjects().find(
    (o) => o === object || ((o as any).id === id && id !== undefined)
  )

  if (liveObject) {
    try {
      // 2. Standard removal
      canvas.remove(liveObject)

      // 3. Verification & Force Removal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stillExists = (canvas as any)._objects?.includes(liveObject) || canvas.getObjects().includes(liveObject)

      if (stillExists) {
        console.warn(`[CanvasUtils] Standard remove failed for ${id}. Attempting FORCE REMOVAL.`)
        // Force remove from private _objects array if accessible
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawObjects = (canvas as any)._objects
        if (Array.isArray(rawObjects)) {
          const idx = rawObjects.indexOf(liveObject)
          if (idx > -1) {
            rawObjects.splice(idx, 1)
            // Ensure canvas knows about the change and fires events for UI sync
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(canvas as any)._onObjectRemoved?.(liveObject)
            canvas.fire("object:removed", { target: liveObject })
          }
        }
      }
    } catch (e) {
      console.error("[CanvasUtils] Error removing object:", e)
    }
  } else {
    // Fallback: try removing the reference we were passed, just in case
    try {
       canvas.remove(object)
    } catch (e) {
       console.warn("[CanvasUtils] Fallback remove failed", e)
    }
  }
}
