import "fabric"

declare module "fabric" {
  interface CanvasEvents {
    "node:delete": { target: FabricObject }
    "node:type:change": { target: FabricObject; mode: "sharp" | "smooth" }
    "node:mode:change": {
      target: FabricObject
      mode: "straight" | "mirrored" | "detached"
    }
  }
}
