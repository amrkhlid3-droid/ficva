"use client"

import { useEffect, useRef } from "react"
import { Path, FabricObject } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"
import type { NodeMode } from "@/types/fabric"

type PathCommand = (string | number)[]

interface PenPoint {
  x: number
  y: number
  cp1: { x: number; y: number }
  cp2: { x: number; y: number }
  nodeMode?: NodeMode
}

/**
 * Hook for pen tool functionality.
 *
 * Responsibilities:
 * - Handle pen tool mouse events (down, move, up, dblclick)
 * - Create bezier path from points
 * - Support curve dragging (symmetric handles)
 * - Auto-switch to select tool after path completion
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasPenTool() {
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const penToolConfig = useEditorStore((s) => s.penToolConfig)
  const history = useEditorStore((s) => s.history)

  // Refs for pen tool state
  const activePathObjectRef = useRef<FabricObject | null>(null)
  const pathPointsRef = useRef<PenPoint[]>([])
  const isDraggingRef = useRef(false)
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null)

  // Update cursor based on active tool
  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    if (activeTool === "pen") {
      canvas.defaultCursor = "crosshair"
      canvas.hoverCursor = "crosshair"
    } else {
      canvas.defaultCursor = "default"
      canvas.hoverCursor = "move"
    }
    canvas.requestRenderAll()
  }, [activeTool])

  // Main pen tool logic
  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas || activeTool !== "pen") return

    // Disable selection when using Pen Tool
    canvas.defaultCursor = "crosshair"
    canvas.selection = false
    canvas.forEachObject((o) => (o.selectable = false))
    canvas.requestRenderAll()

    // Helper: Create Path from Bezier Points
    const createPath = (points: PenPoint[]) => {
      if (points.length === 0) return null

      const commands = points.map((p, index) => {
        if (index === 0) {
          return `M ${p.x} ${p.y}`
        }
        const prev = points[index - 1]!
        return `C ${prev.cp2.x} ${prev.cp2.y} ${p.cp1.x} ${p.cp1.y} ${p.x} ${p.y}`
      })

      const pathData = commands.join(" ")
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
        nodeModes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    }

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
          nodeMode: "straight",
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
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        }
        // New Ghost
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        })
      }

      // Redraw
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (opt: any) => {
      if (activeTool !== "pen") return

      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current
      if (points.length === 0) return

      if (isDraggingRef.current && dragStartPointRef.current) {
        // Dragging out handles from the anchor we just placed
        const anchor = points[points.length - 2]!
        const start = dragStartPointRef.current

        const rawDx = pointer.x - start.x
        const rawDy = pointer.y - start.y
        const dist = Math.hypot(rawDx, rawDy)

        const controlLength = 5
        if (dist > controlLength) {
          const effectiveDist = dist - controlLength
          const scale = (effectiveDist / dist) * 0.5
          const dx = rawDx * scale
          const dy = rawDy * scale

          anchor.cp2 = { x: anchor.x + dx, y: anchor.y + dy }
          anchor.cp1 = { x: anchor.x - dx, y: anchor.y - dy }
          anchor.nodeMode = "mirrored"
        } else {
          anchor.nodeMode = "straight"
          anchor.cp1 = { x: anchor.x, y: anchor.y }
          anchor.cp2 = { x: anchor.x, y: anchor.y }
        }
      } else {
        // Hovering: Update ghost point
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        }
      }

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

      // Remove duplicate points from double-click
      while (points.length > 1) {
        const last = points[points.length - 1]!
        const prev = points[points.length - 2]!
        const dist = Math.hypot(last.x - prev.x, last.y - prev.y)
        if (dist < 0.5) {
          points.pop()
        } else {
          break
        }
      }

      // Create final closed path
      if (points.length > 1) {
        const commands = points.map((p, index) => {
          if (index === 0) {
            return ["M", p.x, p.y] as PathCommand
          }
          const prev = points[index - 1]!
          return [
            "C",
            prev.cp2.x,
            prev.cp2.y,
            p.cp1.x,
            p.cp1.y,
            p.x,
            p.y,
          ] as PathCommand
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
          objectCaching: false,
          exactBoundingBox: true,
          selectable: true,
          evented: true,
          originX: "left",
          originY: "top",
          id: crypto.randomUUID(),
          nodeModes,
        })

        const command = new AddObjectCommand(canvas, path)
        history.execute(command)

        // Auto-switch to select tool
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

      // Restore selection when leaving Pen Tool
      canvas.selection = true
      canvas.forEachObject((o) => (o.selectable = true))
      canvas.requestRenderAll()
    }
  }, [activeTool, setActiveTool, penToolConfig, history])
}
