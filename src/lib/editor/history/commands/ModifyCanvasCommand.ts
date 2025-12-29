import { Command } from "../types"
import { Canvas } from "fabric"

export class ModifyCanvasCommand implements Command {
  constructor(
    private canvas: Canvas,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private newProps: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private originalProps: Record<string, any>
  ) {}

  execute() {
    this.applyProps(this.newProps)
  }

  undo() {
    this.applyProps(this.originalProps)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyProps(props: Record<string, any>) {
    // Handle dimensions separately as they require a method call
    if (props.width !== undefined || props.height !== undefined) {
      const width = props.width ?? this.canvas.width
      const height = props.height ?? this.canvas.height
      this.canvas.setDimensions({ width, height })
    }

    // Handle background color
    if (props.backgroundColor !== undefined) {
      this.canvas.backgroundColor = props.backgroundColor
    }

    this.canvas.requestRenderAll()
    // @ts-ignore
    this.canvas.fire("canvas:modified")
  }
}
