import { Canvas, FabricObject } from "fabric"
import { Command } from "@/lib/editor/history/types"
import { safeRemove } from "@/lib/editor/utils/CanvasUtils"

export class RemoveObjectsCommand implements Command {
  private indices: { object: FabricObject; index: number }[] = []

  constructor(
    private canvas: Canvas,
    private objects: FabricObject[]
  ) {
    const canvasObjects = canvas.getObjects()
    this.indices = objects.map((obj) => {
      // Robust index lookup: match by Ref OR ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (obj as any).id
      const index = canvasObjects.findIndex(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (co) => co === obj || ((co as any).id === id && id !== undefined)
      )
      return {
        object: obj,
        index: index,
      }
    })

    // Debug log
    console.log("RemoveObjectsCommand initialized", {
      objects: this.objects.length,
      indices: this.indices,
    })
  }

  execute(): void {
    console.log("Executing batch remove")

    // 1. Discard active selection to clear controls
    this.canvas.discardActiveObject()

    // 2. Remove objects
    this.indices.forEach(({ object }) => {
      safeRemove(this.canvas, object)
    })

    this.canvas.requestRenderAll()
  }

  undo(): void {
    console.log("Undoing batch remove")
    // Restore objects in reverse order of removal (to maintain layer roughly?) ->
    // Actually, indices are absolute. We should sort by index to insert correctly?
    // If we insert index 0, then index 5.
    // If we insert 5, then 0.
    // Safest is to sort by index ascending.

    const sortedProps = [...this.indices].sort((a, b) => a.index - b.index)

    sortedProps.forEach(({ object, index }) => {
      if (index === -1) {
        this.canvas.add(object) // Fallback
      } else {
        this.canvas.insertAt(index, object)
      }
    })

    // Optionally restore selection?
    // For now, let's just select them back?
    // const selection = new ActiveSelection(this.objects, { canvas: this.canvas })
    // this.canvas.setActiveObject(selection)

    this.canvas.requestRenderAll()
  }
}
