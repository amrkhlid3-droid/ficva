import { Command } from "../types"
import { Canvas, FabricObject } from "fabric"

export class ReorderCommand implements Command {
  constructor(
    private canvas: Canvas,
    private object: FabricObject,
    private fromIndex: number, // Visual index (0 = Top) via LayersPanel logic, OR Fabric index? Let's use Fabric Index to be safe and "dumb".
    private toIndex: number     // Fabric Index (0 = bottom)
  ) {}

  execute() {
    this.canvas.moveObjectTo(this.object, this.toIndex)
    this.canvas.requestRenderAll()
    // Trigger store sync
    this.canvas.fire("object:modified", { target: this.object })
  }

  undo() {
    this.canvas.moveObjectTo(this.object, this.fromIndex)
    this.canvas.requestRenderAll()
    this.canvas.fire("object:modified", { target: this.object })
  }
}
