import { Command } from "../types"
import { Canvas, FabricObject } from "fabric"

export class BringToFrontCommand implements Command {
  private originalIndex: number

  constructor(
    private canvas: Canvas,
    private object: FabricObject
  ) {
    const canvasObjects = canvas.getObjects()
    // Robust index lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const id = (object as any).id
    this.originalIndex = canvasObjects.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (co) => co === object || ((co as any).id === id && id !== undefined)
    )
  }

  execute() {
    const maxIndex = this.canvas.getObjects().length - 1
    console.log(
      `[BringToFront] Moving object ${this.object.type} from ${this.originalIndex} to ${maxIndex}`
    )
    this.canvas.moveObjectTo(this.object, maxIndex)
    // this.canvas.bringObjectToFront(this.object)
    this.canvas.requestRenderAll()
    this.canvas.fire("object:modified", { target: this.object })
  }

  undo() {
    console.log(
      `[BringToFront:Undo] Moving object ${this.object.type} back to ${this.originalIndex}`
    )
    this.canvas.moveObjectTo(this.object, this.originalIndex)
    this.canvas.requestRenderAll()
    this.canvas.fire("object:modified", { target: this.object })
  }
}
