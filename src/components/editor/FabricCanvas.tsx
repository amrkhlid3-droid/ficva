"use client"

import { useEffect, useRef } from "react"
import { Canvas, Circle, FabricObject, Line, Path, Point, util } from "fabric"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { RemoveObjectsCommand } from "@/lib/editor/history/commands/RemoveObjectsCommand"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"
import { ModifyPathCommand } from "@/lib/editor/history/commands/ModifyPathCommand"
import type { NodeMode, CustomPathData } from "@/types/fabric"
import { svgPathToNodes } from "@/lib/editor/pathConverter"
import { nodesToSvgPath } from "@/lib/editor/pathUtils"

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
          quality: 0.8,
          multiplier: 0.5, // Improved thumbnail quality
        })

        // 2. Generate JSON
        const json = canvas.toObject([
          "id",
          "selectable",
          "name",
          "backgroundColor",
          "nodeModes", // Persist node modes (legacy)
          "customPathData", // Persist node data (new architecture)
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
  // 用于历史记录：存储拖拽开始时的节点快照
  const dragStartNodesRef = useRef<import("@/types/fabric").PathNode[] | null>(
    null
  )

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

        // STEP 2: Parse the (now normalized) path
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathWithData.customPathData = svgPathToNodes(pathObj.path as any[])
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

      // Add Click Listener for Debugging
      ghostPath.on("mousedown", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pObj = pathObj as any
        console.group("Ghost Path Clicked")
        console.log("Original Custom Data:", pObj.customPathData)
        console.log("SVG Path Commands:", pObj.path)
        console.groupEnd()
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

      // 3. Hover Logic on Ghost Path with Breathing Animation
      const highlightColor = "#4f46e5"
      let breathingAnimationId: number | null = null
      let hoverIndicator: Circle | null = null

      // Create hover indicator circle (hollow)
      const createHoverIndicator = () => {
        if (hoverIndicator) return hoverIndicator
        hoverIndicator = new Circle({
          radius: 6,
          fill: "transparent",
          stroke: highlightColor,
          strokeWidth: 2,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
          excludeFromExport: true,
          visible: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        canvas.add(hoverIndicator)
        return hoverIndicator
      }

      // Breathing animation function
      const startBreathingAnimation = () => {
        if (breathingAnimationId !== null) return

        let opacity = 1
        let increasing = false
        const minOpacity = 0.3
        const maxOpacity = 1
        const step = 0.03

        const animate = () => {
          if (!ghostPath || !canvas) return

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
          ghostPath.set({ opacity })

          // Apply to hover indicator if visible
          if (hoverIndicator && hoverIndicator.visible) {
            hoverIndicator.set({ opacity })
          }

          canvas.requestRenderAll()
          breathingAnimationId = requestAnimationFrame(animate)
        }

        breathingAnimationId = requestAnimationFrame(animate)
      }

      // Stop breathing animation
      const stopBreathingAnimation = () => {
        if (breathingAnimationId !== null) {
          cancelAnimationFrame(breathingAnimationId)
          breathingAnimationId = null
        }
        // Reset opacity
        ghostPath.set({ opacity: 1 })
        if (hoverIndicator) {
          hoverIndicator.set({ visible: false, opacity: 1 })
        }
        canvas.requestRenderAll()
      }

      // Find closest point on path to mouse position
      const updateHoverIndicatorPosition = (e: { pointer?: Point }) => {
        if (!e.pointer || !hoverIndicator) return

        const indicator = hoverIndicator
        const pointer = e.pointer

        // Get path bounding box and transform
        const matrix = ghostPath.calcTransformMatrix()
        const pathOffset = ghostPath.pathOffset || { x: 0, y: 0 }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathCommands = ghostPath.path as any[]

        // Find closest point on path segments
        let closestPoint = { x: pointer.x, y: pointer.y }
        let minDist = Infinity

        for (let i = 0; i < pathCommands.length; i++) {
          const cmd = pathCommands[i]
          if (!cmd) continue

          let pointX: number | undefined
          let pointY: number | undefined

          if (cmd[0] === "M" || cmd[0] === "L") {
            pointX = cmd[1] as number
            pointY = cmd[2] as number
          } else if (cmd[0] === "C") {
            // For curves, sample points along the curve
            pointX = cmd[5] as number
            pointY = cmd[6] as number
          }

          if (pointX !== undefined && pointY !== undefined) {
            // Transform to world coordinates
            const localX = pointX - pathOffset.x
            const localY = pointY - pathOffset.y
            const worldPt = new Point(localX, localY).transform(matrix)

            const dist = Math.hypot(
              worldPt.x - pointer.x,
              worldPt.y - pointer.y
            )
            if (dist < minDist) {
              minDist = dist
              closestPoint = { x: worldPt.x, y: worldPt.y }
            }
          }

          // Sample intermediate points for curves
          if (cmd[0] === "C" && i > 0) {
            const prevCmd = pathCommands[i - 1]
            if (!prevCmd) continue
            const startX =
              prevCmd[0] === "M" || prevCmd[0] === "L"
                ? (prevCmd[1] as number)
                : prevCmd[0] === "C"
                  ? (prevCmd[5] as number)
                  : 0
            const startY =
              prevCmd[0] === "M" || prevCmd[0] === "L"
                ? (prevCmd[2] as number)
                : prevCmd[0] === "C"
                  ? (prevCmd[6] as number)
                  : 0

            // Sample 10 points along the bezier curve
            for (let t = 0.1; t < 1; t += 0.1) {
              const cp1x = cmd[1] as number
              const cp1y = cmd[2] as number
              const cp2x = cmd[3] as number
              const cp2y = cmd[4] as number
              const endX = cmd[5] as number
              const endY = cmd[6] as number

              // Cubic bezier formula
              const mt = 1 - t
              const px =
                mt * mt * mt * startX +
                3 * mt * mt * t * cp1x +
                3 * mt * t * t * cp2x +
                t * t * t * endX
              const py =
                mt * mt * mt * startY +
                3 * mt * mt * t * cp1y +
                3 * mt * t * t * cp2y +
                t * t * t * endY

              const localPx = px - pathOffset.x
              const localPy = py - pathOffset.y
              const worldPt = new Point(localPx, localPy).transform(matrix)

              const dist = Math.hypot(
                worldPt.x - pointer.x,
                worldPt.y - pointer.y
              )
              if (dist < minDist) {
                minDist = dist
                closestPoint = { x: worldPt.x, y: worldPt.y }
              }
            }
          }
        }

        // Update indicator position
        indicator.set({
          left: closestPoint.x,
          top: closestPoint.y,
          visible: true,
        })
        indicator.setCoords()
      }

      ghostPath.on("mouseover", () => {
        ghostPath.set({
          stroke: highlightColor,
          strokeWidth: pathObj.strokeWidth || 1,
        })
        createHoverIndicator()
        startBreathingAnimation()
        canvas.requestRenderAll()
      })

      ghostPath.on("mousemove", (e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateHoverIndicatorPosition(e as any)
        canvas.requestRenderAll()
      })

      ghostPath.on("mouseout", () => {
        stopBreathingAnimation()
        ghostPath.set({ stroke: "rgba(0,0,0,0.01)" })
        canvas.requestRenderAll()
      })

      ghostPath.on("mousedown", () => {
        // Clicking line just ensures we don't accidentally select something else
        console.log("Path Data:", JSON.parse(JSON.stringify(pathObj.path)))
        canvas.discardActiveObject()
        canvas.requestRenderAll()
      })

      // Cleanup function for when editing ends
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(ghostPath as any)._cleanupBreathing = () => {
        stopBreathingAnimation()
        if (hoverIndicator) {
          canvas.remove(hoverIndicator)
          hoverIndicator = null
        }
      }

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
          // Handle In
          const pIn = transformPoint(
            anchor.x + node.handleIn.x,
            anchor.y + node.handleIn.y
          )
          const handleIn = createControl(
            pIn.x,
            pIn.y,
            "handle_in",
            nodeIndex,
            node.mode
          )

          // Create Line for Handle In
          const lineIn = new Line([p.x, p.y, pIn.x, pIn.y], {
            stroke: "#888888",
            strokeWidth: 1,
            selectable: false,
            evented: false,
            originX: "center",
            originY: "center",
            excludeFromExport: true,
          })

          // Handle Out
          const pOut = transformPoint(
            anchor.x + node.handleOut.x,
            anchor.y + node.handleOut.y
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
            strokeWidth: 1,
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

    const handleMouseDown = (e: { target?: FabricObject }) => {
      // Note: Single-click on blank space no longer exits edit mode
      // Use double-click to exit edit mode instead

      // 如果在编辑模式下点击控制点，保存当前节点状态用于历史记录
      if (editingPathRef.current && e.target) {
        const target = e.target as ControlPoint
        if (target.data) {
          const pathObj = editingPathRef.current as EditablePath & {
            customPathData?: CustomPathData
          }
          if (pathObj.customPathData) {
            // 深拷贝当前节点状态作为拖拽前快照
            dragStartNodesRef.current = JSON.parse(
              JSON.stringify(pathObj.customPathData.nodes)
            )
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

          // 找到关联的控制柄并更新位置
          const controls = controlsRef.current as ControlPoint[]
          controls.forEach((ctrl) => {
            if (ctrl.data?.nodeIndex !== nodeIndex) return

            if (ctrl.data.type === "handle_in") {
              const newPos = transformPoint(
                node.anchor.x + node.handleIn.x,
                node.anchor.y + node.handleIn.y
              )
              ctrl.set({ left: newPos.x, top: newPos.y })
              ctrl.setCoords()
            } else if (ctrl.data.type === "handle_out") {
              const newPos = transformPoint(
                node.anchor.x + node.handleOut.x,
                node.anchor.y + node.handleOut.y
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

        // Vector from anchor to handle (new position)
        let dx = rawX - anchor.x
        let dy = rawY - anchor.y

        // Mirrored Mode Constraint: Min length 20px
        if (node.mode === "mirrored") {
          let len = Math.sqrt(dx * dx + dy * dy)
          if (len < 0.1) len = 0.1 // Avoid div by zero

          if (len < 20) {
            const scale = 20 / len
            dx *= scale
            dy *= scale
          }

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

        // Sync visual target position (in case of constraints)
        // Convert back to canvas coordinates
        const newWorld = transformPoint(anchor.x + dx, anchor.y + dy)
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
            // Wait, if I drag handleIn(dx,dy), handleOut is (-dx,-dy).
            // If I drag handleOut(dx,dy), handleIn is (-dx,-dy).
            // So opposite represents -dx, -dy relative to anchor.

            const opWorld = transformPoint(anchor.x - dx, anchor.y - dy)
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

      // Re-attach event listener
      newGhost.on("mousedown", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pObj = pathObj as any
        console.group("Ghost Path Clicked")
        console.log("Original Custom Data:", pObj.customPathData)
        console.log("SVG Path Commands:", pObj.path)
        console.groupEnd()
      })

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

        // 创建历史记录命令（如果节点有变化）
        const pathObj = editingPathRef.current as EditablePath & {
          customPathData?: CustomPathData
        }
        if (dragStartNodesRef.current && pathObj.customPathData) {
          const oldNodes = dragStartNodesRef.current
          const newNodes = pathObj.customPathData.nodes
          const closed = pathObj.customPathData.closed

          // 检查是否有实际变化
          const hasChanged =
            JSON.stringify(oldNodes) !== JSON.stringify(newNodes)

          if (hasChanged) {
            const { history } = useEditorStore.getState()
            const command = new ModifyPathCommand(
              editingPathRef.current,
              oldNodes,
              newNodes,
              closed
            )
            history.push(command) // 只 push，不 execute（因为已经应用了）
          }

          // 清除快照
          dragStartNodesRef.current = null
        }
      }
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
          // Default expansion: Horizontal 20px
          newInX = ax - 20
          newInY = ay
          newOutX = ax + 20
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

      // 保存修改前的节点状态（用于历史记录）
      const oldNodes = JSON.parse(JSON.stringify(pathObj.customPathData.nodes))

      // Update Node Mode
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

          // Calculate handle length based on distance to neighbors (30% of min distance, clamped to [15, 50])
          let handleLength = 30 // Default
          const distances: number[] = []

          if (prevNode) {
            const distPrev = Math.sqrt(
              (node.anchor.x - prevNode.anchor.x) ** 2 +
                (node.anchor.y - prevNode.anchor.y) ** 2
            )
            distances.push(distPrev)
          }
          if (nextNode) {
            const distNext = Math.sqrt(
              (node.anchor.x - nextNode.anchor.x) ** 2 +
                (node.anchor.y - nextNode.anchor.y) ** 2
            )
            distances.push(distNext)
          }

          if (distances.length > 0) {
            const minDist = Math.min(...distances)
            handleLength = Math.max(15, Math.min(50, minDist * 0.3))
          }

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

      // 创建历史记录命令
      const { history } = useEditorStore.getState()
      const command = new ModifyPathCommand(
        editingPathRef.current,
        oldNodes,
        pathObj.customPathData.nodes,
        pathObj.customPathData.closed
      )
      history.push(command) // 只 push，不 execute（因为已经应用了）

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

    canvas.on("node:mode:change", handleNodeModeChange)
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
      canvas.off("selection:created", handleSelection)
      canvas.off("selection:updated", handleSelection)
      canvas.off("selection:cleared", handleSelection)
      canvas.off("path:data:changed", handlePathDataChanged)

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
