"use client"

import { useEffect, useRef } from "react"
import { Canvas, FabricObject, Path } from "fabric"
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
  // Refs for Pay Tool
  const activePathObjectRef = useRef<FabricObject | null>(null) // The visual path on canvas
  // Store raw points for easier manipulation, convert to commands for Path
  const pathPointsRef = useRef<{ x: number; y: number }[]>([])

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

    // Helper to create path from points
    // We treat points as: P0 -> M, P1..Pn -> L
    const createPath = (points: { x: number; y: number }[]) => {
      if (points.length === 0) return null

      // Construct SVG path command
      // e.g. "M 0 0 L 10 10 L 20 20"
      const commands = points.map((p, index) => {
        return index === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
      })
      const pathData = commands.join(" ")

      return new Path(pathData, {
        stroke: "#000000",
        strokeWidth: 2,
        fill: "rgba(255, 0, 0, 0.2)", // User requested filled shape look. Light red for visibility.
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

      // If first point
      if (points.length === 0) {
        points.push({ x: pointer.x, y: pointer.y }) // Start M
        points.push({ x: pointer.x, y: pointer.y }) // End L (ghost point for movement)

        const path = createPath(points)
        if (path) {
          canvas.add(path)
          activePathObjectRef.current = path
          canvas.requestRenderAll()
        }
      } else {
        // Fix last point (which was floating)
        points[points.length - 1] = { x: pointer.x, y: pointer.y }
        // Add new floating point for next segments
        points.push({ x: pointer.x, y: pointer.y })

        // Recreate object
        if (activePathObjectRef.current) {
          canvas.remove(activePathObjectRef.current)
        }
        const path = createPath(points)
        if (path) {
          canvas.add(path)
          activePathObjectRef.current = path
          canvas.requestRenderAll()
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (opt: any) => {
      if (activeTool !== "pen" || pathPointsRef.current.length === 0) return

      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current

      // Update last point (ghost)
      points[points.length - 1] = { x: pointer.x, y: pointer.y }

      if (activePathObjectRef.current) {
        canvas.remove(activePathObjectRef.current)
      }
      const path = createPath(points)
      if (path) {
        canvas.add(path)
        activePathObjectRef.current = path
        canvas.requestRenderAll()
      }
    }

    const handleDblClick = () => {
      if (activeTool !== "pen" || !activePathObjectRef.current) return

      const points = pathPointsRef.current
      // Remove ghost point
      points.pop()

      // Remove temp
      canvas.remove(activePathObjectRef.current)
      activePathObjectRef.current = null

      if (points.length > 2) {
        // Create final object with 'Z' to close
        // Construct SVG path command with Z
        const commands = points.map((p, index) => {
          return index === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
        })
        commands.push("Z") // Close path
        const pathData = commands.join(" ")

        const path = new Path(pathData, {
          stroke: "#000000",
          strokeWidth: 2,
          fill: "rgba(255, 0, 0, 0.5)", // Stronger fill on finish
          strokeLineCap: "round",
          strokeLineJoin: "round",
          objectCaching: true,
          selectable: true,
          evented: true,
          originX: "left",
          originY: "top",
        })

        const command = new AddObjectCommand(canvas, path)
        useEditorStore.getState().history.execute(command)
      } else if (points.length === 2) {
        // Just a line, no Z? Or Z to make it a thin shape?
        // If 2 points, Z makes it disappear if no stroke?
        // Let's just draw Line if 2 points, OR keep Path without Z.
        // Standard Pen tool: if 2 points, it's an open path.
        // Plan said: "双击/回车 (Finish)：自动添加 ["Z"] 命令闭合路径。"
        // OK, we close it.
        const commands = points.map((p, index) => {
          return index === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
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
    canvas.on("mouse:dblclick", handleDblClick)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      canvas.off("mouse:down", handleMouseDown)
      canvas.off("mouse:move", handleMouseMove)
      canvas.off("mouse:dblclick", handleDblClick)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeTool, setCanvas, history, syncLayers, setActiveTool])

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
