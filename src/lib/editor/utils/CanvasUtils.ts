import { Canvas, FabricObject, Path } from "fabric"

/**
 * 修复加载后的 Path 对象属性
 * 确保 objectCaching 为 false 和 exactBoundingBox 为 true
 * 这样可以正确显示 miter 尖角而不被裁剪
 */
export const fixPathObjectsAfterLoad = (canvas: Canvas) => {
  const objects = canvas.getObjects()
  let fixedCount = 0

  for (const obj of objects) {
    if (obj instanceof Path) {
      // 修复 objectCaching 和 exactBoundingBox
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathObj = obj as any
      if (
        pathObj.objectCaching !== false ||
        pathObj.exactBoundingBox !== true
      ) {
        pathObj.objectCaching = false
        pathObj.exactBoundingBox = true
        pathObj.setCoords()
        fixedCount++
      }
    }
  }

  if (fixedCount > 0) {
    canvas.requestRenderAll()
    console.log(`[CanvasUtils] Fixed ${fixedCount} Path objects after load`)
  }
}

export const safeRemove = (canvas: Canvas, object: FabricObject) => {
  if (!object || !canvas) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const id = (object as any).id

  // 1. Try to find the LIVE object in the canvas
  // This handles issues where the object reference might be stale or proxied
  const liveObject = canvas
    .getObjects()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .find((o) => o === object || ((o as any).id === id && id !== undefined))

  if (liveObject) {
    try {
      // 2. Standard removal
      canvas.remove(liveObject)

      // 3. Verification & Force Removal
      const stillExists =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (canvas as any)._objects?.includes(liveObject) ||
        canvas.getObjects().includes(liveObject)

      if (stillExists) {
        console.warn(
          `[CanvasUtils] Standard remove failed for ${id}. Attempting FORCE REMOVAL.`
        )
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
