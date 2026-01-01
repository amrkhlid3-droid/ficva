import type { PathNode, CustomPathData, NodeMode } from "@/types/fabric"
import { createEmptyNode } from "./pathUtils"

/**
 * 从 SVG Path Commands 转换为 CustomPathData
 * @param svgCommands SVG 路径命令数组
 * @param nodeModes 可选的节点模式数组，用于保留绘制时的模式信息
 */
export function svgPathToNodes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svgCommands: any[],
  nodeModes?: NodeMode[]
): CustomPathData {
  const nodes: PathNode[] = []
  let closed = false

  let lastX = 0
  let lastY = 0
  let nodeIndex = 0 // 追踪当前节点索引，用于匹配 nodeModes

  for (let i = 0; i < svgCommands.length; i++) {
    const cmd = svgCommands[i]
    const type = cmd[0]

    if (type === "M") {
      const x = cmd[1]
      const y = cmd[2]
      // 使用传入的 nodeMode，如果没有则默认 "straight"
      const mode = nodeModes?.[nodeIndex] || "straight"
      nodes.push(createEmptyNode(x, y, mode))
      nodeIndex++
      lastX = x
      lastY = y
    } else if (type === "L") {
      const x = cmd[1]
      const y = cmd[2]
      const mode = nodeModes?.[nodeIndex] || "straight"
      nodes.push(createEmptyNode(x, y, mode))
      nodeIndex++
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
      }

      // 2. Create current node with handleIn (using CP2)
      const mode = nodeModes?.[nodeIndex] || "straight"
      const newNode = createEmptyNode(x, y, mode)
      newNode.handleIn = { x: cp2x - x, y: cp2y - y }
      nodes.push(newNode)
      nodeIndex++

      lastX = x
      lastY = y
    } else if (type === "Q") {
      // Simple Q handling (ignore CP for now or convert approx)
      const x = cmd[3]
      const y = cmd[4]
      const mode = nodeModes?.[nodeIndex] || "straight"
      nodes.push(createEmptyNode(x, y, mode))
      nodeIndex++
      lastX = x
      lastY = y
    } else if (type === "Z") {
      closed = true
    }
  }

  return { nodes, closed }
}
