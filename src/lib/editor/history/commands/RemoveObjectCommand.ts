import { Canvas, FabricObject } from "fabric"
import { Command } from "@/lib/editor/history/types"
import { safeRemove } from "@/lib/editor/utils/CanvasUtils"

export class RemoveObjectCommand implements Command {
  private index: number

  constructor(
    private canvas: Canvas,
    private object: FabricObject
  ) {
    this.index = canvas.getObjects().indexOf(object)
  }

  execute(): void {
    safeRemove(this.canvas, this.object)
    this.canvas.requestRenderAll()
  }

  undo(): void {
    this.canvas.insertAt(this.index, this.object)
    this.canvas.setActiveObject(this.object)
    this.canvas.requestRenderAll()
  }
}
