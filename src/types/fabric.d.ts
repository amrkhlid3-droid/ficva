import "fabric"

export type NodeMode = "straight" | "mirrored" | "detached"

declare module "fabric" {
  // Augment the base FabricObject interface
  // Note: changing to 'interface FabricObject' to match library style if needed,
  // but usually we augment 'Object' or 'FabricObject'.
  // Fabric v6 uses 'FabricObject'.
  interface FabricObject {
    id?: string
    nodeModes?: NodeMode[]
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
  }
}
