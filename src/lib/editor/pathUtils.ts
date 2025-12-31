import type { PathNode, CustomPathData } from "@/types/fabric"

// PathCommand 是 SVG 路径命令的数组表示
// 例如: ['M', 100, 100] 或 ['C', x1, y1, x2, y2, x, y]
type PathCommand = (string | number)[]

/**
 * 核心生成器：将自定义节点数组转换为 SVG Path Commands
 *
 * @param data - 自定义路径数据（节点数组 + 闭合标志）
 * @returns SVG Path Commands 数组
 *
 * @example
 * // 三角形（3个直线节点）
 * const triangle: CustomPathData = {
 *   nodes: [
 *     { anchor: {x: 100, y: 100}, handleIn: {x:0, y:0}, handleOut: {x:0, y:0}, mode: 'straight' },
 *     { anchor: {x: 200, y: 200}, handleIn: {x:0, y:0}, handleOut: {x:0, y:0}, mode: 'straight' },
 *     { anchor: {x: 50, y: 200}, handleIn: {x:0, y:0}, handleOut: {x:0, y:0}, mode: 'straight' }
 *   ],
 *   closed: true
 * }
 * const svgPath = nodesToSvgPath(triangle)
 * // 结果: [['M', 100, 100], ['C', 100, 100, 200, 200, 200, 200], ['C', 200, 200, 50, 200, 50, 200], ['C', 50, 200, 100, 100, 100, 100], ['Z']]
 */
export function nodesToSvgPath(data: CustomPathData): PathCommand[] {
  const { nodes, closed } = data

  if (nodes.length === 0) return []

  const cmds: PathCommand[] = []
  const n = nodes.length

  // 第一个节点：Move To
  const firstNode = nodes[0]
  if (!firstNode) return []
  cmds.push(["M", firstNode.anchor.x, firstNode.anchor.y])

  // 生成线段
  for (let i = 0; i < n; i++) {
    const curr = nodes[i]
    const nextIndex = (i + 1) % n
    const next = nodes[nextIndex]

    // 安全检查
    if (!curr || !next) continue

    // 如果是开放路径的最后一个点，停止
    if (i === n - 1 && !closed) break

    // 计算控制点（绝对坐标）
    // CP1 = curr.anchor + curr.handleOut
    const cp1x = curr.anchor.x + curr.handleOut.x
    const cp1y = curr.anchor.y + curr.handleOut.y

    // CP2 = next.anchor + next.handleIn
    const cp2x = next.anchor.x + next.handleIn.x
    const cp2y = next.anchor.y + next.handleIn.y

    // 生成 C 命令（三次贝塞尔曲线）
    cmds.push(["C", cp1x, cp1y, cp2x, cp2y, next.anchor.x, next.anchor.y])
  }

  // 闭合路径
  if (closed) {
    cmds.push(["Z"])
  }

  return cmds
}

/**
 * 辅助函数：创建一个空节点
 */
export function createEmptyNode(
  x: number,
  y: number,
  mode: "straight" | "mirrored" = "straight"
): PathNode {
  return {
    anchor: { x, y },
    handleIn: { x: 0, y: 0 },
    handleOut: { x: 0, y: 0 },
    mode,
  }
}

/**
 * 辅助函数：创建一个带默认手柄的 mirrored 节点
 */
export function createMirroredNode(
  x: number,
  y: number,
  handleLength: number = 20,
  angleRadians: number = 0
): PathNode {
  const dx = Math.cos(angleRadians) * handleLength
  const dy = Math.sin(angleRadians) * handleLength

  return {
    anchor: { x, y },
    handleIn: { x: -dx, y: -dy },
    handleOut: { x: dx, y: dy },
    mode: "mirrored",
  }
}
