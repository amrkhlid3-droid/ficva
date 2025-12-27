import { Canvas, FabricObject } from "fabric"
import { Command } from "../types"
import { safeRemove } from "@/lib/editor/utils/CanvasUtils"

export class AddObjectCommand implements Command {
  constructor(
    private canvas: Canvas,
    private object: FabricObject
  ) {}

  execute() {
    this.canvas.add(this.object)
    this.canvas.setActiveObject(this.object)
    this.canvas.requestRenderAll()
  }

  undo() {
    safeRemove(this.canvas, this.object)
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
  }
}
