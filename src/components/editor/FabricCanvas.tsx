"use client"

import { useEffect, useRef } from "react"
import { Canvas, Circle, FabricObject, Line, Path, Point, util } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { RemoveObjectsCommand } from "@/lib/editor/history/commands/RemoveObjectsCommand"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"

export default function FabricCanvas() {
  const canvasEl = useRef<HTMLCanvasElement>(null)

  // Optimize selectors to avoid re-rendering on every store change
  const setCanvas = useEditorStore((s) => s.setCanvas)
  const history = useEditorStore((s) => s.history)
  const syncLayers = useEditorStore((s) => s.syncLayers)

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

  // --- Pen Tool Logic ---
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  // Pen Tool Refs
  const activePathObjectRef = useRef<FabricObject | null>(null)

  // Point structure: { x, y } is the anchor.
  // cp1 (in-handle) and cp2 (out-handle) are absolute coordinates.
  const pathPointsRef = useRef<
    {
      x: number
      y: number
      cp1: { x: number; y: number }
      cp2: { x: number; y: number }
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
        id: crypto.randomUUID(), // Add ID to prevent syncLayers warnings
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
        })
        // Ghost Point (for preview)
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
        })
      } else {
        // Real Point (replace ghost)
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y }, // Will adjust below if dragging
          cp2: { x: pointer.x, y: pointer.y },
        }
        // New Ghost
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
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
        const dx = pointer.x - start.x
        const dy = pointer.y - start.y
        // cp2 (outgoing) is in the direction of the drag
        anchor.cp2 = { x: anchor.x + dx, y: anchor.y + dy }
        // cp1 (incoming) is opposite
        anchor.cp1 = { x: anchor.x - dx, y: anchor.y - dy }
      } else {
        // HOVERING: Update the Ghost Point (last one) to follow mouse
        // Just move anchor, keep handles zero-length (Line behavior by default)
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
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

      // Close path with Z
      if (points.length > 1) {
        const { penToolConfig } = useEditorStore.getState()

        const commands = points.map((p, index) => {
          if (index === 0) return `M ${p.x} ${p.y}`
          const prev = points[index - 1]!
          return `C ${prev.cp2.x} ${prev.cp2.y} ${p.cp1.x} ${p.cp1.y} ${p.x} ${p.y}`
        })
        commands.push("Z")
        const pathData = commands.join(" ")

        const path = new Path(pathData, {
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
        })

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

    const clearControls = () => {
      // Notify Store
      useEditorStore.getState().setEditingPath(null)

      controlsRef.current.forEach((c) => canvas.remove(c))
      controlsRef.current = []
      if (editingPathRef.current) {
        const oldPath = editingPathRef.current
        // Remove ghost path if exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ghostPath = (oldPath as any)._ghostPath
        if (ghostPath) canvas.remove(ghostPath)

        // Save the visual position of the first command before recreation
        const firstCmd = oldPath.path[0]
        if (!firstCmd || firstCmd.length < 3) return

        // Get world position of first point BEFORE recreation
        const oldMatrix = oldPath.calcTransformMatrix()
        const oldOffset = oldPath.pathOffset || { x: 0, y: 0 }
        const oldLocalX = firstCmd[1]! - oldOffset.x
        const oldLocalY = firstCmd[2]! - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        // Create a new array reference to force Fabric.js to recalculate dimensions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPathData = oldPath.path.map((cmd: any) => [...cmd]) as any

        // Recreate the Path object entirely to force proper dimension calculation
        const newPath = new Path(newPathData, {
          fill: oldPath.fill,
          // CRITICAL: Restore original stroke if we were highlighting it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stroke: (oldPath as any)._originalStroke || oldPath.stroke,

          strokeWidth:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (oldPath as any)._originalStrokeWidth || oldPath.strokeWidth,
          objectCaching: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          id: (oldPath as any).id,
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
        // Sync path data so ghost shape matches original
        ghostPath.set({ path: pathObj.path })
      }

      // Mark as dirty so Fabric re-renders the path with new coordinates
      // Don't recalculate bounding box during drag - it would change the coordinate system
      pathObj.dirty = true
      canvas.requestRenderAll()
    }

    // Refresh all control line positions based on current anchor/handle positions
    const refreshControlLines = () => {
      const controls = controlsRef.current

      // Find all anchors and handles, build a map by command index
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anchorsByIndex: Map<number, any> = new Map()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleInByIndex: Map<number, any> = new Map()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleOutByIndex: Map<number, any> = new Map()

      controls.forEach((ctrl) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (ctrl as any).data
        if (!data) return

        if (data.type === "anchor") {
          anchorsByIndex.set(data.index, ctrl)
        } else if (data.type === "handle_in") {
          handleInByIndex.set(data.index, ctrl)
        } else if (data.type === "handle_out") {
          handleOutByIndex.set(data.index, ctrl)
        }
      })

      // Now update lines: For each C command at index i:
      // - l1: from anchor[i-1] to handle_in[i]
      // - l2: from anchor[i] to handle_out[i]
      controls.forEach((ctrl) => {
        // Lines don't have data, but we need to identify which line is which
        // For now, check if it's a Line type and update based on nearby controls
        if (ctrl.type === "line") {
          // We'll reconstruct lines differently - see below
        }
      })

      // Actually, simpler approach: find controls with .line property and update
      controls.forEach((ctrl) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = ctrl as any
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
      type: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pathCmd: any,
      index: number
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
        // Custom props
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { type, pathCmd, index } as any,
        excludeFromExport: true, // CRITICAL: Do not save controls to JSON
      })
      return circle
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
      if (editingPathRef.current) clearControls()

      // Notify Store for UI updates
      useEditorStore.getState().setEditingPath(pathObj)

      editingPathRef.current = pathObj

      // 1. Disable interaction on the main path (so mouse ignores fill)
      pathObj.selectable = false
      pathObj.evented = false
      pathObj.objectCaching = false

      // 2. Create Ghost Path for interaction (Stroke Only)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ghostPath = new Path(pathObj.path as any, {
        objectCaching: false,
        fill: "", // Transparent fill prevents mouse detection on fill area
        // CRITICAL: Must not be fully transparent for hit detection to work!
        stroke: "rgba(0,0,0,0.01)",
        strokeWidth: Math.max(pathObj.strokeWidth || 1, 5), // Minimum clickable width for better UX
        selectable: false,
        evented: true, // This object captures events
        perPixelTargetFind: true, // CRITICAL: Only stroke pixels trigger events

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
          strokeWidth: Math.max(pathObj.strokeWidth || 1, 5), // Ensure highlight maintains clickable width
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
        ghostPath.set({ strokeWidth: pathObj.strokeWidth })
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathCommands = pathObj.path as any[] // [['M', x, y], ['C', ...], ['Z']]

      pathCommands.forEach((cmd, i) => {
        if (cmd[0] === "M") {
          const p = transformPoint(cmd[1], cmd[2])
          const anchor = createControl(p.x, p.y, "anchor", cmd, i)
          canvas.add(anchor)
          controlsRef.current.push(anchor)
        }
        if (cmd[0] === "L") {
          const p = transformPoint(cmd[1], cmd[2])
          const anchor = createControl(p.x, p.y, "anchor", cmd, i)
          canvas.add(anchor)
          controlsRef.current.push(anchor)
        }
        if (cmd[0] === "C") {
          // C x1 y1, x2 y2, x y
          const p1 = transformPoint(cmd[1], cmd[2]) // Control 1
          const p2 = transformPoint(cmd[3], cmd[4]) // Control 2
          const p = transformPoint(cmd[5], cmd[6]) // Anchor

          const anchor = createControl(p.x, p.y, "anchor", cmd, i)
          const handle1 = createControl(p1.x, p1.y, "handle_in", cmd, i) // Logic mapping might need adjustment
          const handle2 = createControl(p2.x, p2.y, "handle_out", cmd, i)

          // Lines
          // handle1 is for 'start' of curve? No, C command:
          // (current point) -> control1 -> control2 -> target(x,y)
          // Wait, standard Bezier:
          // P_prev is start. P_prev connects to x1,y1 (Handle Out of Prev).
          // P_target connect to x2,y2 (Handle In of Target).
          // BUT in SVG 'C' command, BOTH handles are specified in the 'C' command itself.

          // Visual connection:
          // Line from P_prev (Anchor) to x1,y1 (Handle 1)
          // Line from P_target (Anchor) to x2,y2 (Handle 2)

          // We need previous anchor position to draw line to Handle 1.
          const prevCmd = pathCommands[i - 1]
          // M x y or L x y or C ... x y
          let prevX = 0,
            prevY = 0
          if (prevCmd) {
            const len = prevCmd.length
            // Last 2 args are always x, y
            prevX = prevCmd[len - 2]
            prevY = prevCmd[len - 1]
          }
          const prevP = transformPoint(prevX, prevY)

          const l1 = createLine(prevP, p1)
          const l2 = createLine(p, p2)

          canvas.add(l1, l2, handle1, handle2, anchor)
          controlsRef.current.push(l1, l2, handle1, handle2, anchor)

          // Associate lines to handles for update when handle moves
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(handle1 as any).line = l1
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(handle2 as any).line = l2

          // Associate l2 to this anchor (l2 goes FROM this anchor TO handle2)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(anchor as any).lineToHandle = l2
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(anchor as any).handle = handle2

          // For l1: it connects FROM previous anchor TO handle1
          // We need to find the previous anchor and associate l1 with it
          // For simplicity, store l1 reference on handle1 with "lineFromPrevAnchor" flag
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(handle1 as any).lineFromAnchor = true // l1's x1,y1 endpoint comes from prev anchor
        }
      })
      canvas.requestRenderAll()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleDblClick = (e: any) => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = (e: any) => {
      // If clicking blank space, exit edit mode
      if (editingPathRef.current && !e.target) {
        clearControls()
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleObjectMoving = (e: any) => {
      if (!editingPathRef.current) return
      const target = e.target
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (target as any).data
      if (!data) return

      // Inverse transform to get local coordinate
      const pathObj = editingPathRef.current
      const matrix = pathObj.calcTransformMatrix()
      const invertedMatrix = util.invertTransform(matrix)
      const localPoint = new Point(target.left, target.top).transform(
        invertedMatrix
      )

      // Convert local coordinates back to path coordinates by adding pathOffset
      const offset = pathObj.pathOffset || { x: 0, y: 0 }
      const rawX = localPoint.x + offset.x
      const rawY = localPoint.y + offset.y

      const cmd = data.pathCmd

      if (data.type === "anchor") {
        // Update anchor position in path data
        cmd[cmd.length - 2] = rawX
        cmd[cmd.length - 1] = rawY
      } else if (data.type === "handle_in") {
        // C x1 y1 x2 y2 x y - handle_in is x1 y1
        cmd[1] = rawX
        cmd[2] = rawY
      } else if (data.type === "handle_out") {
        // C x1 y1 x2 y2 x y - handle_out is x2 y2
        cmd[3] = rawX
        cmd[4] = rawY
      }

      updatePath()
      refreshControlLines()
    }

    canvas.on("mouse:dblclick", handleDblClick)
    canvas.on("mouse:down", handleMouseDown)
    canvas.on("object:moving", handleObjectMoving)

    return () => {
      canvas.off("mouse:dblclick", handleDblClick)
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("object:moving", handleObjectMoving)
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
