import "fabric"

export type NodeMode = "straight" | "mirrored"

// 节点数据结构（唯一真理来源）
export interface PathNode {
  anchor: { x: number; y: number } // 锚点坐标（绝对位置）
  handleIn: { x: number; y: number } // 入射手柄（相对锚点的偏移）
  handleOut: { x: number; y: number } // 出射手柄（相对锚点的偏移）
  mode: NodeMode // 节点类型
}

// 自定义路径数据（替代 SVG Path Commands）
export interface CustomPathData {
  nodes: PathNode[] // 节点数组
  closed: boolean // 是否闭合
}

declare module "fabric" {
  // Augment the base FabricObject interface
  // Note: changing to 'interface FabricObject' to match library style if needed,
  // but usually we augment 'Object' or 'FabricObject'.
  // Fabric v6 uses 'FabricObject'.
  interface FabricObject {
    id?: string
    nodeModes?: NodeMode[] // DEPRECATED: 将被 customPathData 替代
    customPathData?: CustomPathData // 新架构：节点数组
  }

  interface CanvasEvents {
    "node:delete": { target: FabricObject }
    "node:type:change": { target: FabricObject; mode: "sharp" | "smooth" }
    "node:mode:change": {
      target: FabricObject
      mode: NodeMode
    }
    "node:handle:mode": {
      target: FabricObject
      side: "in" | "out"
      mode: "curve" | "line"
    }
    "path:data:changed": {
      target: FabricObject
    }
  }
}
