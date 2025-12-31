import type { PathNode, CustomPathData } from "@/types/fabric"
import { createEmptyNode } from "./pathUtils"

/**
 * 从 SVG Path Commands 转换为 CustomPathData
 * 临时实现：将现有路径转换为节点数组
 */
export function svgPathToNodes(svgCommands: any[]): CustomPathData {
  const nodes: PathNode[] = []
  let closed = false

  // 简化版本：只处理基本的 M, C, Z
  for (let i = 0; i < svgCommands.length; i++) {
    const cmd = svgCommands[i]

    if (cmd[0] === "M") {
      // 第一个点
      nodes.push(createEmptyNode(cmd[1], cmd[2], "straight"))
    } else if (cmd[0] === "C") {
      // 贝塞尔曲线的终点
      const x = cmd[5]
      const y = cmd[6]
      nodes.push(createEmptyNode(x, y, "straight"))
    } else if (cmd[0] === "L") {
      // 直线的终点
      nodes.push(createEmptyNode(cmd[1], cmd[2], "straight"))
    } else if (cmd[0] === "Z") {
      closed = true
    }
  }

  return { nodes, closed }
}
