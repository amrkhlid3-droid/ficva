import type { PathNode, CustomPathData } from "@/types/fabric"
import { createEmptyNode } from "./pathUtils"

/**
 * 从 SVG Path Commands 转换为 CustomPathData
 * 临时实现：将现有路径转换为节点数组
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function svgPathToNodes(svgCommands: any[]): CustomPathData {
  const nodes: PathNode[] = []
  let closed = false

  let lastX = 0
  let lastY = 0

  for (let i = 0; i < svgCommands.length; i++) {
    const cmd = svgCommands[i]
    const type = cmd[0]

    if (type === "M") {
      const x = cmd[1]
      const y = cmd[2]
      nodes.push(createEmptyNode(x, y, "straight"))
      lastX = x
      lastY = y
    } else if (type === "L") {
      const x = cmd[1]
      const y = cmd[2]
      nodes.push(createEmptyNode(x, y, "straight"))
      lastX = x
      lastY = y
    } else if (type === "C") {
      // ["C", cp1x, cp1y, cp2x, cp2y, x, y]
      const cp1x = cmd[1]
      const cp1y = cmd[2]
      const cp2x = cmd[3]
      const cp2y = cmd[4]
      const x = cmd[5]
      const y = cmd[6]

      // 1. Update previous node's handleOut (using CP1)
      const prevNode = nodes[nodes.length - 1]
      if (prevNode) {
        prevNode.handleOut = { x: cp1x - lastX, y: cp1y - lastY }
        // Attempt to guess mode: if handle is non-zero, assume mirrored (or free, but start with mirrored for safety)
        if (prevNode.handleOut.x !== 0 || prevNode.handleOut.y !== 0) {
          // Don't force mirrored yet, could be disconnected. Keep straight logic for now or "detached"?
          // Fabric doesn't strictly enforce mode. Let's mark as 'mirrored' if significant curve?
          // No, keep 'straight' unless we detect symmetry?
          // For now, let's keep user manual switch, BUT populate data.
        }
      }

      // 2. Create current node with handleIn (using CP2)
      const newNode = createEmptyNode(x, y, "straight")
      newNode.handleIn = { x: cp2x - x, y: cp2y - y }
      nodes.push(newNode)

      lastX = x
      lastY = y
    } else if (type === "Q") {
      // Simple Q handling (ignore CP for now or convert approx)
      const x = cmd[3]
      const y = cmd[4]
      nodes.push(createEmptyNode(x, y, "straight"))
      lastX = x
      lastY = y
    } else if (type === "Z") {
      closed = true
      // Optional: Close loop logic if Z implies a curve back to start?
      // Fabric treats Z as just line close usually, or C if specified.
      // If we want smooth closure, we'd check if first point has handleIn.
    }
  }

  return { nodes, closed }
}
