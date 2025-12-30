import { Command } from "../types"
import { Canvas } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"

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
    // @ts-expect-error -- Event not in types
    this.canvas.fire("canvas:modified")

    // CRITICAL: Save canvas state to current page
    this.saveCanvasToPage()
  }

  private saveCanvasToPage() {
    const state = useEditorStore.getState()
    const { pages, activePageId } = state

    const currentIndex = pages.findIndex((p) => p.id === activePageId)
    if (currentIndex === -1) return

    // Serialize canvas with custom props
    const json = this.canvas.toObject(["id", "selectable", "name"])

    // CRITICAL: Fabric.js toObject() doesn't include width/height by default!
    // Manually add them to the JSON
    json.width = this.canvas.width
    json.height = this.canvas.height

    // Update page in store
    const updatedPages = [...pages]
    const pageToUpdate = updatedPages[currentIndex]

    if (pageToUpdate) {
      updatedPages[currentIndex] = {
        ...pageToUpdate,
        json: json,
        id: pageToUpdate.id,
      }
      useEditorStore.setState({ pages: updatedPages })
    }
  }
}
