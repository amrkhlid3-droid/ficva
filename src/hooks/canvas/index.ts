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
 *   // Navigation controls (pluggable)
 *   useZoomShortcuts()           // Shift+1/2/3 zoom mode shortcuts
 *   useWheelZoom(containerRef)   // Ctrl+wheel zoom
 *   useWheelPanVertical(containerRef)   // Wheel vertical pan
 *   useWheelPanHorizontal(containerRef) // Shift+wheel horizontal pan
 *   useMiddleMousePan()          // Middle mouse drag pan
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
 *     ├── useCanvasZoom (core zoom API)
 *     │
 *     └── Navigation Controls (pluggable)
 *         ├── useZoomShortcuts (Shift+1/2/3)
 *         ├── useWheelZoom (Ctrl+wheel)
 *         ├── useWheelPanVertical (wheel)
 *         ├── useWheelPanHorizontal (Shift+wheel)
 *         └── useMiddleMousePan (middle mouse drag)
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

// Workspace auto-fit (respond to workspace size changes)
export { useCanvasWorkspaceAutoFit } from "./useCanvasWorkspaceAutoFit"

// Navigation Controls - Pluggable Modules
// Each module can be enabled/disabled by commenting out the hook call

// Zoom mode shortcuts (Shift+1/2/3)
export { useZoomShortcuts } from "./useZoomShortcuts"

// Ctrl+wheel zoom (mouse-centered)
export { useWheelZoom } from "./useWheelZoom"

// Wheel vertical pan (when workspace exceeds viewport)
export { useWheelPanVertical } from "./useWheelPanVertical"

// Shift+wheel horizontal pan (when workspace exceeds viewport)
export { useWheelPanHorizontal } from "./useWheelPanHorizontal"

// Middle mouse drag pan
export { useMiddleMousePan } from "./useMiddleMousePan"

// Core zoom API (provides methods for ZoomControls)
export { useCanvasZoom } from "../useCanvasZoom"
