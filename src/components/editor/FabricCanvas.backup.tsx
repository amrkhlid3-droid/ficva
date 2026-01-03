"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Canvas,
  Circle,
  FabricObject,
  Line,
  Path,
  Point,
  Rect,
  util,
} from "fabric"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { RemoveObjectsCommand } from "@/lib/editor/history/commands/RemoveObjectsCommand"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"
import type { NodeMode, CustomPathData } from "@/types/fabric"
import { svgPathToNodes } from "@/lib/editor/pathConverter"
import {
  nodesToSvgPath,
  findClosestSegment,
  insertNodeAtSegment,
} from "@/lib/editor/pathUtils"
import {
  actualToDisplay,
  displayToActual,
  clampDisplayOffset,
} from "@/lib/editor/handleTransform"
import { DeleteNodeDialog } from "./DeleteNodeDialog"
import { useCanvasZoom } from "@/hooks/useCanvasZoom"
import { useCanvasPan } from "@/hooks/useCanvasPan"
import ZoomControls from "./ZoomControls"
import CanvasNavigator from "./CanvasNavigator"

// Restore PathCommand type for legacy support / Fabric compatibility
type PathCommand = (string | number)[]

/**
 * Control Point 数据结构（节点模式）
 * 直接引用节点数组索引，而非 SVG Command
 */
interface ControlPoint extends Circle {
  line?: Line
  lineToHandle?: Line
  handle?: ControlPoint
  lineFromAnchor?: boolean
  data?: {
    type: "anchor" | "handle_in" | "handle_out"
    nodeIndex: number // 指向 customPathData.nodes[nodeIndex]
    nodeMode?: NodeMode
  }
}

interface EditablePath extends Path {
  _ghostPath?: Path
  _originalStroke?: string | FabricObject["stroke"]
  _originalStrokeWidth?: number
  id?: string
  isGhost?: boolean
}

export default function FabricCanvas() {
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null!)

  // Optimize selectors to avoid re-rendering on every store change
  const setCanvas = useEditorStore((s) => s.setCanvas)
  const history = useEditorStore((s) => s.history)
  const syncLayers = useEditorStore((s) => s.syncLayers)
  const { theme } = useTheme()

  // Track start state for drag operations
  const dragStartRef = useRef<Partial<FabricObject> | null>(null)

  // Delete node dialog state
  const [deleteNodeDialogOpen, setDeleteNodeDialogOpen] = useState(false)
  const pendingDeleteNodeRef = useRef<{ nodeIndex: number } | null>(null)

  // Drawing Mode Sync
  const isDrawingMode = useEditorStore((s) => s.isDrawingMode)
  const brushColor = useEditorStore((s) => s.brushColor)
  const brushWidth = useEditorStore((s) => s.brushWidth)

  // Zoom Hook - uses Fabric.js native zoom API
  const { zoom, zoomIn, zoomOut, zoomToFit, centerAndZoom } =
    useCanvasZoom(containerRef)

  // Pan Hook - uses Fabric.js viewportTransform
  const { isPanning } = useCanvasPan()

  // Get canvas dimensions and scroll state
  const canvasContainerSize = useEditorStore((s) => s.canvasContainerSize)
  const scrollPosition = useEditorStore((s) => s.scrollPosition)
  const logicalCanvasSize = useEditorStore((s) => s.logicalCanvasSize)

  // Canvas dimensions (logical size, not DOM element size)
  const canvasWidth = logicalCanvasSize.width
  const canvasHeight = logicalCanvasSize.height

  // Always show navigator when canvas container is available
  const showNavigator = canvasContainerSize !== null

  // Handle navigator navigation - uses viewportTransform for panning
  const handleNavigate = useCallback((panX: number, panY: number) => {
    const { canvas: currentCanvas } = useEditorStore.getState()
    if (!currentCanvas) return

    const vpt = currentCanvas.viewportTransform
    if (vpt) {
      vpt[4] = -panX
      vpt[5] = -panY
      currentCanvas.setViewportTransform(vpt)
      currentCanvas.requestRenderAll()
    }
  }, [])

  // Update control point sizes and canvas resolution when zoom changes
  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    // Update canvas rendering quality for crisp display at high zoom levels
    const canvasElement = canvas.getElement()
    if (canvasElement) {
      const ctx = canvasElement.getContext("2d")
      if (ctx) {
        // Disable image smoothing when zoomed in to prevent blurry edges
        ctx.imageSmoothingEnabled = zoom <= 1
        ctx.imageSmoothingQuality = "high"
      }
    }

    // Update all control points with inverse zoom scaling
    if (controlsRef.current.length > 0) {
      controlsRef.current.forEach((ctrl) => {
        const cp = ctrl as ControlPoint
        const data = cp.data
        if (!data) return

        // Calculate new sizes based on zoom
        const baseRadius = data.type === "anchor" ? 5 : 3
        const baseStrokeWidth = 1
        const basePadding = data.type === "anchor" ? 10 : 5

        cp.set({
          radius: baseRadius / zoom,
          strokeWidth: baseStrokeWidth / zoom,
          padding: basePadding / zoom,
        })
        cp.setCoords()

        // Update associated line strokeWidth if this is a handle
        if (cp.line) {
          cp.line.set({ strokeWidth: 1 / zoom })
          cp.line.setCoords()
        }
      })
    }

    // Update hover indicator size if it exists
    if (editingPathRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathAny = editingPathRef.current as any
      const state = pathAny._ghostHoverState
      if (state?.hoverIndicator) {
        state.hoverIndicator.set({
          radius: 6 / zoom,
          strokeWidth: 2 / zoom,
        })
        state.hoverIndicator.setCoords()
      }
    }

    canvas.requestRenderAll()
  }, [zoom])

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    canvas.isDrawingMode = isDrawingMode
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = brushColor
      canvas.freeDrawingBrush.width = brushWidth
    }
  }, [isDrawingMode, brushColor, brushWidth])

  useEffect(() => {
    if (!canvasEl.current) return

    // Initialize Fabric Canvas v7
    // Get container size for initial canvas dimensions
    const containerRect = containerRef.current?.getBoundingClientRect()
    const initialWidth = containerRect?.width || 1200
    const initialHeight = containerRect?.height || 800

    const canvas = new Canvas(canvasEl.current, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: "transparent", // Transparent - we render logical canvas with viewportTransform
      fireRightClick: true, // Enable right click events
      stopContextMenu: true, // Prevent default browser context menu
      preserveObjectStacking: true, // Allow selected objects to be behind others visually
    })

    console.log(
      "[FabricCanvas] Canvas initialized with:",
      canvas.width,
      "x",
      canvas.height
    )

    // Add logical canvas background (white rectangle representing the design area)
    const { logicalCanvasSize } = useEditorStore.getState()
    const canvasBackground = new Rect({
      left: 0,
      top: 0,
      width: logicalCanvasSize.width,
      height: logicalCanvasSize.height,
      fill: "#ffffff",
      selectable: false,
      evented: false,
      excludeFromExport: true, // Don't save to JSON - it's just a visual indicator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    // Mark it for special handling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(canvasBackground as any).isCanvasBackground = true
    canvas.add(canvasBackground)
    canvas.sendObjectToBack(canvasBackground)

    // Set canvas to store immediately - Fabric.js v7 DOM initialization is synchronous
    setCanvas(canvas)

    // Load existing page content if available (e.g. after remount)
    // REMOVED: Managed by EditorPage to prevent race conditions with async fetch
    // const state = useEditorStore.getState()
    // if (state.activePageId) { ... }

    const updateSelection = () => {
      setCanvas(canvas) // Trigger re-render to update UI if needed
      useEditorStore.getState().setSelectedObjects(canvas.getActiveObjects())
    }

    canvas.on("selection:created", updateSelection)
    canvas.on("selection:updated", updateSelection)
    canvas.on("selection:cleared", updateSelection)

    // History Tracking for Transforms (Move, Scale, Rotate)
    canvas.on("mouse:down", (e) => {
      if (e.target) {
        // Capture specific transform properties
        dragStartRef.current = {
          left: e.target.left,
          top: e.target.top,
          scaleX: e.target.scaleX,
          scaleY: e.target.scaleY,
          angle: e.target.angle,
        }
      }
    })

    canvas.on("object:modified", (e) => {
      updateSelection() // Sync store

      const target = e.target
      if (!target || !dragStartRef.current) return

      // Skip control points and ghost paths (edit mode internal objects)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetAny = target as any
      if (targetAny.excludeFromExport || targetAny.isGhost || targetAny.data) {
        dragStartRef.current = null
        return
      }

      const originalState = dragStartRef.current
      const newState = {
        left: target.left,
        top: target.top,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
      }

      // Check if anything actually changed (avoid micro-movements or clicks)
      const hasChanged = Object.keys(newState).some(
        (key) =>
          newState[key as keyof typeof newState] !==
          originalState[key as keyof typeof originalState]
      )

      if (hasChanged) {
        const command = new ModifyObjectCommand(target, newState, originalState)
        history.push(command)
      }

      dragStartRef.current = null // Reset
    })

    // Sync layers on modification/add/remove
    canvas.on("object:added", (e) => {
      syncLayers(canvas)
      // Ensure loaded objects are selectable (fix for objects saved during edit mode)
      const obj = e.target as EditablePath & ControlPoint
      if (obj && !obj.isGhost && !obj.excludeFromExport) {
        obj.selectable = true
        obj.evented = true
      }
    })
    canvas.on("object:removed", () => syncLayers(canvas))
    canvas.on("object:modified", () => syncLayers(canvas))

    // Thumbnail Generation Debounce
    let thumbnailTimeout: NodeJS.Timeout
    const updateState = () => {
      clearTimeout(thumbnailTimeout)
      thumbnailTimeout = setTimeout(() => {
        // 1. Generate Thumbnail
        const dataURL = canvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 0.8, // Improved thumbnail quality
        })

        // 2. Generate JSON
        const json = canvas.toObject([
          "id",
          "selectable",
          "name",
          "backgroundColor",
          "nodeModes", // Persist node modes (legacy)
          "customPathData", // Persist node data (new architecture)
          "isWorkspace", // workspace 对象标识，用于画布尺寸持久化
        ])
        if (!json.backgroundColor) {
          json.backgroundColor = canvas.backgroundColor
        }

        const { activePageId, updatePage } = useEditorStore.getState()
        if (activePageId) {
          updatePage(activePageId, { thumbnail: dataURL, json })
        }
      }, 1000)
    }

    canvas.on("object:added", updateState)
    canvas.on("object:removed", updateState)
    canvas.on("object:modified", updateState)
    // @ts-expect-error -- Event not in types
    canvas.on("canvas:modified", updateState)
    // Also update on initial load? Maybe not needed if empty.

    // Initial sync
    syncLayers(canvas)

    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      if (isCtrlOrMeta && e.key === "z") {
        e.preventDefault()
        // Disable undo/redo in edit mode - operations are tracked as single command on exit
        const { editingPath } = useEditorStore.getState()
        if (editingPath) return

        if (e.shiftKey) {
          history.redo()
        } else {
          history.undo()
        }
      }
      if (["Backspace", "Delete"].includes(e.key)) {
        console.log("Backspace pressed")
        // Get strict clone of active objects
        const activeObjects = [...canvas.getActiveObjects()]
        console.log("Active objects to delete:", activeObjects.length)

        if (activeObjects.length > 0) {
          // Note: We do NOT discard here anymore, the command handles it.
          // Or we DO discard here to ensure indices are correct for the command constructor?
          // WAIT. Command constructor needs INDICES.
          // If objects are in ActiveSelection, they are NOT in getObjects() (in some fabric versions).
          // To be safe, we discard FIRST, then create command.

          canvas.discardActiveObject()
          canvas.requestRenderAll() // Flush to ensure _objects is updated

          // Debug check
          const canvasObjects = canvas.getObjects()
          const validObjects = activeObjects.filter((obj) =>
            canvasObjects.includes(obj)
          )
          console.log("Valid objects on canvas:", validObjects.length)

          if (validObjects.length > 0) {
            const command = new RemoveObjectsCommand(canvas, validObjects)
            history.execute(command)
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      clearTimeout(thumbnailTimeout)
      window.removeEventListener("keydown", handleKeyDown)
      // Clear store reference before disposing to prevent other effects from accessing disposed canvas
      setCanvas(null)
      canvas.dispose()
    }
  }, [setCanvas, history, syncLayers])

  // Theme-aware default pen color
  const setPenToolConfig = useEditorStore((s) => s.setPenToolConfig)
  const penToolConfig = useEditorStore((s) => s.penToolConfig)

  useEffect(() => {
    // Only override if the user hasn't selected a specific color (i.e., it matches a default black/white)
    // AND it conflicts with the new theme.
    if (theme === "dark" && penToolConfig.stroke === "#000000") {
      setPenToolConfig({ stroke: "#ffffff" })
    } else if (theme === "light" && penToolConfig.stroke === "#ffffff") {
      setPenToolConfig({ stroke: "#000000" })
    }
  }, [theme, penToolConfig.stroke, setPenToolConfig])

  // --- Pen Tool Logic ---
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  // Pen Tool Refs
  const activePathObjectRef = useRef<FabricObject | null>(null)

  // Point structure: { x: y } is the anchor.
  // cp1 (in-handle) and cp2 (out-handle) are absolute coordinates.
  const pathPointsRef = useRef<
    {
      x: number
      y: number
      cp1: { x: number; y: number }
      cp2: { x: number; y: number }
      nodeMode?: NodeMode
    }[]
  >([])

  // Track dragging for forming curves
  const isDraggingRef = useRef(false)
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null) // Where we clicked down

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    // Set cursor based on active tool
    if (activeTool === "pen") {
      canvas.defaultCursor = "crosshair" // Pen-like cursor
      canvas.hoverCursor = "crosshair"
    } else {
      canvas.defaultCursor = "default"
      canvas.hoverCursor = "move"
    }
    canvas.requestRenderAll()
  }, [activeTool])

  // Pen Tool Logic
  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas || activeTool !== "pen") return

    // 1. Mode Switching - Disable selection when using Pen Tool
    canvas.defaultCursor = "crosshair"
    canvas.selection = false // Disable drag selection
    canvas.forEachObject((o) => (o.selectable = false))
    canvas.requestRenderAll()

    // Helper: Create Path from Bezier Points
    const createPath = (points: typeof pathPointsRef.current) => {
      if (points.length === 0) return null

      // Get stroke config from store
      const { penToolConfig } = useEditorStore.getState()

      // Construct SVG path command
      // P0 is Move.
      // Pi is Cubic to: C (Pi-1.out) (Pi.in) (Pi.anchor)
      const commands = points.map((p, index) => {
        if (index === 0) {
          return `M ${p.x} ${p.y}`
        }
        const prev = points[index - 1]!
        // Cubic Bezier: C x1 y1, x2 y2, x y
        // Control point 1: prev.cp2 (outgoing of previous)
        // Control point 2: curr.cp1 (incoming of current)
        // Anchor: curr.x curr.y
        return `C ${prev.cp2.x} ${prev.cp2.y} ${p.cp1.x} ${p.cp1.y} ${p.x} ${p.y}`
      })

      const pathData = commands.join(" ")

      // Explicitly store node modes
      const nodeModes = points.map((p) => p.nodeMode || "straight")

      return new Path(pathData, {
        stroke: penToolConfig.stroke,
        strokeWidth: penToolConfig.strokeWidth,
        strokeDashArray: penToolConfig.strokeDashArray || undefined,
        strokeLineCap: penToolConfig.strokeLineCap,
        strokeLineJoin: penToolConfig.strokeLineJoin,
        strokeMiterLimit: penToolConfig.strokeMiterLimit,
        fill: "rgba(255, 0, 0, 0.2)",
        objectCaching: false,
        selectable: false,
        evented: false,
        originX: "left",
        originY: "top",
        id: crypto.randomUUID(),
        nodeModes, // Pass explicit modes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    }

    // 2. Event Handlers for Pen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = (opt: any) => {
      if (activeTool !== "pen") return

      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current

      isDraggingRef.current = true
      dragStartPointRef.current = { x: pointer.x, y: pointer.y }

      if (points.length === 0) {
        // Start Point
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight", // Click = Straight
        })
        // Ghost Point (for preview)
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        })
      } else {
        // Real Point (replace ghost)
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y }, // Will adjust below if dragging
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight", // Explicitly default to straight
        }
        // New Ghost
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight", // Default next point to straight
        })
      }

      // Redraw
      if (activePathObjectRef.current)
        canvas.remove(activePathObjectRef.current)
      const path = createPath(points)
      if (path) {
        canvas.add(path)
        activePathObjectRef.current = path
        canvas.requestRenderAll()
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (opt: any) => {
      if (activeTool !== "pen") return
      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current
      if (points.length === 0) return

      if (isDraggingRef.current && dragStartPointRef.current) {
        // DRAGGING OUT HANDLES from the second-to-last anchor (the one we just placed)
        const anchor = points[points.length - 2]!
        const start = dragStartPointRef.current

        const rawDx = pointer.x - start.x
        const rawDy = pointer.y - start.y
        const dist = Math.hypot(rawDx, rawDy)

        // DRAG THRESHOLD: 5px
        // Only switch to curve if user intentionally drags beyond minimum
        const control_length = 5
        if (dist > control_length) {
          // Calculate effective drag distance (beyond threshold)
          const effectiveDist = dist - control_length
          const scale = (effectiveDist / dist) * 0.5 // SENSITIVITY MULTIPLIER: 0.5
          const dx = rawDx * scale
          const dy = rawDy * scale

          // cp2 (outgoing) is in the direction of the drag
          anchor.cp2 = { x: anchor.x + dx, y: anchor.y + dy }
          // cp1 (incoming) is opposite
          anchor.cp1 = { x: anchor.x - dx, y: anchor.y - dy }

          // If dragging significant amount, it's a curve -> mirrored
          anchor.nodeMode = "mirrored"
        } else {
          // Below threshold: Keep as Straight
          anchor.nodeMode = "straight"
          // Ensure handles are collapsed (in case we dragged out then back in)
          anchor.cp1 = { x: anchor.x, y: anchor.y }
          anchor.cp2 = { x: anchor.x, y: anchor.y }
        }
      } else {
        // HOVERING: Update the Ghost Point (last one) to follow mouse
        // Just move anchor, keep handles zero-length (Line behavior by default)
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        }
      }

      if (activePathObjectRef.current)
        canvas.remove(activePathObjectRef.current)
      const path = createPath(points)
      if (path) {
        canvas.add(path)
        activePathObjectRef.current = path
        canvas.requestRenderAll()
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    const handleDblClick = () => {
      if (activeTool !== "pen") return

      // Remove preview
      if (activePathObjectRef.current) {
        canvas.remove(activePathObjectRef.current)
        activePathObjectRef.current = null
      }

      const points = pathPointsRef.current
      points.pop() // Remove ghost point

      // Remove duplicate points caused by double-click (2 mousedowns)
      while (points.length > 1) {
        const last = points[points.length - 1]!
        const prev = points[points.length - 2]!
        const dist = Math.hypot(last.x - prev.x, last.y - prev.y)
        // If points are virtually identical, remove the duplicate
        if (dist < 0.5) {
          points.pop()
        } else {
          break
        }
      }

      // Close path with Z
      if (points.length > 1) {
        const { penToolConfig } = useEditorStore.getState()

        const commands = points.map((p, index) => {
          if (index === 0) {
            const cmd = ["M", p.x, p.y] as PathCommand
            // if (p.nodeMode) cmd.nodeMode = p.nodeMode
            return cmd
          }
          const prev = points[index - 1]!
          const cmd = [
            "C",
            prev.cp2.x,
            prev.cp2.y,
            p.cp1.x,
            p.cp1.y,
            p.x,
            p.y,
          ] as PathCommand

          // if (p.nodeMode) cmd.nodeMode = p.nodeMode
          return cmd
        })
        commands.push(["Z"])

        const nodeModes = points.map((p) => p.nodeMode || "straight")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = new Path(commands as any, {
          stroke: penToolConfig.stroke,
          strokeWidth: penToolConfig.strokeWidth,
          strokeDashArray: penToolConfig.strokeDashArray || undefined,
          strokeLineCap: penToolConfig.strokeLineCap,
          strokeLineJoin: penToolConfig.strokeLineJoin,
          strokeMiterLimit: penToolConfig.strokeMiterLimit,
          fill: "rgba(255, 0, 0, 0.5)",
          objectCaching: false, // Disable caching to prevent miter corners from being clipped
          exactBoundingBox: true, // Include stroke miter corners in bounding box
          selectable: true,
          evented: true,
          originX: "left",
          originY: "top",
          id: crypto.randomUUID(),
          nodeModes, // Persist explicit modes
        })

        // No longer need to attach to path data manually, as we use nodeModes property.

        const command = new AddObjectCommand(canvas, path)
        useEditorStore.getState().history.execute(command)

        // Auto-switch to select tool after completing path
        setActiveTool("select")
      }

      pathPointsRef.current = []
      isDraggingRef.current = false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool === "pen" && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault()
        handleDblClick()
        if (e.key === "Escape") {
          setActiveTool("select")
        }
      }
    }

    // Attach listeners
    canvas.on("mouse:down", handleMouseDown)
    canvas.on("mouse:move", handleMouseMove)
    canvas.on("mouse:up", handleMouseUp)
    canvas.on("mouse:dblclick", handleDblClick)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("mouse:move", handleMouseMove)
      canvas.off("mouse:up", handleMouseUp)
      canvas.off("mouse:dblclick", handleDblClick)
      window.removeEventListener("keydown", handleKeyDown)

      // CRITICAL: Restore selection when leaving Pen Tool
      canvas.selection = true
      canvas.forEachObject((o) => (o.selectable = true))
      canvas.requestRenderAll()
    }
  }, [activeTool, setActiveTool])

  // --- Path Editing Logic ---
  const editingPathRef = useRef<Path | null>(null)
  const controlsRef = useRef<FabricObject[]>([])
  const clearControlsRef = useRef<(() => void) | null>(null)
  // 用于历史记录：存储进入编辑模式时的节点快照（用于退出时创建单一历史命令）
  const editModeEntryNodesRef = useRef<{
    nodes: import("@/types/fabric").PathNode[]
    closed: boolean
  } | null>(null)
  // 用于右键取消：存储拖动开始时的控制点节点状态
  const controlDragStartRef = useRef<{
    nodeIndex: number
    anchor: { x: number; y: number }
    handleIn: { x: number; y: number }
    handleOut: { x: number; y: number }
    type: "anchor" | "handle_in" | "handle_out"
  } | null>(null)

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    const removeControlsVisuals = () => {
      controlsRef.current.forEach((c) => canvas.remove(c))
      controlsRef.current = []

      if (editingPathRef.current) {
        const pathObj = editingPathRef.current as EditablePath
        const ghostPath = pathObj._ghostPath
        if (ghostPath) {
          // Call breathing animation cleanup before removing ghost path
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cleanup = (ghostPath as any)._cleanupBreathing
          if (typeof cleanup === "function") cleanup()
          canvas.remove(ghostPath)
        }
      }
    }

    const clearControls = () => {
      // Notify Store
      useEditorStore.getState().setEditingPath(null)

      removeControlsVisuals()

      // Restore selection globally
      canvas.selection = true
      canvas.forEachObject((o) => {
        // Don't enable ghost or controls (they are gone anyway), but good practice
        const obj = o as EditablePath & ControlPoint
        if (!obj.isGhost && !obj.excludeFromExport) {
          obj.selectable = true
          obj.evented = true
        }
      })

      // Edit mode operations are NOT tracked in history
      // Clear entry snapshot without creating any history command
      editModeEntryNodesRef.current = null

      if (editingPathRef.current) {
        const oldPath = editingPathRef.current as EditablePath

        // Save the visual position of the first command before recreation
        const firstCmd = oldPath.path[0]
        if (!firstCmd || firstCmd.length < 3) return

        // Get world position of first point BEFORE recreation
        const oldMatrix = oldPath.calcTransformMatrix()
        const oldOffset = oldPath.pathOffset || { x: 0, y: 0 }
        const oldLocalX = (firstCmd[1] as number) - oldOffset.x
        const oldLocalY = (firstCmd[2] as number) - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        // Create a new array reference to force Fabric.js to recalculate dimensions
        const newPathData = oldPath.path.map((cmd) => [...cmd]) as PathCommand[]

        // Recreate the Path object entirely to force proper dimension calculation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPath = new Path(newPathData as any, {
          fill: oldPath.fill,
          // CRITICAL: Restore original stroke if we were highlighting it
          stroke: oldPath._originalStroke || oldPath.stroke,

          strokeWidth: oldPath._originalStrokeWidth || oldPath.strokeWidth,
          strokeLineJoin: oldPath.strokeLineJoin,
          strokeMiterLimit: oldPath.strokeMiterLimit,
          strokeLineCap: oldPath.strokeLineCap,
          strokeDashArray: oldPath.strokeDashArray,
          objectCaching: false, // Disable caching to prevent miter corners from being clipped
          exactBoundingBox: true, // Include stroke miter corners in bounding box
          id: oldPath.id,
          scaleX: oldPath.scaleX,
          scaleY: oldPath.scaleY,
          angle: oldPath.angle,
          originX: oldPath.originX,
          originY: oldPath.originY,
          flipX: oldPath.flipX,
          flipY: oldPath.flipY,
          selectable: true,
          evented: true,
        })

        // CRITICAL: 复制 customPathData，避免重新进入编辑模式时重新解析导致节点重复
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((oldPath as any).customPathData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(newPath as any).customPathData = (oldPath as any).customPathData
        }

        // Get world position of first point AFTER recreation with left=0, top=0
        const newMatrix = newPath.calcTransformMatrix()
        const newOffset = newPath.pathOffset || { x: 0, y: 0 }
        const newLocalX = firstCmd[1]! - newOffset.x
        const newLocalY = firstCmd[2]! - newOffset.y
        const newWorldPt = new Point(newLocalX, newLocalY).transform(newMatrix)

        // Adjust position so first point stays at same world position
        const deltaX = oldWorldPt.x - newWorldPt.x
        const deltaY = oldWorldPt.y - newWorldPt.y

        newPath.set({
          left: (newPath.left || 0) + deltaX,
          top: (newPath.top || 0) + deltaY,
        })

        // Remove old path and add new one
        canvas.remove(oldPath)
        canvas.add(newPath)
        canvas.setActiveObject(newPath)
        newPath.setCoords()

        editingPathRef.current = null
      }
      canvas.requestRenderAll()
    }

    // Expose clearControls to be callable from outside (e.g., setActivePage)
    clearControlsRef.current = clearControls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(canvas as any).exitEditMode = clearControls

    /**
     * 核心生成器：从节点数组重建 SVG Path
     */
    const regeneratePath = () => {
      if (!editingPathRef.current) return
      const pathObj = editingPathRef.current as EditablePath & {
        customPathData?: CustomPathData
      }

      if (!pathObj.customPathData) {
        console.warn("No customPathData found on path object")
        return
      }

      // 生成新的 SVG Path Commands
      const newCommands = nodesToSvgPath(pathObj.customPathData)

      // 更新 Path 对象
      pathObj.set({ path: newCommands })
      pathObj.setCoords()
      pathObj.dirty = true

      // Note: Ghost path will be recreated on mouse up for stability
    }

    // === NEW: Simplified refresh (uses enterEditMode) ===
    // === NEW: Simplified refresh (uses enterEditMode) ===
    const refreshControlLines = () => {
      const controls = controlsRef.current as ControlPoint[]
      const anchorsByIndex: Map<number, ControlPoint> = new Map()
      const handleInByIndex: Map<number, ControlPoint> = new Map()
      const handleOutByIndex: Map<number, ControlPoint> = new Map()

      controls.forEach((ctrl) => {
        const data = ctrl.data
        if (!data) return

        if (data.type === "anchor") {
          anchorsByIndex.set(data.nodeIndex, ctrl)
        } else if (data.type === "handle_in") {
          handleInByIndex.set(data.nodeIndex, ctrl)
        } else if (data.type === "handle_out") {
          handleOutByIndex.set(data.nodeIndex, ctrl)
        }
      })

      // Actual simpler approach: find controls with .line property and update
      controls.forEach((ctrl) => {
        const c = ctrl
        if (c.data?.type === "handle_in" && c.line) {
          // handleIn connects to its OWN anchor (not previous!)
          const nodeIndex = c.data.nodeIndex
          const anchor = anchorsByIndex.get(nodeIndex)
          if (anchor) {
            c.line.set({
              x1: anchor.left,
              y1: anchor.top,
              x2: c.left,
              y2: c.top,
            })
            c.line.setCoords()
          }
        }
        if (c.data?.type === "handle_out" && c.line) {
          // handleOut connects to its OWN anchor
          const nodeIndex = c.data.nodeIndex
          const anchor = anchorsByIndex.get(nodeIndex)
          if (anchor) {
            c.line.set({
              x1: anchor.left,
              y1: anchor.top,
              x2: c.left,
              y2: c.top,
            })
            c.line.setCoords()
          }
        }
      })

      canvas.requestRenderAll()
    }

    const createControl = (
      x: number,
      y: number,
      type: "anchor" | "handle_in" | "handle_out",
      nodeIndex: number,
      nodeMode: NodeMode
    ) => {
      // Get current zoom from Fabric.js canvas for proper inverse scaling
      const currentCanvas = useEditorStore.getState().canvas
      const currentZoom = currentCanvas?.getZoom() || 1
      const baseRadius = type === "anchor" ? 5 : 3
      const baseStrokeWidth = 1
      const basePadding = type === "anchor" ? 10 : 5

      const circle = new Circle({
        left: x,
        top: y,
        radius: baseRadius / currentZoom,
        fill: type === "anchor" ? "#0000ff" : "#ffffff",
        stroke: "#0000ff",
        strokeWidth: baseStrokeWidth / currentZoom,
        originX: "center",
        originY: "center",
        hasControls: false,
        hasBorders: false,
        selectable: true,
        padding: basePadding / currentZoom, // Increase hit area
        // Custom props
        data: { type, nodeIndex, nodeMode },
        excludeFromExport: true, // CRITICAL: Do not save controls to JSON
      })
      return circle as ControlPoint
    }

    const enterEditMode = (pathObj: Path) => {
      // === STEP 1: 初始化 customPathData ===
      const pathWithData = pathObj as EditablePath & {
        customPathData?: CustomPathData
      }

      if (!pathWithData.customPathData) {
        console.log(
          "[Node-Centric] First-time initialization: converting SVG Path to nodes..."
        )

        // STEP 1: Normalize path FIRST (only on first init)
        // Force all segments to be C commands to support handles.
        const rawCmds = pathObj.path as PathCommand[]
        let normalized = false
        const newCmds: PathCommand[] = []
        let lx = 0,
          ly = 0,
          sx = 0,
          sy = 0

        if (rawCmds) {
          rawCmds.forEach((cmd) => {
            if (cmd[0] === "M") {
              sx = cmd[1] as number
              sy = cmd[2] as number
              lx = sx
              ly = sy
              newCmds.push(cmd)
            } else if (cmd[0] === "L") {
              normalized = true
              const x = cmd[1] as number
              const y = cmd[2] as number
              // L -> C (Straight, 0 handles)
              newCmds.push(["C", lx, ly, x, y, x, y])
              lx = x
              ly = y
            } else if (cmd[0] === "C") {
              lx = cmd[5] as number
              ly = cmd[6] as number
              newCmds.push(cmd)
            } else if (cmd[0] === "Z") {
              // Just pass through Z command, don't auto-close with C
              // The path drawing tool should handle closure correctly
              newCmds.push(["Z"])
              lx = sx // Reset to start for any subsequent commands
              ly = sy
            }
          })

          if (normalized) {
            pathObj.set({ path: newCmds })
            pathObj.setCoords()
            console.log("[Node-Centric] Path normalized (L->C conversion)")
          }
        }

        // STEP 2: Parse the (now normalized) path, passing nodeModes if available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathAny = pathObj as any
        pathWithData.customPathData = svgPathToNodes(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pathObj.path as any[],
          pathAny.nodeModes // 传递 Pen Tool 绘制时保存的节点模式
        )
        console.log(
          "[Node-Centric] Created",
          pathWithData.customPathData.nodes.length,
          "nodes"
        )
      } else {
        console.log(
          "[Node-Centric] Using existing customPathData (preserving user edits & modes)"
        )
      }

      if (editingPathRef.current) {
        if (editingPathRef.current !== pathObj) {
          clearControls() // Proper exit of previous path
        } else {
          removeControlsVisuals() // Just refresh styling for same path
        }
      }

      // Notify Store for UI updates
      useEditorStore.getState().setEditingPath(pathObj)

      editingPathRef.current = pathObj

      // Save entry snapshot for history (only on fresh entry, not refresh)
      if (!editModeEntryNodesRef.current && pathWithData.customPathData) {
        editModeEntryNodesRef.current = {
          nodes: JSON.parse(JSON.stringify(pathWithData.customPathData.nodes)),
          closed: pathWithData.customPathData.closed,
        }
        console.log("[Edit Mode] Entry snapshot saved")
      }

      // 1. Disable interaction on the main path (so mouse ignores fill)
      pathObj.selectable = false
      pathObj.evented = false
      pathObj.objectCaching = false

      // Disable selection of EVERYTHING else
      canvas.selection = false // Disable drag selection
      canvas.forEachObject((o) => {
        o.selectable = false
        o.evented = false // Prevent clicking through to other objects
      })

      // 2. Create Ghost Path for interaction (Stroke Only)
      // 方案 B: 让幽灵路径自己计算 pathOffset，然后补偿位置差异
      const ghostPath = new Path(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathObj.path as any,
        {
          objectCaching: false,
          fill: "", // Transparent fill prevents mouse detection on fill area
          // CRITICAL: Must not be fully transparent for hit detection to work!
          stroke: "#4f46e5", // KEEP VISIBLE FOR DEBUGGING
          strokeWidth: pathObj.strokeWidth || 1, // Match original width exactly
          strokeUniform: pathObj.strokeUniform, // Copy uniform scaling
          // Copy stroke style properties to match original path appearance
          strokeLineCap: pathObj.strokeLineCap,
          strokeLineJoin: pathObj.strokeLineJoin,
          strokeMiterLimit: pathObj.strokeMiterLimit,
          strokeDashArray: pathObj.strokeDashArray,
          strokeDashOffset: pathObj.strokeDashOffset,
          selectable: true, // Allow selecting to inspect data
          evented: true, // This object captures events
          perPixelTargetFind: true, // CRITICAL: Only stroke pixels trigger events
          hoverCursor: "default", // CRITICAL: Don't show selection cursor

          // 只复制缩放/旋转，不复制位置和 pathOffset
          scaleX: pathObj.scaleX,
          scaleY: pathObj.scaleY,
          angle: pathObj.angle,
          skewX: pathObj.skewX,
          skewY: pathObj.skewY,
          originX: pathObj.originX,
          originY: pathObj.originY,
          // 不设置 left, top, pathOffset - 让 Fabric 自己计算

          excludeFromExport: true, // Don't save

          isGhost: true, // Mark as ghost to prevent double-click editing
          // Lock movement to prevent accidental manipulation
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          hasControls: false,
          hasBorders: true, // Show border when selected to indicate selection

          // Carry Data for Inspection
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customPathData: (pathObj as any).customPathData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      )

      // 计算位置补偿：对齐第一个点的世界坐标
      const firstCmd = pathObj.path[0]
      if (firstCmd && firstCmd.length >= 3) {
        // 原始路径第一个点的世界坐标
        const oldMatrix = pathObj.calcTransformMatrix()
        const oldOffset = pathObj.pathOffset || { x: 0, y: 0 }
        const oldLocalX = (firstCmd[1] as number) - oldOffset.x
        const oldLocalY = (firstCmd[2] as number) - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        // 幽灵路径第一个点的世界坐标
        const ghostMatrix = ghostPath.calcTransformMatrix()
        const ghostOffset = ghostPath.pathOffset || { x: 0, y: 0 }
        const ghostLocalX = (firstCmd[1] as number) - ghostOffset.x
        const ghostLocalY = (firstCmd[2] as number) - ghostOffset.y
        const ghostWorldPt = new Point(ghostLocalX, ghostLocalY).transform(
          ghostMatrix
        )

        // 补偿差异
        const dx = oldWorldPt.x - ghostWorldPt.x
        const dy = oldWorldPt.y - ghostWorldPt.y
        ghostPath.set({
          left: (ghostPath.left || 0) + dx,
          top: (ghostPath.top || 0) + dy,
        })
        ghostPath.setCoords()
      }

      console.log(
        "Ghost Path created. Original:",
        pathObj.strokeWidth,
        "Ghost:",
        ghostPath.strokeWidth
      )
      canvas.add(ghostPath)

      // Attach to pathObj for updates and cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(pathObj as any)._ghostPath = ghostPath

      canvas.discardActiveObject() // Deselect everything

      // 3. Hover Logic on Ghost Path with Breathing Animation
      // Store shared state on pathObj for access by recreateGhostPath
      const highlightColor = "#4f46e5"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathAny = pathObj as any
      pathAny._ghostHoverState = {
        breathingAnimationId: null as number | null,
        hoverIndicator: null as Circle | null,
        isHovering: false,
        highlightColor,
        lastClickTime: 0, // For double-click detection
      }

      // Helper to bind ghost path events (reusable for recreateGhostPath)
      const bindGhostPathEvents = (gp: Path) => {
        const state = pathAny._ghostHoverState

        // Create hover indicator circle (hollow)
        const createHoverIndicator = () => {
          if (state.hoverIndicator) return state.hoverIndicator
          const currentZoom = useEditorStore.getState().zoom
          state.hoverIndicator = new Circle({
            radius: 6 / currentZoom,
            fill: "transparent",
            stroke: state.highlightColor,
            strokeWidth: 2 / currentZoom,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
            excludeFromExport: true,
            visible: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          canvas.add(state.hoverIndicator)
          return state.hoverIndicator
        }

        // Breathing animation function
        const startBreathingAnimation = () => {
          if (state.breathingAnimationId !== null) return

          let opacity = 1
          let increasing = false
          const minOpacity = 0.3
          const maxOpacity = 1
          const step = 0.03

          const animate = () => {
            if (!gp || !canvas) return

            // Update opacity
            if (increasing) {
              opacity += step
              if (opacity >= maxOpacity) {
                opacity = maxOpacity
                increasing = false
              }
            } else {
              opacity -= step
              if (opacity <= minOpacity) {
                opacity = minOpacity
                increasing = true
              }
            }

            // Apply breathing effect to ghost path
            gp.set({ opacity })

            // Apply to hover indicator if visible
            if (state.hoverIndicator && state.hoverIndicator.visible) {
              state.hoverIndicator.set({ opacity })
            }

            canvas.requestRenderAll()
            state.breathingAnimationId = requestAnimationFrame(animate)
          }

          state.breathingAnimationId = requestAnimationFrame(animate)
        }

        // Stop breathing animation
        const stopBreathingAnimation = () => {
          if (state.breathingAnimationId !== null) {
            cancelAnimationFrame(state.breathingAnimationId)
            state.breathingAnimationId = null
          }
          // Reset opacity
          gp.set({ opacity: 1 })
          if (state.hoverIndicator) {
            state.hoverIndicator.set({ visible: false, opacity: 1 })
          }
          canvas.requestRenderAll()
        }

        // Update hover indicator to follow mouse pointer exactly
        const updateHoverIndicatorPosition = (e: {
          pointer?: Point
          e?: MouseEvent
        }) => {
          if (!state.hoverIndicator) return

          const indicator = state.hoverIndicator
          // Get pointer position from event
          let pointer: { x: number; y: number } | null = null
          if (e.pointer) {
            pointer = e.pointer
          } else if (e.e && canvas) {
            // Fabric object events may not have pointer, get from canvas
            const canvasPointer = canvas.getViewportPoint(e.e)
            pointer = { x: canvasPointer.x, y: canvasPointer.y }
          }
          if (!pointer) return

          // Position indicator exactly at mouse pointer
          indicator.set({
            left: pointer.x,
            top: pointer.y,
            visible: true,
          })
          indicator.setCoords()
        }

        gp.on("mouseover", () => {
          state.isHovering = true
          createHoverIndicator()
          startBreathingAnimation()
          canvas.requestRenderAll()
        })

        gp.on("mousemove", (e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateHoverIndicatorPosition(e as any)
          canvas.requestRenderAll()
        })

        gp.on("mouseout", () => {
          state.isHovering = false
          stopBreathingAnimation()
          // Keep ghost path visible with highlight color (don't hide it)
          gp.set({ stroke: state.highlightColor, opacity: 1 })
          canvas.requestRenderAll()
        })

        gp.on("mousedown", (e) => {
          const mouseEvent = e.e as MouseEvent

          // Only handle left mouse button clicks
          if (mouseEvent.button !== 0) return

          // Double-click detection (300ms threshold)
          const now = Date.now()
          const timeSinceLastClick = now - state.lastClickTime
          state.lastClickTime = now

          // If not a double-click, just return
          if (timeSinceLastClick > 300) {
            return
          }

          // Reset lastClickTime to prevent triple-click triggering
          state.lastClickTime = 0

          // Get current path object and its data
          const pathObj = editingPathRef.current
          if (!pathObj) return

          const pathWithData = pathObj as EditablePath & {
            customPathData?: CustomPathData
          }
          if (!pathWithData.customPathData) return

          // Get mouse position in canvas coordinates
          const pointer = canvas.getViewportPoint(mouseEvent)

          // Transform canvas coordinates to path local coordinates
          const matrix = pathObj.calcTransformMatrix()
          const invertedMatrix = util.invertTransform(matrix)
          const localPoint = new Point(pointer.x, pointer.y).transform(
            invertedMatrix
          )
          const offset = pathObj.pathOffset || { x: 0, y: 0 }
          const rawPoint = {
            x: localPoint.x + offset.x,
            y: localPoint.y + offset.y,
          }

          // Find the closest segment to the click position
          const result = findClosestSegment(
            pathWithData.customPathData.nodes,
            rawPoint,
            pathWithData.customPathData.closed,
            20 // threshold in pixels
          )

          if (!result) {
            console.log("Ghost path double-clicked but no segment found nearby")
            return
          }

          const { segmentIndex, t } = result
          const nodes = pathWithData.customPathData.nodes

          // Determine new node mode based on adjacent nodes
          const prevNode = nodes[segmentIndex]
          const nextNode = nodes[(segmentIndex + 1) % nodes.length]

          if (!prevNode || !nextNode) return

          const newMode: NodeMode =
            prevNode.mode === "straight" && nextNode.mode === "straight"
              ? "straight"
              : "mirrored"

          console.log(
            `Adding node at segment ${segmentIndex}, t=${t.toFixed(3)}, mode=${newMode}`
          )

          // Insert the new node
          const newNodes = insertNodeAtSegment(nodes, segmentIndex, t, newMode)

          // Update path data
          pathWithData.customPathData.nodes = newNodes

          // Regenerate path and refresh edit mode
          regeneratePath()
          enterEditMode(pathObj)

          // Stop event propagation
          mouseEvent.stopPropagation()
          mouseEvent.preventDefault()
        })

        // Cleanup function for when editing ends
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(gp as any)._cleanupBreathing = () => {
          stopBreathingAnimation()
          if (state.hoverIndicator) {
            canvas.remove(state.hoverIndicator)
            state.hoverIndicator = null
          }
        }
      }

      // Store the bind function on pathObj for use in recreateGhostPath
      pathAny._bindGhostPathEvents = bindGhostPathEvents

      // Bind events to initial ghost path
      bindGhostPathEvents(ghostPath)

      // 4. Sync prop changes (e.g. from panel) to Ghost Path
      // This function syncs ghost path AND refreshes control point positions
      const syncPropsAndControls = () => {
        // Sync strokeWidth to ghost path
        ghostPath.set({ strokeWidth: pathObj.strokeWidth || 1 })

        // CRITICAL: Also update control point positions
        // When strokeWidth changes, the path's transform matrix might change
        // So we need to recalculate anchor positions
        const matrix = pathObj.calcTransformMatrix()
        const transformPoint = (x: number, y: number) => {
          const offset = pathObj.pathOffset || { x: 0, y: 0 }
          const localX = x - offset.x
          const localY = y - offset.y
          return new Point(localX, localY).transform(matrix)
        }

        // Update all control point positions based on current node data
        const pathWithData = pathObj as EditablePath & {
          customPathData?: CustomPathData
        }
        if (pathWithData.customPathData) {
          const { nodes } = pathWithData.customPathData
          const controls = controlsRef.current as ControlPoint[]

          controls.forEach((ctrl) => {
            const data = ctrl.data
            if (!data) return

            const node = nodes[data.nodeIndex]
            if (!node) return

            if (data.type === "anchor") {
              const p = transformPoint(node.anchor.x, node.anchor.y)
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            } else if (data.type === "handle_in" && node.mode === "mirrored") {
              // Use display-transformed position for handles
              const displayHandleIn = actualToDisplay(node.handleIn)
              const p = transformPoint(
                node.anchor.x + displayHandleIn.x,
                node.anchor.y + displayHandleIn.y
              )
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            } else if (data.type === "handle_out" && node.mode === "mirrored") {
              // Use display-transformed position for handles
              const displayHandleOut = actualToDisplay(node.handleOut)
              const p = transformPoint(
                node.anchor.x + displayHandleOut.x,
                node.anchor.y + displayHandleOut.y
              )
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            }
          })

          // Also refresh control lines
          refreshControlLines()
        }

        // Recreate ghost path to ensure proper alignment
        recreateGhostPath()

        canvas.requestRenderAll()
      }

      // Listen to both path-specific and canvas-level events
      pathObj.on("modified", syncPropsAndControls)

      canvas.requestRenderAll()

      // Ensure we have absolute coordinates for controls?
      // Fabric Path commands are relative to path's left/top if created with path data?
      // Actually fabric.Path stores commands, but rendering transforms them.
      // Editing "in place" requires dealing with the object's Matrix.
      // For MVP Phase 3: We assume simple paths without rotation/scaling for now,
      // OR we transform points to canvas space.

      // Simpler approach for MVP:
      // When entering edit mode, we might need to "reset" the path's transform or
      // translate controls to its transform.
      // Let's rely on pathObj.chart (path data) being raw?

      // CAUTION: Fabric.Path behaves complexly with transforms.
      // The commands are in local coordinate space (relative to object center/corner).
      // To make this robust:
      // We will project the local command points to canvas coordinates for the controls.
      // When controls are moved, we project back to local space to update command.

      const matrix = pathObj.calcTransformMatrix()
      // Transform path coordinates to canvas coordinates
      // Path coordinates are relative to pathOffset (center of bounding box)
      // We need to convert to local space, then apply the object's transform matrix
      const transformPoint = (x: number, y: number) => {
        const offset = pathObj.pathOffset || { x: 0, y: 0 }
        // Local coordinates: subtract pathOffset, then add half width/height to get top-left relative
        const localX = x - offset.x
        const localY = y - offset.y
        return new Point(localX, localY).transform(matrix)
      }

      /*
      // ===  OLD SVG COMMAND LOOP (DISABLED) ===
      pathCommands.forEach((cmd, i) => {
        // USE EXPLICIT MODE if available, otherwise INFER
        if (nodeModes[i]) {
          cmd.nodeMode = nodeModes[i]
        } else {
          // INFER MODE
          if (cmd[0] === "C") {
            const anchorX = cmd[5] as number
            const anchorY = cmd[6] as number
            const cp2X = cmd[3] as number
            const cp2Y = cmd[4] as number

            let prevX = 0,
              prevY = 0
            if (i > 0) {
              const prev = pathCommands[i - 1]
              if (prev) {
                prevX = prev[prev.length - 2] as number
                prevY = prev[prev.length - 1] as number
              }
            }

            const cp1X = cmd[1] as number
            const cp1Y = cmd[2] as number

            const isSegmentLinear =
              Math.abs(cp2X - anchorX) < 0.1 &&
              Math.abs(cp2Y - anchorY) < 0.1 &&
              Math.abs(cp1X - prevX) < 0.1 &&
              Math.abs(cp1Y - prevY) < 0.1

            if (isSegmentLinear) {
              cmd.nodeMode = "straight"
            } else {
              cmd.nodeMode = "mirrored"
            }
          } else {
            cmd.nodeMode = "straight"
          }
          // Backfill
          nodeModes[i] = cmd.nodeMode
        }

        const nodeMode: NodeMode = cmd.nodeMode || "straight"

        if (cmd[0] === "M") {
          const p = transformPoint(cmd[1] as number, cmd[2] as number)
          const anchor = createControl(p.x, p.y, "anchor", cmd, i, nodeMode)
          canvas.add(anchor)
          // canvas.bringObjectToFront(anchor) // Moved to end
          controlsRef.current.push(anchor)
        }
        if (cmd[0] === "L") {
          const p = transformPoint(cmd[1] as number, cmd[2] as number)
          const anchor = createControl(p.x, p.y, "anchor", cmd, i, nodeMode)
          canvas.add(anchor)
          controlsRef.current.push(anchor)
        }
        if (cmd[0] === "C") {
          // C x1 y1, x2 y2, x y
          const p1 = transformPoint(cmd[1] as number, cmd[2] as number) // Control 1
          const p2 = transformPoint(cmd[3] as number, cmd[4] as number) // Control 2
          const p = transformPoint(cmd[5] as number, cmd[6] as number) // Anchor

          // Check if this is a closing segment that lands on Start Point (M)
          // If so, we skip creating a DUPLICATE anchor because M (Index 0) already has one.
          // This avoids the "double point" visual glitch.
          let isClosingSegment = false
          if (
            pathCommands.length > 2 &&
            pathCommands[pathCommands.length - 1][0] === "Z" &&
            i === pathCommands.length - 2
          ) {
            const startCmd = pathCommands[0]
            if (startCmd) {
              const startP = transformPoint(
                startCmd[1] as number,
                startCmd[2] as number
              )
              if (
                Math.abs(p.x - startP.x) < 0.1 &&
                Math.abs(p.y - startP.y) < 0.1
              ) {
                isClosingSegment = true
              }
            }
          }

          let anchor: ControlPoint | undefined
          if (!isClosingSegment) {
            anchor = createControl(p.x, p.y, "anchor", cmd, i, nodeMode)
            canvas.add(anchor)
            controlsRef.current.push(anchor)
          }

          // Lines
          // Logic for finding prev anchor for l1
          const prevCmd = pathCommands[i - 1]
          let prevX = 0,
            prevY = 0
          if (prevCmd) {
            const len = prevCmd.length
            prevX = prevCmd[len - 2] as number
            prevY = prevCmd[len - 1] as number
          }
          const prevP = transformPoint(prevX, prevY)

          // Decouple Handle Creation
          const prevMode =
            i > 0 && nodeModes[i - 1] ? nodeModes[i - 1] : "straight"
          const currMode = nodeModes[i] || "straight"

          // Create Handle 1 (CP1 - Handle Out of Prev)
          if (prevMode === "mirrored") {
            const handle1 = createControl(
              p1.x,
              p1.y,
              "handle_in",
              cmd,
              i,
              prevMode
            )
            const l1 = createLine(prevP, p1)
            canvas.add(l1, handle1)
            controlsRef.current.push(l1, handle1)

            const h1 = handle1 as ControlPoint
            h1.line = l1
            h1.lineFromAnchor = true
          }

          // Create Handle 2 (CP2 - Handle In of Curr)
          if (currMode === "mirrored") {
            const handle2 = createControl(
              p2.x,
              p2.y,
              "handle_out",
              cmd,
              i,
              currMode
            )
            const l2 = createLine(p, p2)
            canvas.add(l2, handle2)
            controlsRef.current.push(l2, handle2)

            const h2 = handle2 as ControlPoint
            h2.line = l2

            if (anchor) {
              const anc = anchor as ControlPoint
              anc.lineToHandle = l2
              anc.handle = h2
            }
          }
        }
      })
      */

      // Update source of truth (nodeModes不再需要，但暂时保留兼容)
      // pathObj.nodeModes = nodeModes

      // === NODE-BASED CONTROL CREATION (NEW) ===
      // 从 nodes 数组创建控件，替代上面的 SVG Command 遍历
      const { nodes } = pathWithData.customPathData

      nodes.forEach((node, nodeIndex) => {
        const { anchor } = node
        const p = transformPoint(anchor.x, anchor.y)

        // 1. Create Anchor
        const anchorCtrl = createControl(
          p.x,
          p.y,
          "anchor",
          nodeIndex,
          node.mode
        )
        canvas.add(anchorCtrl)
        controlsRef.current.push(anchorCtrl)

        // 2. Create Handles (if Mirrored)
        // Only show handles if mode is mirrored (or later: detached)
        if (node.mode === "mirrored") {
          // Apply display transformation to handle offsets
          const displayHandleIn = actualToDisplay(node.handleIn)
          const displayHandleOut = actualToDisplay(node.handleOut)

          // Handle In - use display-transformed position
          const pIn = transformPoint(
            anchor.x + displayHandleIn.x,
            anchor.y + displayHandleIn.y
          )
          const handleIn = createControl(
            pIn.x,
            pIn.y,
            "handle_in",
            nodeIndex,
            node.mode
          )

          // Create Line for Handle In
          const currentZoom = useEditorStore.getState().zoom
          const lineIn = new Line([p.x, p.y, pIn.x, pIn.y], {
            stroke: "#888888",
            strokeWidth: 1 / currentZoom,
            selectable: false,
            evented: false,
            originX: "center",
            originY: "center",
            excludeFromExport: true,
          })

          // Handle Out - use display-transformed position
          const pOut = transformPoint(
            anchor.x + displayHandleOut.x,
            anchor.y + displayHandleOut.y
          )
          const handleOut = createControl(
            pOut.x,
            pOut.y,
            "handle_out",
            nodeIndex,
            node.mode
          )

          // Create Line for Handle Out
          const lineOut = new Line([p.x, p.y, pOut.x, pOut.y], {
            stroke: "#888888",
            strokeWidth: 1 / currentZoom,
            selectable: false,
            evented: false,
            originX: "center",
            originY: "center",
            excludeFromExport: true,
          })

          // Link them for easy update
          handleIn.line = lineIn
          handleOut.line = lineOut

          // Add everything to canvas and refs
          // Order: lines first (behind), then handles
          canvas.add(lineIn, lineOut, handleIn, handleOut)
          controlsRef.current.push(lineIn, lineOut, handleIn, handleOut)
        }
      })

      // CRITICAL: Bring all anchors to front to ensure they are above any handles
      controlsRef.current.forEach((c) => {
        const cp = c as ControlPoint
        if (cp.data?.type === "anchor") {
          canvas.bringObjectToFront(cp)
        }
      })

      canvas.requestRenderAll()
    }

    const handleDblClick = (e: { target?: FabricObject }) => {
      if (activeTool !== "select") return

      // Double-click on blank space exits edit mode
      if (editingPathRef.current && !e.target) {
        clearControls()
        return
      }

      if (e.target && e.target.type === "path") {
        // Prevent re-entry if already editing this path (or a replacement of it)
        // Since we recreate paths, checking reference equality might be tricky if user clicks fast.
        // But usually editingPathRef.current is the active one.
        if (editingPathRef.current === e.target) return

        // Ignore Ghost Paths
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e.target as any).isGhost) return

        enterEditMode(e.target as Path)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = (e: any) => {
      // Note: Single-click on blank space no longer exits edit mode
      // Use double-click to exit edit mode instead
      // Edit mode operations are tracked as a single undo step when exiting

      if (!editingPathRef.current) return

      const pathObj = editingPathRef.current as EditablePath
      const pathWithData = pathObj as EditablePath & {
        customPathData?: CustomPathData
      }
      if (!pathWithData.customPathData) return

      const target = e.target as ControlPoint
      const mouseEvent = e.e as MouseEvent

      // 右键点击：如果正在拖动控制点，恢复原始位置
      if (mouseEvent.button === 2 && controlDragStartRef.current) {
        const saved = controlDragStartRef.current
        const node = pathWithData.customPathData.nodes[saved.nodeIndex]
        if (node) {
          // 恢复节点数据
          node.anchor = { ...saved.anchor }
          node.handleIn = { ...saved.handleIn }
          node.handleOut = { ...saved.handleOut }

          // 重新生成路径和刷新控制点
          regeneratePath()
          enterEditMode(pathObj)
        }
        controlDragStartRef.current = null
        return
      }

      // 左键点击控制点：捕获开始状态
      if (mouseEvent.button === 0 && target?.data) {
        const nodeIndex = target.data.nodeIndex
        const node = pathWithData.customPathData.nodes[nodeIndex]
        if (node) {
          controlDragStartRef.current = {
            nodeIndex,
            type: target.data.type,
            anchor: { ...node.anchor },
            handleIn: { ...node.handleIn },
            handleOut: { ...node.handleOut },
          }
        }
      }
    }

    const handleObjectMoving = (e: { target: FabricObject }) => {
      if (!editingPathRef.current) return
      const target = e.target as ControlPoint
      const data = target.data
      if (!data) return

      // === NODE-BASED DRAGGING (NEW) ===
      const pathObj = editingPathRef.current
      const pathWithData = pathObj as EditablePath & {
        customPathData?: CustomPathData
      }

      if (!pathWithData.customPathData) {
        console.warn("[handleObjectMoving] No customPathData")
        return
      }

      const { nodes } = pathWithData.customPathData
      const nodeIndex = data.nodeIndex

      if (nodeIndex === undefined || !nodes[nodeIndex]) {
        console.warn("[handleObjectMoving] Invalid nodeIndex:", nodeIndex)
        return
      }

      // 坐标转换
      const matrix = pathObj.calcTransformMatrix()
      const invertedMatrix = util.invertTransform(matrix)
      const localPoint = new Point(target.left, target.top).transform(
        invertedMatrix
      )
      const offset = pathObj.pathOffset || { x: 0, y: 0 }
      const rawX = localPoint.x + offset.x
      const rawY = localPoint.y + offset.y

      // 处理锚点拖动
      if (data.type === "anchor") {
        const node = nodes[nodeIndex]

        // 直接更新节点位置
        node.anchor.x = rawX
        node.anchor.y = rawY

        // 重新生成 SVG Path
        regeneratePath()

        // 更新关联的控制柄位置（如果是 mirrored 模式）
        if (node.mode === "mirrored") {
          // Helper to convert Path Coordinate to Canvas Coordinate
          const transformPoint = (x: number, y: number) => {
            const off = pathObj.pathOffset || { x: 0, y: 0 }
            const localX = x - off.x
            const localY = y - off.y
            return new Point(localX, localY).transform(matrix)
          }

          // 找到关联的控制柄并更新位置（使用显示转换后的位置）
          const controls = controlsRef.current as ControlPoint[]
          const displayHandleIn = actualToDisplay(node.handleIn)
          const displayHandleOut = actualToDisplay(node.handleOut)

          controls.forEach((ctrl) => {
            if (ctrl.data?.nodeIndex !== nodeIndex) return

            if (ctrl.data.type === "handle_in") {
              const newPos = transformPoint(
                node.anchor.x + displayHandleIn.x,
                node.anchor.y + displayHandleIn.y
              )
              ctrl.set({ left: newPos.x, top: newPos.y })
              ctrl.setCoords()
            } else if (ctrl.data.type === "handle_out") {
              const newPos = transformPoint(
                node.anchor.x + displayHandleOut.x,
                node.anchor.y + displayHandleOut.y
              )
              ctrl.set({ left: newPos.x, top: newPos.y })
              ctrl.setCoords()
            }
          })
        }

        // 刷新控件连线
        refreshControlLines()
        return
      }

      // 处理 Handle 拖动
      if (data.type === "handle_in" || data.type === "handle_out") {
        const node = nodes[nodeIndex]
        const anchor = node.anchor

        // 鼠标位置直接作为显示空间的控制点位置
        // rawX, rawY 是路径本地坐标系中的位置
        // 显示偏移 = 鼠标位置 - 锚点位置
        const displayDx = rawX - anchor.x
        const displayDy = rawY - anchor.y

        // Convert display offset back to actual offset for storage
        const actualOffset = displayToActual({ x: displayDx, y: displayDy })
        const dx = actualOffset.x
        const dy = actualOffset.y

        // Update data (no longer need 20px minimum constraint - handled by displayToActual)
        if (node.mode === "mirrored") {
          // Update data
          if (data.type === "handle_in") {
            node.handleIn = { x: dx, y: dy }
            node.handleOut = { x: -dx, y: -dy } // Mirror
          } else {
            node.handleOut = { x: dx, y: dy }
            node.handleIn = { x: -dx, y: -dy } // Mirror
          }
        } else {
          // Straight / Free Mode
          if (data.type === "handle_in") {
            node.handleIn = { x: dx, y: dy }
          } else {
            node.handleOut = { x: dx, y: dy }
          }
        }

        // Helper to convert Path Coordinate to Canvas Coordinate
        // (Copied from enterEditMode scope)
        const transformPoint = (x: number, y: number) => {
          const offset = pathObj.pathOffset || { x: 0, y: 0 }
          const localX = x - offset.x
          const localY = y - offset.y
          return new Point(localX, localY).transform(matrix)
        }

        // Sync visual target position using clamped display coordinates
        // Use clampDisplayOffset to ensure control point stays at minimum 20px
        const clampedDisplayOffset = clampDisplayOffset({
          x: displayDx,
          y: displayDy,
        })
        const newWorld = transformPoint(
          anchor.x + clampedDisplayOffset.x,
          anchor.y + clampedDisplayOffset.y
        )
        target.set({ left: newWorld.x, top: newWorld.y })
        target.setCoords()

        // Update opposite handle visual if mirrored
        if (node.mode === "mirrored") {
          const oppositeType =
            data.type === "handle_in" ? "handle_out" : "handle_in"
          const oppositeCtrl = (controlsRef.current as ControlPoint[]).find(
            (c) =>
              c.data?.type === oppositeType && c.data.nodeIndex === nodeIndex
          )

          if (oppositeCtrl) {
            // Opposite handle is (-displayDx, -displayDy) in display space
            // Use clampDisplayOffset to ensure minimum 20px
            const oppositeDisplayOffset = clampDisplayOffset({
              x: -displayDx,
              y: -displayDy,
            })
            const opWorld = transformPoint(
              anchor.x + oppositeDisplayOffset.x,
              anchor.y + oppositeDisplayOffset.y
            )
            oppositeCtrl.set({ left: opWorld.x, top: opWorld.y })
            oppositeCtrl.setCoords()
          }
        }

        // CRITICAL: Regenerate path and refresh lines AFTER updating control positions
        regeneratePath()
        refreshControlLines()
      }
    }

    // Helper: Recreate Ghost Path with Seamless Replacement
    const recreateGhostPath = () => {
      const pathObj = editingPathRef.current
      if (!canvas || !pathObj) return

      // Keep reference to old ghost to remove LATER
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldGhost = (pathObj as any)._ghostPath as Path

      // 方案 B: 让新路径自己计算 pathOffset，然后补偿位置差异
      // 1. 先创建幽灵路径，让 Fabric 自动计算新的 pathOffset
      const newGhost = new Path(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathObj.path as any,
        {
          objectCaching: false,
          fill: "", // No fill
          stroke: "#4f46e5", // KEEP VISIBLE FOR DEBUGGING (Step 27 request)
          strokeWidth: pathObj.strokeWidth || 1,
          strokeUniform: pathObj.strokeUniform,
          // Copy stroke style properties to match original path appearance
          strokeLineCap: pathObj.strokeLineCap,
          strokeLineJoin: pathObj.strokeLineJoin,
          strokeMiterLimit: pathObj.strokeMiterLimit,
          strokeDashArray: pathObj.strokeDashArray,
          strokeDashOffset: pathObj.strokeDashOffset,
          selectable: true,
          evented: true,
          perPixelTargetFind: true,
          hoverCursor: "default",

          excludeFromExport: true,
          isGhost: true,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          hasControls: false,
          hasBorders: true,

          // 只复制缩放/旋转/倾斜，不复制位置和 pathOffset
          scaleX: pathObj.scaleX,
          scaleY: pathObj.scaleY,
          angle: pathObj.angle,
          skewX: pathObj.skewX,
          skewY: pathObj.skewY,
          originX: pathObj.originX,
          originY: pathObj.originY,
          // 不设置 left, top, pathOffset - 让 Fabric 自己计算
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      )

      // 2. 计算位置补偿：对齐第一个点的世界坐标
      const firstCmd = pathObj.path[0]
      if (firstCmd && firstCmd.length >= 3) {
        // 原始路径第一个点的世界坐标
        const oldMatrix = pathObj.calcTransformMatrix()
        const oldOffset = pathObj.pathOffset || { x: 0, y: 0 }
        const oldLocalX = (firstCmd[1] as number) - oldOffset.x
        const oldLocalY = (firstCmd[2] as number) - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        // 新幽灵路径第一个点的世界坐标
        const newMatrix = newGhost.calcTransformMatrix()
        const newOffset = newGhost.pathOffset || { x: 0, y: 0 }
        const newLocalX = (firstCmd[1] as number) - newOffset.x
        const newLocalY = (firstCmd[2] as number) - newOffset.y
        const newWorldPt = new Point(newLocalX, newLocalY).transform(newMatrix)

        // 补偿差异
        const dx = oldWorldPt.x - newWorldPt.x
        const dy = oldWorldPt.y - newWorldPt.y
        newGhost.set({
          left: (newGhost.left || 0) + dx,
          top: (newGhost.top || 0) + dy,
        })
        newGhost.setCoords()
      }

      // Attach custom data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(newGhost as any).customPathData = (pathObj as any).customPathData

      // Re-attach all event listeners including hover/breathing animation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathAny = pathObj as any
      if (pathAny._bindGhostPathEvents) {
        pathAny._bindGhostPathEvents(newGhost)
      }

      // Add new ghost to canvas
      canvas.add(newGhost)

      // Fix Layering:
      // 1. Send ghost to back initially
      // canvas.sendObjectToBack(newGhost)
      // 2. But we want it ABOVE the pathObj.
      // Let's try to just ensure Controls are ON TOP.
      // Ghost covers PathObj (which is fine, it's outline over fill).

      // Ensure specific layering if possible
      const pathIndex = canvas.getObjects().indexOf(pathObj)
      if (pathIndex > -1 && typeof canvas.moveObjectTo === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(canvas as any).moveObjectTo(newGhost, pathIndex + 1)
      } else {
        // Fallback: Just ensure controls are on top
        // controlsRef.current.forEach(c => canvas.bringObjectToFront(c))
      }

      // Explicitly bring controls to front to be safe
      controlsRef.current.forEach((c) => {
        if (canvas.contains(c)) canvas.bringObjectToFront(c)
      })

      // Update reference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(pathObj as any)._ghostPath = newGhost

      // Remove old ghost
      if (oldGhost) {
        canvas.remove(oldGhost)
      }

      canvas.requestRenderAll()
      console.log("Ghost Path Recreated (Synchronous & Layered)")
    }

    const handleGlobalMouseUp = () => {
      // Trigger recreation on Mouse Up if we are editing
      if (editingPathRef.current) {
        recreateGhostPath()
        // Note: History is tracked as a single command when exiting edit mode
      }
      // 清除控制点拖动开始状态
      controlDragStartRef.current = null
    }

    // === OLD LOGIC (DISABLED) ===

    /*
    // @ts-nocheck - Old code, disabled
    // === OLD FUNCTION (DISABLED) - handleNodeModeChange ===
    // LISTENER FOR MODE CHANGE

    const handleNodeModeChange = (e: {
      target: FabricObject
      mode: NodeMode
    }) => {
      if (!editingPathRef.current) return
      const pathObj = editingPathRef.current
      const pathData = pathObj.path as PathCommand[]

      const target = e.target
      const mode = e.mode as NodeMode
      const controlTarget = target as ControlPoint
      const data = controlTarget.data

      if (!data || data.type !== "anchor") return

      // Update mode in command data
      const cmd = data.pathCmd
      cmd.nodeMode = mode

      // Update persistent nodeModes array
      if (!pathObj.nodeModes) pathObj.nodeModes = []
      pathObj.nodeModes[data.index] = mode

      // --- HELPER: Identify Connected Commands ---

      // 1. Identify "Next Cmd" (Controlled by Handle Out)
      // For Node i, Handle Out is CP1 of Node i+1.
      const nextCmdIndex = data.index + 1
      const nextCmd =
        nextCmdIndex < pathData.length ? pathData[nextCmdIndex] : null
      let handleOutCmd: PathCommand | null = null
      if (nextCmd && nextCmd[0] === "C") {
        handleOutCmd = nextCmd
      }

      // 2. Identify "Handle In Cmd" (Controlled by Handle In)
      // For Node i (C), Handle In is CP2 of Node i.
      // For Node 0 (M), Handle In is CP2 of Closing Node.
      let handleInCmd: PathCommand | null = null

      if (cmd[0] === "M") {
        // Find Closing Command (The C before Z)
        const zIndex = pathData.findIndex((c) => c[0] === "Z")
        if (zIndex > 0) {
          const closingCmd = pathData[zIndex - 1]
          if (closingCmd && closingCmd[0] === "C") {
            handleInCmd = closingCmd
          }
        }
      } else if (cmd[0] === "C") {
        handleInCmd = cmd
      }

      // --- APPLY MODE LOGIC ---

      // 1. STRAIGHT: Collapse handles
      if (mode === "straight") {
        const ax = (cmd[0] === "M" ? cmd[1] : cmd[5]) as number
        const ay = (cmd[0] === "M" ? cmd[2] : cmd[6]) as number

        // Collapse In
        if (handleInCmd) {
          // CP2 is index 3,4
          handleInCmd[3] = ax
          handleInCmd[4] = ay
        }
        // Collapse Out
        if (handleOutCmd) {
          // CP1 is index 1,2
          handleOutCmd[1] = ax
          handleOutCmd[2] = ay
        }
      }

      // 2. MIRRORED: Expand handles
      else if (mode === "mirrored") {
        const ax = (cmd[0] === "M" ? cmd[1] : cmd[5]) as number
        const ay = (cmd[0] === "M" ? cmd[2] : cmd[6]) as number

        let hInX = ax,
          hInY = ay
        let hOutX = ax,
          hOutY = ay

        // Read existing positions (if valid)
        if (handleInCmd) {
          const cx = handleInCmd[3] as number
          const cy = handleInCmd[4] as number
          // Safety check: is it a valid number?
          if (!isNaN(cx)) hInX = cx
          if (!isNaN(cy)) hInY = cy
        }
        if (handleOutCmd) {
          const cx = handleOutCmd[1] as number
          const cy = handleOutCmd[2] as number
          if (!isNaN(cx)) hOutX = cx
          if (!isNaN(cy)) hOutY = cy
        }

        // Calculate new positions
        const isCollapsedIn =
          Math.abs(hInX - ax) < 0.1 && Math.abs(hInY - ay) < 0.1
        const isCollapsedOut =
          Math.abs(hOutX - ax) < 0.1 && Math.abs(hOutY - ay) < 0.1

        let newInX = hInX,
          newInY = hInY
        let newOutX = hOutX,
          newOutY = hOutY

        if (isCollapsedIn && isCollapsedOut) {
          // Default expansion: Use minimal offset 0.001 to preserve direction
          // This keeps the curve nearly straight while enabling mirrored mode
          // The actual display will show at ~20px due to actualToDisplay transform
          newInX = ax - 0.001
          newInY = ay
          newOutX = ax + 0.001
          newOutY = ay
        } else {
          // Enforce symmetry logic
          const dx = hInX - ax
          const dy = hInY - ay

          // If In is explicit, set Out.
          // If In is collapsed but Out is explicit, set In.
          if (!isCollapsedIn) {
            newOutX = ax - dx
            newOutY = ay - dy
          } else {
            const dxOut = hOutX - ax
            const dyOut = hOutY - ay
            newInX = ax - dxOut
            newInY = ay - dyOut
          }
        }

        // Apply updates
        if (handleInCmd) {
          handleInCmd[3] = newInX
          handleInCmd[4] = newInY
        }
        if (handleOutCmd) {
          handleOutCmd[1] = newOutX
          handleOutCmd[2] = newOutY
        }
      }

      // Finalize
      pathObj.set({ path: pathData }) // Commit changes to object
      pathObj.setCoords()
      updatePath() // Update ghost

      // Re-initialize controls to reflect new handle state (visibility/position)
      // This is critical for "One Sided" bug - ensure both handles are instantiated visually
      enterEditMode(pathObj)

      // RESTORE SELECTION
      // After enterEditMode, selection is cleared. We need to find the anchor at 'data.index' and re-select it.
      const newControls = controlsRef.current
      const newAnchor = newControls.find((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (c as any).data
        return d && d.type === "anchor" && d.index === data.index
      })

      if (newAnchor) {
        canvas.setActiveObject(newAnchor)
        // Trigger store update manually since we bypassed standard interaction
        useEditorStore.getState().setSelectedObjects([newAnchor])
        canvas.requestRenderAll()
      }
    }
    */

    // === NEW: Simplified handleNodeModeChange (TODO) ===
    const handleNodeModeChange = (e: {
      target: FabricObject
      mode: NodeMode
    }) => {
      if (!editingPathRef.current) return
      const pathObj = editingPathRef.current as EditablePath & {
        customPathData?: CustomPathData
      }
      if (!pathObj.customPathData) return

      const targetCtrl = e.target as ControlPoint
      if (!targetCtrl.data || targetCtrl.data.type !== "anchor") return

      const nodeIndex = targetCtrl.data.nodeIndex
      const node = pathObj.customPathData.nodes[nodeIndex]
      // Safety check in case index is out of bounds
      if (!node) return

      const newMode = e.mode

      console.log(`[Node Mode] Switching node ${nodeIndex} to ${newMode}`)

      // Update Node Mode
      // Note: History is tracked as a single command when exiting edit mode
      node.mode = newMode

      if (newMode === "mirrored") {
        // Switch to Mirrored: Enforce symmetry
        const isHandleInZero = node.handleIn.x === 0 && node.handleIn.y === 0
        const isHandleOutZero = node.handleOut.x === 0 && node.handleOut.y === 0

        if (isHandleInZero && isHandleOutZero) {
          // Both handles are zero: Calculate direction based on adjacent nodes
          const nodes = pathObj.customPathData.nodes
          const isClosed = pathObj.customPathData.closed
          const numNodes = nodes.length

          // Get previous and next node indices (handle closed paths)
          const prevIndex = isClosed
            ? (nodeIndex - 1 + numNodes) % numNodes
            : nodeIndex > 0
              ? nodeIndex - 1
              : null
          const nextIndex = isClosed
            ? (nodeIndex + 1) % numNodes
            : nodeIndex < numNodes - 1
              ? nodeIndex + 1
              : null

          const prevNode = prevIndex !== null ? nodes[prevIndex] : null
          const nextNode = nextIndex !== null ? nodes[nextIndex] : null

          // Calculate direction vector
          let dirX = 1,
            dirY = 0 // Default horizontal

          if (prevNode && nextNode) {
            // Both neighbors exist: direction from prev to next
            dirX = nextNode.anchor.x - prevNode.anchor.x
            dirY = nextNode.anchor.y - prevNode.anchor.y
          } else if (prevNode) {
            // Only prev exists: direction from prev to current
            dirX = node.anchor.x - prevNode.anchor.x
            dirY = node.anchor.y - prevNode.anchor.y
          } else if (nextNode) {
            // Only next exists: direction from current to next
            dirX = nextNode.anchor.x - node.anchor.x
            dirY = nextNode.anchor.y - node.anchor.y
          }

          // Normalize direction
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
          if (dirLen > 0.001) {
            dirX /= dirLen
            dirY /= dirLen
          } else {
            // Fallback to horizontal if points overlap
            dirX = 1
            dirY = 0
          }

          // Use minimal offset 0.001 to preserve direction while keeping curve nearly straight
          // The display transform will show handles at ~20px, but actual curve stays almost unchanged
          const handleLength = 0.001

          // Generate symmetric handles along the direction
          node.handleOut = { x: dirX * handleLength, y: dirY * handleLength }
          node.handleIn = { x: -dirX * handleLength, y: -dirY * handleLength }
        } else {
          // At least one handle exists: Enforce symmetry immediately
          // Choose the longer handle to preserve curve shape
          const lenIn = Math.sqrt(node.handleIn.x ** 2 + node.handleIn.y ** 2)
          const lenOut = Math.sqrt(
            node.handleOut.x ** 2 + node.handleOut.y ** 2
          )

          if (lenOut >= lenIn) {
            // Use handleOut as reference, mirror to handleIn
            node.handleIn = { x: -node.handleOut.x, y: -node.handleOut.y }
          } else {
            // Use handleIn as reference, mirror to handleOut
            node.handleOut = { x: -node.handleIn.x, y: -node.handleIn.y }
          }
        }
      } else if (newMode === "straight") {
        // Switch to Straight: Zero out handles
        node.handleIn = { x: 0, y: 0 }
        node.handleOut = { x: 0, y: 0 }
      }

      // Regenerate & Refresh
      regeneratePath()
      enterEditMode(pathObj) // Re-create controls to show/hide handles

      // RESTORE SELECTION
      // After enterEditMode, selection is cleared. We need to find the anchor at 'nodeIndex' and re-select it.
      const newControls = controlsRef.current as ControlPoint[]
      const newAnchor = newControls.find((c) => {
        const d = c.data
        return d && d.type === "anchor" && d.nodeIndex === nodeIndex
      })

      if (newAnchor) {
        canvas.setActiveObject(newAnchor)
        // Trigger store update manually since we bypassed standard interaction
        useEditorStore.getState().setSelectedObjects([newAnchor])
        canvas.requestRenderAll()
      }
    }

    // Handle node:delete event from PropertiesPanel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleNodeDelete = (e: { target: any }) => {
      const target = e.target
      if (target?.data?.type === "anchor") {
        pendingDeleteNodeRef.current = { nodeIndex: target.data.nodeIndex }
        setDeleteNodeDialogOpen(true)
      }
    }

    // HIGHLIGHT SELECTION
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSelection = (e: any) => {
      // Only runs if we are in edit mode (controls exist)
      if (!editingPathRef.current) return

      const selected = e.selected || []
      const deselected = e.deselected || []

      // Reset deselected
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deselected.forEach((obj: any) => {
        const data = obj.data
        if (!data) return
        if (data.type === "anchor") {
          obj.set("fill", "#0000ff") // Default Blue
        } else if (data.type === "handle_in" || data.type === "handle_out") {
          obj.set("fill", "#ffffff") // Default White
        }
      })

      // Highlight selected
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selected.forEach((obj: any) => {
        const data = obj.data
        if (!data) return
        if (
          data.type === "anchor" ||
          data.type === "handle_in" ||
          data.type === "handle_out"
        ) {
          obj.set("fill", "#ffff00") // Yellow
        }
      })
      canvas.requestRenderAll()
    }

    // 处理撤销/重做时的路径数据变更
    const handlePathDataChanged = (e: { target?: FabricObject }) => {
      if (!e.target || e.target.type !== "path") return

      // 如果当前正在编辑这个路径，刷新控制点和幽灵路径
      if (editingPathRef.current === e.target) {
        // 重新进入编辑模式以刷新所有可视化元素
        enterEditMode(e.target as Path)
      }
    }

    // 处理属性面板修改（如 strokeWidth）时的同步
    const handleObjectModified = (e: { target?: FabricObject }) => {
      if (!e.target || e.target.type !== "path") return

      // 如果当前正在编辑这个路径，同步 ghost path 和控制点
      if (editingPathRef.current === e.target) {
        const pathObj = editingPathRef.current as EditablePath
        const ghostPath = pathObj._ghostPath

        if (ghostPath) {
          // Sync strokeWidth to ghost path
          ghostPath.set({ strokeWidth: pathObj.strokeWidth || 1 })

          // Recreate ghost path with proper position alignment
          recreateGhostPath()
        }

        // Update control point positions
        const matrix = pathObj.calcTransformMatrix()
        const transformPoint = (x: number, y: number) => {
          const offset = pathObj.pathOffset || { x: 0, y: 0 }
          const localX = x - offset.x
          const localY = y - offset.y
          return new Point(localX, localY).transform(matrix)
        }

        const pathWithData = pathObj as EditablePath & {
          customPathData?: CustomPathData
        }
        if (pathWithData.customPathData) {
          const { nodes } = pathWithData.customPathData
          const controls = controlsRef.current as ControlPoint[]

          controls.forEach((ctrl) => {
            const data = ctrl.data
            if (!data) return

            const node = nodes[data.nodeIndex]
            if (!node) return

            if (data.type === "anchor") {
              const p = transformPoint(node.anchor.x, node.anchor.y)
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            } else if (data.type === "handle_in" && node.mode === "mirrored") {
              // Use display-transformed position for handles
              const displayHandleIn = actualToDisplay(node.handleIn)
              const p = transformPoint(
                node.anchor.x + displayHandleIn.x,
                node.anchor.y + displayHandleIn.y
              )
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            } else if (data.type === "handle_out" && node.mode === "mirrored") {
              // Use display-transformed position for handles
              const displayHandleOut = actualToDisplay(node.handleOut)
              const p = transformPoint(
                node.anchor.x + displayHandleOut.x,
                node.anchor.y + displayHandleOut.y
              )
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            }
          })

          // Refresh control lines
          refreshControlLines()
        }

        canvas.requestRenderAll()
      }
    }

    canvas.on("node:mode:change", handleNodeModeChange)
    canvas.on("node:delete", handleNodeDelete)
    canvas.on("object:modified", handleObjectModified)
    canvas.on("selection:created", handleSelection)
    canvas.on("selection:updated", handleSelection)
    canvas.on("selection:cleared", handleSelection)
    canvas.on("path:data:changed", handlePathDataChanged)

    canvas.on("mouse:dblclick", handleDblClick)
    canvas.on("mouse:down", handleMouseDown)
    canvas.on("mouse:up", handleGlobalMouseUp)
    canvas.on("object:moving", handleObjectMoving)

    return () => {
      canvas.off("mouse:dblclick", handleDblClick)
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("mouse:up", handleGlobalMouseUp)
      canvas.off("object:moving", handleObjectMoving)
      canvas.off("node:mode:change", handleNodeModeChange)
      canvas.off("node:delete", handleNodeDelete)
      canvas.off("object:modified", handleObjectModified)
      canvas.off("selection:created", handleSelection)
      canvas.off("selection:updated", handleSelection)
      canvas.off("selection:cleared", handleSelection)
      canvas.off("path:data:changed", handlePathDataChanged)

      clearControls()
    }
  }, [activeTool, setCanvas]) // Re-bind if tool changes? Yes, to enable/disable.

  // Handle confirmed node deletion
  const handleConfirmDeleteNode = () => {
    const nodeIndex = pendingDeleteNodeRef.current?.nodeIndex
    if (nodeIndex === undefined) return

    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    const pathObj = useEditorStore.getState().editingPath as EditablePath & {
      customPathData?: CustomPathData
    }
    if (!pathObj?.customPathData) return

    const nodes = pathObj.customPathData.nodes

    // Validation: keep at least 2 nodes
    if (nodes.length <= 2) {
      console.warn("Cannot delete node: path must have at least 2 nodes")
      setDeleteNodeDialogOpen(false)
      pendingDeleteNodeRef.current = null
      return
    }

    // Delete the node
    nodes.splice(nodeIndex, 1)

    // Regenerate path
    const newCommands = nodesToSvgPath(pathObj.customPathData)
    pathObj.set({ path: newCommands })
    pathObj.setCoords()
    pathObj.dirty = true

    // Re-enter edit mode to refresh controls
    // We need to access enterEditMode from the useEffect scope
    // Instead, we fire an event to trigger refresh
    canvas.fire("path:data:changed", { target: pathObj })

    // Clear dialog state
    pendingDeleteNodeRef.current = null
    setDeleteNodeDialogOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950"
      style={{
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      {/* Dot Pattern Background - fixed behind canvas */}
      <div
        className="pointer-events-none absolute inset-0 text-zinc-300 opacity-50 dark:text-zinc-700 dark:opacity-20"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Canvas Element - fills container, zoom/pan handled by Fabric.js viewportTransform */}
      <canvas ref={canvasEl} />

      {/* Canvas Navigator - shows when canvas container is available */}
      {showNavigator && canvasContainerSize && (
        <CanvasNavigator
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoom={zoom}
          containerWidth={canvasContainerSize.width}
          containerHeight={canvasContainerSize.height}
          scrollLeft={scrollPosition.x}
          scrollTop={scrollPosition.y}
          onNavigate={handleNavigate}
        />
      )}

      {/* Zoom Controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomChange={centerAndZoom}
        onZoomToFit={zoomToFit}
      />

      <DeleteNodeDialog
        open={deleteNodeDialogOpen}
        onOpenChange={setDeleteNodeDialogOpen}
        onConfirm={handleConfirmDeleteNode}
      />
    </div>
  )
}
