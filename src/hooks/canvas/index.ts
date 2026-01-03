/**
 * Canvas Hooks - Modular Fabric.js Canvas Initialization
 *
 * These hooks break down the FabricCanvas initialization into independent,
 * composable modules that can be loaded/unloaded as needed.
 *
 * ## Usage
 *
 * ```tsx
 * function FabricCanvas() {
 *   const containerRef = useRef<HTMLDivElement>(null!)
 *   const canvasRef = useRef<HTMLCanvasElement>(null)
 *
 *   // Core initialization (required)
 *   useCanvasInit({ containerRef, canvasRef })
 *
 *   // Optional modules - enable/disable as needed
 *   useCanvasSelection()
 *   useCanvasHistory()
 *   useCanvasLayerSync()
 *   useCanvasSnapshot()
 *   useCanvasKeyboard()
 *   useCanvasDrawingMode()
 *   useCanvasPenTool()
 *   useCanvasPathEdit()
 *
 *   return (
 *     <div ref={containerRef}>
 *       <canvas ref={canvasRef} />
 *     </div>
 *   )
 * }
 * ```
 *
 * ## Module Dependency Graph
 *
 * ```
 * useCanvasInit (required, must be first)
 *     │
 *     ├── useCanvasSelection
 *     ├── useCanvasHistory
 *     ├── useCanvasLayerSync
 *     ├── useCanvasSnapshot
 *     ├── useCanvasKeyboard
 *     ├── useCanvasDrawingMode
 *     ├── useCanvasPenTool
 *     ├── useCanvasPathEdit
 *     ├── useCanvasZoom (existing)
 *     └── useCanvasPan (existing)
 * ```
 */

// Core initialization
export { useCanvasInit } from "./useCanvasInit"
export type { CanvasInitOptions, CanvasInitResult } from "./useCanvasInit"

// Event handlers
export { useCanvasSelection } from "./useCanvasSelection"
export { useCanvasHistory } from "./useCanvasHistory"
export { useCanvasLayerSync } from "./useCanvasLayerSync"

// Snapshot (canvas state sync to pages store)
export { useCanvasSnapshot } from "./useCanvasSnapshot"
export type { SnapshotOptions } from "./useCanvasSnapshot"

// Keyboard
export { useCanvasKeyboard } from "./useCanvasKeyboard"
export type { KeyboardOptions } from "./useCanvasKeyboard"

// Tools
export { useCanvasDrawingMode } from "./useCanvasDrawingMode"
export { useCanvasPenTool } from "./useCanvasPenTool"
export { useCanvasPathEdit } from "./useCanvasPathEdit"
export type { PathEditRefs } from "./useCanvasPathEdit"

// Zoom scaling
export { useCanvasZoomScaling } from "./useCanvasZoomScaling"
export type { ZoomScalingOptions } from "./useCanvasZoomScaling"

// Resize (auto-adapt to container size)
export { useCanvasResize } from "./useCanvasResize"
export type { CanvasResizeOptions } from "./useCanvasResize"

// Workspace (working area with border)
export { useCanvasWorkspace } from "./useCanvasWorkspace"
export type {
  CanvasWorkspaceOptions,
  WorkspaceObject,
} from "./useCanvasWorkspace"

// Initial save (save JSON after initialization for empty pages)
export { useInitialCanvasSave } from "./useInitialCanvasSave"

// Re-export existing hooks for convenience
export { useCanvasZoom } from "../useCanvasZoom"
export { useCanvasPan } from "../useCanvasPan"
