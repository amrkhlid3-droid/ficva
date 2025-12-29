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
    // Using a fixed size for MVP 800x600
    const canvas = new Canvas(canvasEl.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
      fireRightClick: true, // Enable right click events
      stopContextMenu: true, // Prevent default browser context menu
      preserveObjectStacking: true, // Allow selected objects to be behind others visually
    })

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

    // 1. Mode Switching
    if (activeTool === "pen") {
      canvas.defaultCursor = "crosshair"
      canvas.selection = false // Disable drag selection
      canvas.forEachObject((o) => (o.selectable = false))
      canvas.requestRenderAll()
    } else if (activeTool === "select") {
      canvas.defaultCursor = "default"
      canvas.selection = true
      canvas.forEachObject((o) => (o.selectable = true))
      canvas.requestRenderAll()
    }

    // Helper: Create Path from Bezier Points
    const createPath = (points: typeof pathPointsRef.current) => {
      if (points.length === 0) return null

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
        stroke: "#000000",
        strokeWidth: 2,
        fill: "rgba(255, 0, 0, 0.2)",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        objectCaching: false,
        selectable: false,
        evented: false,
        originX: "left",
        originY: "top",
      })
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
        // We clicked to add a new point.
        // The last point in array was the "Ghost" following the mouse.
        // We finalize it at the click position.
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y }, // Reset handles to anchor
          cp2: { x: pointer.x, y: pointer.y },
        }

        // Add NEW Ghost Point
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
        })
      }

      // Update canvas
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
      if (activeTool !== "pen" || pathPointsRef.current.length === 0) return

      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current

      if (isDraggingRef.current && dragStartPointRef.current) {
        // DRAGGING: Adjust the handles of the JUST ADDED point (second to last, before ghost)
        // Wait, if we are drawing P0->P1.
        // MouseDown at P1. Ghost is P2.
        // We are dragging P1.
        // So we need to modify points[length - 2].

        if (points.length >= 2) {
          const activeNodeIndex = points.length - 2
          const anchor = points[activeNodeIndex]
          if (!anchor) return

          const dx = pointer.x - anchor.x
          const dy = pointer.y - anchor.y

          // Define handles symmetrically
          // cp2 (outgoing) follows mouse
          anchor.cp2 = { x: anchor.x + dx, y: anchor.y + dy }
          // cp1 (incoming) is opposite
          anchor.cp1 = { x: anchor.x - dx, y: anchor.y - dy }
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
      // Finish curve drag
      if (activeTool === "pen") {
        isDraggingRef.current = false
        dragStartPointRef.current = null
      }
    }

    const handleDblClick = () => {
      if (activeTool !== "pen" || !activePathObjectRef.current) return

      const points = pathPointsRef.current
      points.pop() // Remove ghost point

      canvas.remove(activePathObjectRef.current)
      activePathObjectRef.current = null

      // Close path with Z
      if (points.length > 1) {
        const commands = points.map((p, index) => {
          if (index === 0) return `M ${p.x} ${p.y}`
          const prev = points[index - 1]!
          return `C ${prev.cp2.x} ${prev.cp2.y} ${p.cp1.x} ${p.cp1.y} ${p.x} ${p.y}`
        })
        commands.push("Z")
        const pathData = commands.join(" ")

        const path = new Path(pathData, {
          stroke: "#000000",
          strokeWidth: 2,
          fill: "rgba(255, 0, 0, 0.5)",
          objectCaching: true,
          selectable: true,
          evented: true,
          originX: "left",
          originY: "top",
        })

        const command = new AddObjectCommand(canvas, path)
        useEditorStore.getState().history.execute(command)
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
    }
  }, [activeTool, setCanvas, history, syncLayers, setActiveTool])

  // --- Path Editing Logic ---
  const editingPathRef = useRef<Path | null>(null)
  const controlsRef = useRef<FabricObject[]>([])

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    const clearControls = () => {
      controlsRef.current.forEach((c) => canvas.remove(c))
      controlsRef.current = []
      if (editingPathRef.current) {
        const pathObj = editingPathRef.current
        // Recalculate bounding box after editing is done
        // Create a new array reference to force Fabric.js to recalculate dimensions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPath = pathObj.path.map((cmd: any) => [...cmd])

        // Keep caching disabled to prevent clipping issues
        // The performance impact is minimal for typical use cases
        pathObj.objectCaching = false
        pathObj.set({ path: newPath })
        pathObj.setCoords()

        pathObj.selectable = true
        pathObj.evented = true // Restore interaction
        editingPathRef.current = null
      }
      canvas.requestRenderAll()
    }

    const updatePath = () => {
      const pathObj = editingPathRef.current
      if (!pathObj) return

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linesByRef: Map<any, { type: string; cmdIndex: number }> = new Map()

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
      })
      return line
    }

    const enterEditMode = (pathObj: Path) => {
      if (editingPathRef.current) clearControls()

      editingPathRef.current = pathObj
      pathObj.selectable = false
      pathObj.evented = false // Prevent any interaction with path while editing
      pathObj.objectCaching = false // Disable caching so path can render beyond original bounds
      canvas.discardActiveObject() // Deselect the path
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

        // Also need to move the handles that belong to THIS anchor
        // handle_out (x2,y2) of this C command moves WITH the anchor
        if (cmd[0] === "C") {
          const oldAnchorX = cmd[cmd.length - 2] - (rawX - cmd[cmd.length - 2])
          const oldAnchorY = cmd[cmd.length - 1] - (rawY - cmd[cmd.length - 1])
          // Move handle_out relative to anchor
          // Actually we need the delta from old to new anchor position
          // But we just set cmd, so we can calculate delta
        }
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
