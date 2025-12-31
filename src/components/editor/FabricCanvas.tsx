"use client"

import { useEffect, useRef } from "react"
import { Canvas, Circle, FabricObject, Line, Path, Point, util } from "fabric"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { RemoveObjectsCommand } from "@/lib/editor/history/commands/RemoveObjectsCommand"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"
import type { NodeMode } from "@/types/fabric" // Import if possible, or redefine

// Fallback if import fails (safe way)
// type NodeMode = "straight" | "mirrored"

/**
 * Custom interface for Path Commands stored in Fabric.
 * We attach 'nodeMode' to these array objects temporarily during editing.
 */
interface PathCommand extends Array<string | number> {
  nodeMode?: NodeMode
}

interface ControlPoint extends Circle {
  line?: Line
  lineToHandle?: Line
  handle?: ControlPoint
  lineFromAnchor?: boolean
  data?: {
    type: "anchor" | "handle_in" | "handle_out"
    pathCmd: PathCommand
    index: number
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

  // Optimize selectors to avoid re-rendering on every store change
  const setCanvas = useEditorStore((s) => s.setCanvas)
  const history = useEditorStore((s) => s.history)
  const syncLayers = useEditorStore((s) => s.syncLayers)
  const { theme } = useTheme()

  // Track start state for drag operations
  const dragStartRef = useRef<Partial<FabricObject> | null>(null)

  // Drawing Mode Sync
  const isDrawingMode = useEditorStore((s) => s.isDrawingMode)
  const brushColor = useEditorStore((s) => s.brushColor)
  const brushWidth = useEditorStore((s) => s.brushWidth)

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
    // Default size - will be overridden by loadFromJSON if dimensions are saved
    const canvas = new Canvas(canvasEl.current, {
      width: 1200,
      height: 800,
      backgroundColor: "#ffffff",
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
    canvas.on("object:added", () => syncLayers(canvas))
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
          quality: 0.8,
          multiplier: 0.5, // Improved thumbnail quality
        })

        // 2. Generate JSON
        const json = canvas.toObject([
          "id",
          "selectable",
          "name",
          "backgroundColor",
          "nodeModes", // Persist node modes
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
        // Only switch to curve if user intentionally drags
        if (dist > 5) {
          const dx = rawDx * 0.5 // SENSITIVITY MULTIPLIER: 0.5
          const dy = rawDy * 0.5

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
            if (p.nodeMode) cmd.nodeMode = p.nodeMode
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

          if (p.nodeMode) cmd.nodeMode = p.nodeMode
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
          fill: "rgba(255, 0, 0, 0.5)",
          objectCaching: true,
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

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    const removeControlsVisuals = () => {
      controlsRef.current.forEach((c) => canvas.remove(c))
      controlsRef.current = []

      if (editingPathRef.current) {
        const pathObj = editingPathRef.current as EditablePath
        const ghostPath = pathObj._ghostPath
        if (ghostPath) canvas.remove(ghostPath)
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
          objectCaching: true,
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

    const updatePath = () => {
      const pathObj = editingPathRef.current
      if (!pathObj) return

      // Sync ghost path
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ghostPath = (pathObj as any)._ghostPath as Path
      if (ghostPath) {
        // Sync path data directly to avoid Fabric recalculating dimensions/offset
        // which would cause the ghost path to shift relative to controls.
        ghostPath.path = pathObj.path
        // Force dimensions/offset to match original exactly (Critical for alignment)
        ghostPath.pathOffset = pathObj.pathOffset
        ghostPath.width = pathObj.width
        ghostPath.height = pathObj.height

        ghostPath.dirty = true
      }

      // Mark as dirty so Fabric re-renders the path with new coordinates
      // Don't recalculate bounding box during drag - it would change the coordinate system
      pathObj.dirty = true
      canvas.requestRenderAll()
    }

    // Refresh all control line positions based on current anchor/handle positions
    const refreshControlLines = () => {
      const controls = controlsRef.current as ControlPoint[]

      // Find all anchors and handles, build a map by command index
      const anchorsByIndex: Map<number, ControlPoint> = new Map()
      const handleInByIndex: Map<number, ControlPoint> = new Map()
      const handleOutByIndex: Map<number, ControlPoint> = new Map()

      controls.forEach((ctrl) => {
        const data = ctrl.data
        if (!data) return

        if (data.type === "anchor") {
          anchorsByIndex.set(data.index, ctrl)
        } else if (data.type === "handle_in") {
          handleInByIndex.set(data.index, ctrl)
        } else if (data.type === "handle_out") {
          handleOutByIndex.set(data.index, ctrl)
        }
      })

      // Actual simpler approach: find controls with .line property and update
      controls.forEach((ctrl) => {
        const c = ctrl
        if (c.data?.type === "handle_in" && c.line) {
          // l1 goes from previous anchor to this handle
          const cmdIndex = c.data.index
          const prevAnchor = anchorsByIndex.get(cmdIndex - 1)
          if (prevAnchor) {
            c.line.set({
              x1: prevAnchor.left,
              y1: prevAnchor.top,
              x2: c.left,
              y2: c.top,
            })
          }
        }
        if (c.data?.type === "handle_out" && c.line) {
          // l2 goes from current anchor to this handle
          const cmdIndex = c.data.index
          const anchor = anchorsByIndex.get(cmdIndex)
          if (anchor) {
            c.line.set({
              x1: anchor.left,
              y1: anchor.top,
              x2: c.left,
              y2: c.top,
            })
          }
        }
      })

      canvas.requestRenderAll()
    }

    const createControl = (
      x: number,
      y: number,
      type: "anchor" | "handle_in" | "handle_out",
      pathCmd: PathCommand,
      index: number,
      nodeMode: NodeMode
    ) => {
      const circle = new Circle({
        left: x,
        top: y,
        radius: type === "anchor" ? 5 : 3,
        fill: type === "anchor" ? "#0000ff" : "#ffffff",
        stroke: "#0000ff",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        hasControls: false,
        hasBorders: false,
        selectable: true,
        padding: type === "anchor" ? 10 : 5, // Increase hit area
        // Custom props
        data: { type, pathCmd, index, nodeMode },
        excludeFromExport: true, // CRITICAL: Do not save controls to JSON
      })
      return circle as ControlPoint
    }

    const createLine = (
      p1: { x: number; y: number },
      p2: { x: number; y: number }
    ) => {
      const line = new Line([p1.x, p1.y, p2.x, p2.y], {
        stroke: "#888888",
        strokeWidth: 1,
        selectable: false,
        evented: false,
        originX: "center",
        originY: "center",
        excludeFromExport: true, // CRITICAL: Do not save guidelines to JSON
      })
      return line
    }

    const enterEditMode = (pathObj: Path) => {
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
      const ghostPath = new Path(pathObj.path as unknown as string, {
        objectCaching: false,
        fill: "", // Transparent fill prevents mouse detection on fill area
        // CRITICAL: Must not be fully transparent for hit detection to work!
        stroke: "rgba(0,0,0,0.01)",
        strokeWidth: pathObj.strokeWidth || 1, // Match original width exactly
        strokeUniform: pathObj.strokeUniform, // Copy uniform scaling
        selectable: false,
        evented: true, // This object captures events
        perPixelTargetFind: true, // CRITICAL: Only stroke pixels trigger events
        hoverCursor: "default", // CRITICAL: Don't show selection cursor

        // Match transform to align perfectly
        left: pathObj.left,
        top: pathObj.top,
        scaleX: pathObj.scaleX,
        scaleY: pathObj.scaleY,
        angle: pathObj.angle,
        originX: pathObj.originX,
        originY: pathObj.originY,
        pathOffset: pathObj.pathOffset,

        excludeFromExport: true, // Don't save

        isGhost: true, // Mark as ghost to prevent double-click editing
      })
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

      // 3. Hover Logic on Ghost Path
      const highlightColor = "#4f46e5"

      ghostPath.on("mouseover", () => {
        ghostPath.set({
          stroke: highlightColor,
          strokeWidth: pathObj.strokeWidth || 1, // Match original width
        })
        canvas.requestRenderAll()
      })

      ghostPath.on("mouseout", () => {
        ghostPath.set({ stroke: "rgba(0,0,0,0.01)" })
        canvas.requestRenderAll()
      })

      ghostPath.on("mousedown", () => {
        // Clicking line just ensures we don't accidentally select something else
        canvas.discardActiveObject()
        canvas.requestRenderAll()
      })

      // 4. Sync prop changes (e.g. from panel) to Ghost Path
      const syncProps = () => {
        // Only need to sync dimensions/strokeWidth. Path data handled by updatePath.
        ghostPath.set({ strokeWidth: pathObj.strokeWidth || 1 })
        canvas.requestRenderAll()
      }
      pathObj.on("modified", syncProps)

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

      const pathCommands = pathObj.path as PathCommand[] // [['M', x, y], ['C', ...], ['Z']]
      const nodeModes = pathObj.nodeModes || []

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

          const anchor = createControl(p.x, p.y, "anchor", cmd, i, nodeMode)
          canvas.add(anchor)
          controlsRef.current.push(anchor)

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

            const anc = anchor as ControlPoint
            anc.lineToHandle = l2
            anc.handle = h2
          }
        }
      })

      // Update source of truth
      pathObj.nodeModes = nodeModes

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

    const handleMouseDown = (e: { target?: FabricObject }) => {
      // If clicking blank space, exit edit mode
      if (editingPathRef.current && !e.target) {
        clearControls()
      }
    }

    const handleObjectMoving = (e: { target: FabricObject }) => {
      if (!editingPathRef.current) return
      const target = e.target as ControlPoint
      const data = target.data
      if (!data) return

      // Inverse transform to get local coordinate
      const pathObj = editingPathRef.current
      const matrix = pathObj.calcTransformMatrix()
      const invertedMatrix = util.invertTransform(matrix)
      const localPoint = new Point(target.left, target.top).transform(
        invertedMatrix
      )

      // Helper to convert Path Coordinate to Canvas Coordinate
      const toWorld = (x: number, y: number) => {
        const off = pathObj.pathOffset || { x: 0, y: 0 }
        return new Point(x - off.x, y - off.y).transform(matrix)
      }

      // Convert local coordinates back to path coordinates by adding pathOffset
      const offset = pathObj.pathOffset || { x: 0, y: 0 }
      const rawX = localPoint.x + offset.x
      const rawY = localPoint.y + offset.y

      const cmd = data.pathCmd

      if (data.type === "anchor") {
        // Calculate delta
        const oldX = cmd[cmd.length - 2] as number
        const oldY = cmd[cmd.length - 1] as number
        const dx = rawX - oldX
        const dy = rawY - oldY

        // Update anchor position in path data
        cmd[cmd.length - 2] = rawX
        cmd[cmd.length - 1] = rawY

        // Update Handle In (CP2 of current command)
        if (cmd[0] === "C") {
          cmd[3] = (cmd[3] as number) + dx
          cmd[4] = (cmd[4] as number) + dy
        }

        // Update Handle Out (CP1 of next command)
        const pathData = pathObj.path as PathCommand[]
        const nextCmd = pathData[data.index + 1]
        if (nextCmd && nextCmd[0] === "C") {
          nextCmd[1] = (nextCmd[1] as number) + dx
          nextCmd[2] = (nextCmd[2] as number) + dy
        }

        // STRICT CONSTRAINT ENFORCEMENT: Straight Nodes
        // Ensure handles remain EXACTLY at anchor position (eliminate floating point drift)
        if (data.nodeMode === "straight") {
          // 1. Handle In
          if (cmd[0] === "C") {
            cmd[3] = rawX
            cmd[4] = rawY
          } else if (cmd[0] === "M") {
            const lastIdx = pathData.length - 1
            const isClosed = pathData[lastIdx] && pathData[lastIdx][0] === "Z"
            if (isClosed) {
              const closingCmd = pathData[lastIdx - 1]
              if (closingCmd && closingCmd[0] === "C") {
                closingCmd[3] = rawX
                closingCmd[4] = rawY
              }
            }
          }

          // 2. Handle Out
          if (nextCmd && nextCmd[0] === "C") {
            nextCmd[1] = rawX
            nextCmd[2] = rawY
          }
        }
      } else if (data.type === "handle_in") {
        // C x1 y1 x2 y2 x y - handle_in is x1 y1
        cmd[1] = rawX
        cmd[2] = rawY

        // Mirroring Logic:
        // This handle (cmd[1], cmd[2]) is "Handle Out" of Prev Anchor.
        // It should mirror with "Handle In" of Prev Anchor.
        // Handle In of Prev Anchor is Command I-1's cp2 (prevCmd[3], prevCmd[4]).

        const prevIndex = data.index - 1
        if (prevIndex >= 0) {
          const pathData = pathObj.path as PathCommand[]
          const prevCmd = pathData[prevIndex]
          if (prevCmd && prevCmd[0] === "C") {
            // Mirroring around Prev Anchor (prevCmd[5], prevCmd[6])
            const px = prevCmd[5] as number
            const py = prevCmd[6] as number
            const dx = rawX - px
            const dy = rawY - py

            // New coords for mirrored handle (Handle In of Prev)
            const newHx = px - dx
            const newHy = py - dy

            // Target: Handle In of Prev (prevCmd[3], prevCmd[4])
            prevCmd[3] = newHx
            prevCmd[4] = newHy

            // VISUAL SYNC: Find the control for prevCmd's handle_out (which is CP2)
            // Wait: CP2 of prevCmd is named "handle_out" in createControl (line 962)
            // It has index = prevIndex
            const mirroredControl = (
              controlsRef.current as ControlPoint[]
            ).find(
              (c) => c.data?.type === "handle_out" && c.data.index === prevIndex
            )

            if (mirroredControl) {
              const worldPt = toWorld(newHx, newHy)
              mirroredControl.set({ left: worldPt.x, top: worldPt.y })
              mirroredControl.setCoords()
            }
          }
        }
      } else if (data.type === "handle_out") {
        // C x1 y1 x2 y2 x y - handle_out is x2 y2
        cmd[3] = rawX
        cmd[4] = rawY

        // Mirroring Logic:
        // This handle (cmd[3], cmd[4]) is "Handle In" of Current Anchor.
        // It should mirror with "Handle Out" of Current Anchor.
        // Handle Out of Current Anchor is Command I+1's cp1 (nextCmd[1], nextCmd[2]).
        // We check Current Anchor mode (cmd.nodeMode).
        // if (cmd.nodeMode === "mirrored") { // REMOVED: Always mirror if handles exist
        const nextIndex = data.index + 1
        const pathData = pathObj.path as PathCommand[]
        if (nextIndex < pathData.length) {
          const nextCmd = pathData[nextIndex]
          if (nextCmd && nextCmd[0] === "C") {
            // Mirroring around Current Anchor (cmd[5], cmd[6])
            const px = cmd[5] as number
            const py = cmd[6] as number
            const dx = rawX - px
            const dy = rawY - py

            // New coords for mirrored handle
            const newHx = px - dx
            const newHy = py - dy

            // Target: Handle Out of Curr (nextCmd[1], nextCmd[2])
            nextCmd[1] = newHx
            nextCmd[2] = newHy

            // VISUAL SYNC: Find the control for nextCmd's handle_in (which is CP1)
            // CP1 of nextCmd is named "handle_in" in createControl (line 954)
            // It has index = nextIndex
            const mirroredControl = (
              controlsRef.current as ControlPoint[]
            ).find(
              (c) => c.data?.type === "handle_in" && c.data.index === nextIndex
            )

            if (mirroredControl) {
              const worldPt = toWorld(newHx, newHy)
              mirroredControl.set({ left: worldPt.x, top: worldPt.y })
              mirroredControl.setCoords()
            }
          }
        }
      }

      updatePath()
      refreshControlLines()
    }

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

      // 1. STRAIGHT: Collapse handles
      if (mode === "straight") {
        const anchorX = cmd[cmd.length - 2] as number
        const anchorY = cmd[cmd.length - 1] as number

        // Collapse Handle In (CP2 of current command)
        if (cmd[0] === "C") {
          cmd[3] = anchorX
          cmd[4] = anchorY
        }

        // Collapse Handle Out (CP1 of next command)
        const nextCmd = pathData[data.index + 1]
        if (nextCmd && nextCmd[0] === "C") {
          nextCmd[1] = anchorX
          nextCmd[2] = anchorY
        }
      }

      // 2. MIRRORED: Expand handles if they were straight
      else if (mode === "mirrored") {
        let anchorX = 0
        let anchorY = 0
        let hInX: number | undefined
        let hInY: number | undefined

        // READ CURRENT STATE
        if (cmd[0] === "C") {
          anchorX = cmd[5] as number
          anchorY = cmd[6] as number
          hInX = cmd[3] as number
          hInY = cmd[4] as number
        } else if (cmd[0] === "M") {
          // M x y
          anchorX = cmd[1] as number
          anchorY = cmd[2] as number
          // Handle In for M is Closing Cmd's CP2
          const lastIdx = pathData.length - 1
          const isClosed = pathData[lastIdx] && pathData[lastIdx][0] === "Z"
          if (isClosed) {
            const closingCmd = pathData[lastIdx - 1]
            if (closingCmd && closingCmd[0] === "C") {
              hInX = closingCmd[3] as number
              hInY = closingCmd[4] as number
            }
          }
        }

        // Handle Out (nextCmd CP1)
        const nextCmd = pathData[data.index + 1]
        let hOutX: number | undefined
        let hOutY: number | undefined
        if (nextCmd && nextCmd[0] === "C") {
          hOutX = nextCmd[1] as number
          hOutY = nextCmd[2] as number
        }

        // Defaults if undefined
        if (hInX === undefined) hInX = anchorX
        if (hInY === undefined) hInY = anchorY
        if (hOutX === undefined) hOutX = anchorX
        if (hOutY === undefined) hOutY = anchorY

        const isCollapsedIn =
          Math.abs(hInX - anchorX) < 0.1 && Math.abs(hInY - anchorY) < 0.1
        const isCollapsedOut =
          Math.abs(hOutX - anchorX) < 0.1 && Math.abs(hOutY - anchorY) < 0.1

        let newHInX = hInX
        let newHInY = hInY
        let newHOutX = hOutX
        let newHOutY = hOutY

        // Logic to calculate NEW positions
        if (isCollapsedIn && isCollapsedOut) {
          // Create new handles horizontal
          newHInX = anchorX - 20
          newHInY = anchorY
          newHOutX = anchorX + 20
          newHOutY = anchorY
        } else {
          // Already has handles, align them
          const dx = hInX - anchorX
          const dy = hInY - anchorY
          if (dx === 0 && dy === 0) {
            // In collapsed, use Out to set In
            const dxOut = hOutX - anchorX
            const dyOut = hOutY - anchorY
            newHInX = anchorX - dxOut
            newHInY = anchorY - dyOut
          } else {
            // In exists, set Out to mirror In
            newHOutX = anchorX - dx
            newHOutY = anchorY - dy
          }
        }

        // WRITE BACK TO DATA
        if (cmd[0] === "C") {
          cmd[3] = newHInX
          cmd[4] = newHInY
        } else if (cmd[0] === "M") {
          const lastIdx = pathData.length - 1
          const isClosed = pathData[lastIdx] && pathData[lastIdx][0] === "Z"
          if (isClosed) {
            const closingCmd = pathData[lastIdx - 1]
            if (closingCmd && closingCmd[0] === "C") {
              closingCmd[3] = newHInX
              closingCmd[4] = newHInY
            }
          }
        }

        if (nextCmd && nextCmd[0] === "C") {
          nextCmd[1] = newHOutX
          nextCmd[2] = newHOutY
        }
      }

      updatePath()
      // Re-enter edit mode to refresh control visibility (Straight handles disappear)
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

    canvas.on("node:mode:change", handleNodeModeChange)
    canvas.on("selection:created", handleSelection)
    canvas.on("selection:updated", handleSelection)
    canvas.on("selection:cleared", handleSelection)

    canvas.on("mouse:dblclick", handleDblClick)
    canvas.on("mouse:down", handleMouseDown)
    canvas.on("object:moving", handleObjectMoving)

    return () => {
      canvas.off("mouse:dblclick", handleDblClick)
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("object:moving", handleObjectMoving)
      canvas.off("node:mode:change", handleNodeModeChange)
      canvas.off("selection:created", handleSelection)
      canvas.off("selection:updated", handleSelection)
      canvas.off("selection:cleared", handleSelection)

      clearControls()
    }
  }, [activeTool, setCanvas]) // Re-bind if tool changes? Yes, to enable/disable.

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-zinc-100 dark:bg-zinc-950">
      {/* Dot Pattern Background */}
      <div
        className="pointer-events-none absolute inset-0 text-zinc-300 opacity-50 dark:text-zinc-700 dark:opacity-20"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      <div className="z-0 border border-zinc-200 shadow-2xl dark:border-zinc-800">
        <canvas ref={canvasEl} />
      </div>
    </div>
  )
}
