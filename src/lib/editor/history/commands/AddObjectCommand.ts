import { Canvas, FabricObject } from "fabric"
import { Command } from "../types"

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
    this.canvas.remove(this.object)
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
  }
}
