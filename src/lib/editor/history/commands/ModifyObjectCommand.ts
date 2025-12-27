import { Command } from "../types"
import { FabricObject } from "fabric"

export class ModifyObjectCommand implements Command {
  constructor(
    private object: FabricObject,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private newProps: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private originalProps: Record<string, any>
  ) {}

  execute() {
    this.object.set(this.newProps)
    this.object.setCoords() // Ensure coordinates update if properties affect dimensions/position
    this.object.canvas?.requestRenderAll()
    this.object.canvas?.fire("object:modified", { target: this.object }) // Notify listeners
  }

  undo() {
    this.object.set(this.originalProps)
    this.object.setCoords()
    this.object.canvas?.requestRenderAll()
    this.object.canvas?.fire("object:modified", { target: this.object })
  }
}
