import { Command } from "../types"
import { Path } from "fabric"
import type { CustomPathData, PathNode } from "@/types/fabric"
import { nodesToSvgPath } from "@/lib/editor/pathUtils"

/**
 * Command for modifying path nodes (anchor points, handles, node modes)
 * Used for undo/redo of pen tool editing operations
 */
export class ModifyPathCommand implements Command {
  private oldPathData: CustomPathData
  private newPathData: CustomPathData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private oldSvgPath: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private newSvgPath: any[]

  constructor(
    private path: Path,
    oldNodes: PathNode[],
    newNodes: PathNode[],
    closed: boolean
  ) {
    // Deep clone to avoid reference issues
    this.oldPathData = {
      nodes: JSON.parse(JSON.stringify(oldNodes)),
      closed,
    }
    this.newPathData = {
      nodes: JSON.parse(JSON.stringify(newNodes)),
      closed,
    }

    // Pre-compute SVG paths for both states
    this.oldSvgPath = nodesToSvgPath(this.oldPathData)
    this.newSvgPath = nodesToSvgPath(this.newPathData)
  }

  execute() {
    this.applyPathData(this.newPathData, this.newSvgPath)
  }

  undo() {
    this.applyPathData(this.oldPathData, this.oldSvgPath)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyPathData(data: CustomPathData, svgPath: any[]) {
    // Update customPathData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.path as any).customPathData = {
      nodes: JSON.parse(JSON.stringify(data.nodes)),
      closed: data.closed,
    }

    // Update SVG path
    this.path.set({ path: svgPath })
    this.path.setCoords()
    this.path.dirty = true
    this.path.canvas?.requestRenderAll()
    this.path.canvas?.fire("object:modified", { target: this.path })

    // 触发路径数据变更事件，让编辑模式刷新控制点和幽灵路径
    this.path.canvas?.fire("path:data:changed", { target: this.path })
  }
}
