import type { PathNode, CustomPathData, NodeMode } from "@/types/fabric"

// PathCommand 是 SVG 路径命令的数组表示
// 例如: ['M', 100, 100] 或 ['C', x1, y1, x2, y2, x, y]
interface PathCommand extends Array<string | number> {
  nodeMode?: NodeMode
}

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

// ============================================
// 贝塞尔曲线工具函数
// ============================================

interface Point2D {
  x: number
  y: number
}

/**
 * 计算三次贝塞尔曲线上 t 参数位置的点
 * 使用 De Casteljau 算法
 */
export function evaluateCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  }
}

/**
 * 使用 De Casteljau 算法在 t 位置细分三次贝塞尔曲线
 * 返回两段新曲线的控制点
 */
export function subdivideCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): {
  left: { p0: Point2D; p1: Point2D; p2: Point2D; p3: Point2D }
  right: { p0: Point2D; p1: Point2D; p2: Point2D; p3: Point2D }
} {
  // De Casteljau 中间点
  const p01 = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t }
  const p12 = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
  const p23 = { x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t }

  const p012 = {
    x: p01.x + (p12.x - p01.x) * t,
    y: p01.y + (p12.y - p01.y) * t,
  }
  const p123 = {
    x: p12.x + (p23.x - p12.x) * t,
    y: p12.y + (p23.y - p12.y) * t,
  }

  const p0123 = {
    x: p012.x + (p123.x - p012.x) * t,
    y: p012.y + (p123.y - p012.y) * t,
  }

  return {
    left: { p0: p0, p1: p01, p2: p012, p3: p0123 },
    right: { p0: p0123, p1: p123, p2: p23, p3: p3 },
  }
}

/**
 * 计算点到线段上最近点的距离和 t 参数
 * 通过采样曲线来近似
 */
function pointToSegmentDistance(
  point: Point2D,
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  samples: number = 50
): { distance: number; t: number } {
  let minDist = Infinity
  let bestT = 0

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pt = evaluateCubicBezier(p0, p1, p2, p3, t)
    const dx = pt.x - point.x
    const dy = pt.y - point.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < minDist) {
      minDist = dist
      bestT = t
    }
  }

  return { distance: minDist, t: bestT }
}

/**
 * 找到鼠标点最接近的曲线段索引和 t 参数
 * @param nodes 路径节点数组
 * @param mousePoint 鼠标位置（路径本地坐标）
 * @param closed 路径是否闭合
 * @param threshold 距离阈值（像素），超出则返回 null
 */
export function findClosestSegment(
  nodes: PathNode[],
  mousePoint: Point2D,
  closed: boolean,
  threshold: number = 20
): { segmentIndex: number; t: number } | null {
  if (nodes.length < 2) return null

  let minDist = Infinity
  let bestSegment = -1
  let bestT = 0

  const segmentCount = closed ? nodes.length : nodes.length - 1

  for (let i = 0; i < segmentCount; i++) {
    const curr = nodes[i]
    const next = nodes[(i + 1) % nodes.length]

    if (!curr || !next) continue

    // 构建贝塞尔曲线控制点
    const p0 = curr.anchor
    const p1 = {
      x: curr.anchor.x + curr.handleOut.x,
      y: curr.anchor.y + curr.handleOut.y,
    }
    const p2 = {
      x: next.anchor.x + next.handleIn.x,
      y: next.anchor.y + next.handleIn.y,
    }
    const p3 = next.anchor

    const result = pointToSegmentDistance(mousePoint, p0, p1, p2, p3)

    if (result.distance < minDist) {
      minDist = result.distance
      bestSegment = i
      bestT = result.t
    }
  }

  if (minDist > threshold || bestSegment < 0) {
    return null
  }

  return { segmentIndex: bestSegment, t: bestT }
}

/**
 * 在指定线段的 t 位置插入新节点
 * 使用 De Casteljau 细分保持曲线形状
 */
export function insertNodeAtSegment(
  nodes: PathNode[],
  segmentIndex: number,
  t: number,
  mode: NodeMode
): PathNode[] {
  const newNodes = [...nodes]
  const curr = nodes[segmentIndex]
  const nextIndex = (segmentIndex + 1) % nodes.length
  const next = nodes[nextIndex]

  if (!curr || !next) return nodes

  // 构建原始贝塞尔曲线控制点
  const p0 = curr.anchor
  const p1 = {
    x: curr.anchor.x + curr.handleOut.x,
    y: curr.anchor.y + curr.handleOut.y,
  }
  const p2 = {
    x: next.anchor.x + next.handleIn.x,
    y: next.anchor.y + next.handleIn.y,
  }
  const p3 = next.anchor

  // 使用 De Casteljau 细分曲线
  const subdivision = subdivideCubicBezier(p0, p1, p2, p3, t)

  // 更新当前节点的 handleOut（左半部分的 p1 相对于 p0）
  const newCurrHandleOut = {
    x: subdivision.left.p1.x - p0.x,
    y: subdivision.left.p1.y - p0.y,
  }

  // 创建新节点
  const newAnchor = subdivision.left.p3 // = subdivision.right.p0，细分点

  // 新节点的 handleIn（左半部分的 p2 相对于新锚点）
  const newHandleIn = {
    x: subdivision.left.p2.x - newAnchor.x,
    y: subdivision.left.p2.y - newAnchor.y,
  }

  // 新节点的 handleOut（右半部分的 p1 相对于新锚点）
  const newHandleOut = {
    x: subdivision.right.p1.x - newAnchor.x,
    y: subdivision.right.p1.y - newAnchor.y,
  }

  // 更新下一个节点的 handleIn（右半部分的 p2 相对于 p3）
  const newNextHandleIn = {
    x: subdivision.right.p2.x - p3.x,
    y: subdivision.right.p2.y - p3.y,
  }

  // 如果是直线模式，清零所有手柄
  let finalHandleIn = newHandleIn
  let finalHandleOut = newHandleOut
  let finalCurrHandleOut = newCurrHandleOut
  let finalNextHandleIn = newNextHandleIn

  if (mode === "straight") {
    finalHandleIn = { x: 0, y: 0 }
    finalHandleOut = { x: 0, y: 0 }
    finalCurrHandleOut = { x: 0, y: 0 }
    finalNextHandleIn = { x: 0, y: 0 }
  }

  // 创建新节点
  const newNode: PathNode = {
    anchor: newAnchor,
    handleIn: finalHandleIn,
    handleOut: finalHandleOut,
    mode,
  }

  // 更新当前节点
  newNodes[segmentIndex] = {
    ...curr,
    handleOut: finalCurrHandleOut,
  }

  // 更新下一个节点
  newNodes[nextIndex] = {
    ...next,
    handleIn: finalNextHandleIn,
  }

  // 在正确位置插入新节点
  newNodes.splice(segmentIndex + 1, 0, newNode)

  return newNodes
}
