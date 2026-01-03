"use client"

/**
 * FabricCanvas.full - 完整版本
 *
 * 包含所有功能：钢笔工具、路径编辑、缩放控制、导航器等。
 * 如需使用最小化调试版本，请修改 FabricCanvas.tsx 的导出。
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Circle, FabricObject, Line, Path, Point, util } from "fabric"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/store/useEditorStore"
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
import ZoomControls from "./ZoomControls"
import CanvasNavigator from "./CanvasNavigator"

// Import modular hooks | 导入模块化钩子
import {
  useCanvasInit,
  useCanvasSelection,
  useCanvasHistory,
  useCanvasLayerSync,
  useCanvasSnapshot,
  useCanvasKeyboard,
  useCanvasDrawingMode,
  useCanvasZoom,
  useMiddleMousePan,
  useCanvasWorkspaceAutoFit,
} from "@/hooks/canvas"

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

/**
 * FabricCanvas - Modular Architecture | 模块化架构
 *
 * This component uses modular hooks for initialization and common functionality,
 * while keeping complex path editing logic inline due to its deeply integrated nature.
 *
 * 此组件使用模块化钩子进行初始化和常用功能，
 * 同时由于复杂的路径编辑逻辑高度集成，保留在组件内部。
 *
 * Modular Hooks Used | 使用的模块化钩子:
 * - useCanvasInit: Canvas creation and background | 画布创建和背景
 * - useCanvasSelection: Selection events sync | 选择事件同步
 * - useCanvasHistory: Transform tracking for undo/redo | 撤销/重做变换跟踪
 * - useCanvasLayerSync: Layer panel synchronization | 图层面板同步
 * - useCanvasSnapshot: Canvas state sync to pages store | 画布状态同步到页面存储
 * - useCanvasKeyboard: Keyboard shortcuts | 键盘快捷键
 * - useCanvasDrawingMode: Drawing mode sync | 绘图模式同步
 * - useCanvasZoom: Zoom controls | 缩放控制
 * - useMiddleMousePan: Middle mouse pan controls | 中键平移控制
 *
 * Inline Logic (too complex to modularize) | 内联逻辑（过于复杂无法模块化）:
 * - Pen Tool: Bezier path creation | 钢笔工具：贝塞尔路径创建
 * - Path Editing: Control point manipulation | 路径编辑：控制点操作
 */
export default function FabricCanvas() {
  // Canvas 由 useCanvasInit 动态创建，不再需要 canvasEl ref
  // Canvas is created dynamically by useCanvasInit, canvasEl ref is no longer needed
  const containerRef = useRef<HTMLDivElement>(null!)
  const { theme } = useTheme()

  // ========================================
  // Modular Hooks | 模块化钩子
  // ========================================

  // Core initialization | 核心初始化
  useCanvasInit({ containerRef })

  // Selection events | 选择事件
  useCanvasSelection()

  // History tracking (undo/redo) | 历史跟踪（撤销/重做）
  useCanvasHistory()

  // Layer sync | 图层同步
  useCanvasLayerSync()

  // Canvas snapshot (state sync to pages store) | 画布快照（状态同步到页面存储）
  useCanvasSnapshot()

  // Keyboard shortcuts | 键盘快捷键
  useCanvasKeyboard()

  // Drawing mode sync | 绘图模式同步
  useCanvasDrawingMode()

  // Zoom controls | 缩放控制
  const { zoom, zoomMode, zoomIn, zoomOut, zoomToFit, centerAndZoom } =
    useCanvasZoom(containerRef)

  // Pan controls | 平移控制
  const { isPanning } = useMiddleMousePan()

  // Workspace auto-fit (respond to workspace size changes)
  // Workspace 尺寸变化后自动居中缩放
  useCanvasWorkspaceAutoFit()

  // ========================================
  // Component State | 组件状态
  // ========================================

  // Delete node dialog state
  const [deleteNodeDialogOpen, setDeleteNodeDialogOpen] = useState(false)
  const pendingDeleteNodeRef = useRef<{ nodeIndex: number } | null>(null)

  // Canvas dimensions and scroll state
  const canvasContainerSize = useEditorStore((s) => s.canvasContainerSize)
  const scrollPosition = useEditorStore((s) => s.scrollPosition)
  const logicalCanvasSize = useEditorStore((s) => s.logicalCanvasSize)

  const canvasWidth = logicalCanvasSize.width
  const canvasHeight = logicalCanvasSize.height
  const showNavigator = canvasContainerSize !== null

  // Handle navigator navigation
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

  // ========================================
  // Path Editing State | 路径编辑状态
  // ========================================

  const editingPathRef = useRef<Path | null>(null)
  const controlsRef = useRef<FabricObject[]>([])
  const clearControlsRef = useRef<(() => void) | null>(null)
  const editModeEntryNodesRef = useRef<{
    nodes: import("@/types/fabric").PathNode[]
    closed: boolean
  } | null>(null)
  const controlDragStartRef = useRef<{
    nodeIndex: number
    anchor: { x: number; y: number }
    handleIn: { x: number; y: number }
    handleOut: { x: number; y: number }
    type: "anchor" | "handle_in" | "handle_out"
  } | null>(null)

  // ========================================
  // Control Point Zoom Scaling | 控制点缩放
  // ========================================

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    // Update canvas rendering quality for crisp display at high zoom levels
    const canvasElement = canvas.getElement()
    if (canvasElement) {
      const ctx = canvasElement.getContext("2d")
      if (ctx) {
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

        const baseRadius = data.type === "anchor" ? 5 : 3
        const baseStrokeWidth = 1
        const basePadding = data.type === "anchor" ? 10 : 5

        cp.set({
          radius: baseRadius / zoom,
          strokeWidth: baseStrokeWidth / zoom,
          padding: basePadding / zoom,
        })
        cp.setCoords()

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

  // ========================================
  // Theme-aware Pen Color | 主题感知笔触颜色
  // ========================================

  const setPenToolConfig = useEditorStore((s) => s.setPenToolConfig)
  const penToolConfig = useEditorStore((s) => s.penToolConfig)

  useEffect(() => {
    if (theme === "dark" && penToolConfig.stroke === "#000000") {
      setPenToolConfig({ stroke: "#ffffff" })
    } else if (theme === "light" && penToolConfig.stroke === "#ffffff") {
      setPenToolConfig({ stroke: "#000000" })
    }
  }, [theme, penToolConfig.stroke, setPenToolConfig])

  // ========================================
  // Pen Tool Logic | 钢笔工具逻辑
  // ========================================

  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)

  const activePathObjectRef = useRef<FabricObject | null>(null)
  const pathPointsRef = useRef<
    {
      x: number
      y: number
      cp1: { x: number; y: number }
      cp2: { x: number; y: number }
      nodeMode?: NodeMode
    }[]
  >([])
  const isDraggingRef = useRef(false)
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null)

  // Set cursor based on active tool
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

  // Pen Tool Main Logic
  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas || activeTool !== "pen") return

    canvas.defaultCursor = "crosshair"
    canvas.selection = false
    canvas.forEachObject((o) => (o.selectable = false))
    canvas.requestRenderAll()

    const createPath = (points: typeof pathPointsRef.current) => {
      if (points.length === 0) return null

      const { penToolConfig } = useEditorStore.getState()

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
      }) as any
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = (opt: any) => {
      if (activeTool !== "pen") return

      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current

      isDraggingRef.current = true
      dragStartPointRef.current = { x: pointer.x, y: pointer.y }

      if (points.length === 0) {
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        })
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        })
      } else {
        const lastIndex = points.length - 1
        points[lastIndex] = {
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        }
        points.push({
          x: pointer.x,
          y: pointer.y,
          cp1: { x: pointer.x, y: pointer.y },
          cp2: { x: pointer.x, y: pointer.y },
          nodeMode: "straight",
        })
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseMove = (opt: any) => {
      if (activeTool !== "pen") return
      const pointer = canvas.getScenePoint(opt.e)
      const points = pathPointsRef.current
      if (points.length === 0) return

      if (isDraggingRef.current && dragStartPointRef.current) {
        const anchor = points[points.length - 2]!
        const start = dragStartPointRef.current

        const rawDx = pointer.x - start.x
        const rawDy = pointer.y - start.y
        const dist = Math.hypot(rawDx, rawDy)

        const control_length = 5
        if (dist > control_length) {
          const effectiveDist = dist - control_length
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

      if (activePathObjectRef.current) {
        canvas.remove(activePathObjectRef.current)
        activePathObjectRef.current = null
      }

      const points = pathPointsRef.current
      points.pop()

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

      if (points.length > 1) {
        const { penToolConfig } = useEditorStore.getState()

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
        useEditorStore.getState().history.execute(command)

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

      canvas.selection = true
      canvas.forEachObject((o) => (o.selectable = true))
      canvas.requestRenderAll()
    }
  }, [activeTool, setActiveTool])

  // ========================================
  // Path Editing Logic | 路径编辑逻辑
  // ========================================

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cleanup = (ghostPath as any)._cleanupBreathing
          if (typeof cleanup === "function") cleanup()
          canvas.remove(ghostPath)
        }
      }
    }

    const clearControls = () => {
      useEditorStore.getState().setEditingPath(null)
      removeControlsVisuals()

      canvas.selection = true
      canvas.forEachObject((o) => {
        const obj = o as EditablePath & ControlPoint
        if (!obj.isGhost && !obj.excludeFromExport) {
          obj.selectable = true
          obj.evented = true
        }
      })

      editModeEntryNodesRef.current = null

      if (editingPathRef.current) {
        const oldPath = editingPathRef.current as EditablePath

        const firstCmd = oldPath.path[0]
        if (!firstCmd || firstCmd.length < 3) return

        const oldMatrix = oldPath.calcTransformMatrix()
        const oldOffset = oldPath.pathOffset || { x: 0, y: 0 }
        const oldLocalX = (firstCmd[1] as number) - oldOffset.x
        const oldLocalY = (firstCmd[2] as number) - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        const newPathData = oldPath.path.map((cmd) => [...cmd]) as PathCommand[]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPath = new Path(newPathData as any, {
          fill: oldPath.fill,
          stroke: oldPath._originalStroke || oldPath.stroke,
          strokeWidth: oldPath._originalStrokeWidth || oldPath.strokeWidth,
          strokeLineJoin: oldPath.strokeLineJoin,
          strokeMiterLimit: oldPath.strokeMiterLimit,
          strokeLineCap: oldPath.strokeLineCap,
          strokeDashArray: oldPath.strokeDashArray,
          objectCaching: false,
          exactBoundingBox: true,
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((oldPath as any).customPathData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(newPath as any).customPathData = (oldPath as any).customPathData
        }

        const newMatrix = newPath.calcTransformMatrix()
        const newOffset = newPath.pathOffset || { x: 0, y: 0 }
        const newLocalX = firstCmd[1]! - newOffset.x
        const newLocalY = firstCmd[2]! - newOffset.y
        const newWorldPt = new Point(newLocalX, newLocalY).transform(newMatrix)

        const deltaX = oldWorldPt.x - newWorldPt.x
        const deltaY = oldWorldPt.y - newWorldPt.y

        newPath.set({
          left: (newPath.left || 0) + deltaX,
          top: (newPath.top || 0) + deltaY,
        })

        canvas.remove(oldPath)
        canvas.add(newPath)
        canvas.setActiveObject(newPath)
        newPath.setCoords()

        editingPathRef.current = null
      }
      canvas.requestRenderAll()
    }

    clearControlsRef.current = clearControls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(canvas as any).exitEditMode = clearControls

    const regeneratePath = () => {
      if (!editingPathRef.current) return
      const pathObj = editingPathRef.current as EditablePath & {
        customPathData?: CustomPathData
      }

      if (!pathObj.customPathData) {
        console.warn("No customPathData found on path object")
        return
      }

      const newCommands = nodesToSvgPath(pathObj.customPathData)
      pathObj.set({ path: newCommands })
      pathObj.setCoords()
      pathObj.dirty = true
    }

    const refreshControlLines = () => {
      const controls = controlsRef.current as ControlPoint[]
      const anchorsByIndex: Map<number, ControlPoint> = new Map()

      controls.forEach((ctrl) => {
        const data = ctrl.data
        if (!data) return
        if (data.type === "anchor") {
          anchorsByIndex.set(data.nodeIndex, ctrl)
        }
      })

      controls.forEach((ctrl) => {
        const c = ctrl
        if (c.data?.type === "handle_in" && c.line) {
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
        padding: basePadding / currentZoom,
        data: { type, nodeIndex, nodeMode },
        excludeFromExport: true,
      })
      return circle as ControlPoint
    }

    // Helper: Recreate Ghost Path
    const recreateGhostPath = () => {
      const pathObj = editingPathRef.current
      if (!canvas || !pathObj) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldGhost = (pathObj as any)._ghostPath as Path

      const newGhost = new Path(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathObj.path as any,
        {
          objectCaching: false,
          fill: "",
          stroke: "#4f46e5",
          strokeWidth: pathObj.strokeWidth || 1,
          strokeUniform: pathObj.strokeUniform,
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
          scaleX: pathObj.scaleX,
          scaleY: pathObj.scaleY,
          angle: pathObj.angle,
          skewX: pathObj.skewX,
          skewY: pathObj.skewY,
          originX: pathObj.originX,
          originY: pathObj.originY,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      )

      const firstCmd = pathObj.path[0]
      if (firstCmd && firstCmd.length >= 3) {
        const oldMatrix = pathObj.calcTransformMatrix()
        const oldOffset = pathObj.pathOffset || { x: 0, y: 0 }
        const oldLocalX = (firstCmd[1] as number) - oldOffset.x
        const oldLocalY = (firstCmd[2] as number) - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        const newMatrix = newGhost.calcTransformMatrix()
        const newOffset = newGhost.pathOffset || { x: 0, y: 0 }
        const newLocalX = (firstCmd[1] as number) - newOffset.x
        const newLocalY = (firstCmd[2] as number) - newOffset.y
        const newWorldPt = new Point(newLocalX, newLocalY).transform(newMatrix)

        const dx = oldWorldPt.x - newWorldPt.x
        const dy = oldWorldPt.y - newWorldPt.y
        newGhost.set({
          left: (newGhost.left || 0) + dx,
          top: (newGhost.top || 0) + dy,
        })
        newGhost.setCoords()
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(newGhost as any).customPathData = (pathObj as any).customPathData

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathAny = pathObj as any
      if (pathAny._bindGhostPathEvents) {
        pathAny._bindGhostPathEvents(newGhost)
      }

      canvas.add(newGhost)

      controlsRef.current.forEach((c) => {
        if (canvas.contains(c)) canvas.bringObjectToFront(c)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(pathObj as any)._ghostPath = newGhost

      if (oldGhost) {
        canvas.remove(oldGhost)
      }

      canvas.requestRenderAll()
    }

    const enterEditMode = (pathObj: Path) => {
      const pathWithData = pathObj as EditablePath & {
        customPathData?: CustomPathData
      }

      if (!pathWithData.customPathData) {
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
              newCmds.push(["C", lx, ly, x, y, x, y])
              lx = x
              ly = y
            } else if (cmd[0] === "C") {
              lx = cmd[5] as number
              ly = cmd[6] as number
              newCmds.push(cmd)
            } else if (cmd[0] === "Z") {
              newCmds.push(["Z"])
              lx = sx
              ly = sy
            }
          })

          if (normalized) {
            pathObj.set({ path: newCmds })
            pathObj.setCoords()
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathAny = pathObj as any
        pathWithData.customPathData = svgPathToNodes(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pathObj.path as any[],
          pathAny.nodeModes
        )
      }

      if (editingPathRef.current) {
        if (editingPathRef.current !== pathObj) {
          clearControls()
        } else {
          removeControlsVisuals()
        }
      }

      useEditorStore.getState().setEditingPath(pathObj)
      editingPathRef.current = pathObj

      if (!editModeEntryNodesRef.current && pathWithData.customPathData) {
        editModeEntryNodesRef.current = {
          nodes: JSON.parse(JSON.stringify(pathWithData.customPathData.nodes)),
          closed: pathWithData.customPathData.closed,
        }
      }

      pathObj.selectable = false
      pathObj.evented = false
      pathObj.objectCaching = false

      canvas.selection = false
      canvas.forEachObject((o) => {
        o.selectable = false
        o.evented = false
      })

      // Create Ghost Path
      const ghostPath = new Path(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathObj.path as any,
        {
          objectCaching: false,
          fill: "",
          stroke: "#4f46e5",
          strokeWidth: pathObj.strokeWidth || 1,
          strokeUniform: pathObj.strokeUniform,
          strokeLineCap: pathObj.strokeLineCap,
          strokeLineJoin: pathObj.strokeLineJoin,
          strokeMiterLimit: pathObj.strokeMiterLimit,
          strokeDashArray: pathObj.strokeDashArray,
          strokeDashOffset: pathObj.strokeDashOffset,
          selectable: true,
          evented: true,
          perPixelTargetFind: true,
          hoverCursor: "default",
          scaleX: pathObj.scaleX,
          scaleY: pathObj.scaleY,
          angle: pathObj.angle,
          skewX: pathObj.skewX,
          skewY: pathObj.skewY,
          originX: pathObj.originX,
          originY: pathObj.originY,
          excludeFromExport: true,
          isGhost: true,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          lockScalingX: true,
          lockScalingY: true,
          hasControls: false,
          hasBorders: true,
          customPathData: (
            pathObj as EditablePath & { customPathData?: CustomPathData }
          ).customPathData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      )

      // Position ghost path
      const firstCmd = pathObj.path[0]
      if (firstCmd && firstCmd.length >= 3) {
        const oldMatrix = pathObj.calcTransformMatrix()
        const oldOffset = pathObj.pathOffset || { x: 0, y: 0 }
        const oldLocalX = (firstCmd[1] as number) - oldOffset.x
        const oldLocalY = (firstCmd[2] as number) - oldOffset.y
        const oldWorldPt = new Point(oldLocalX, oldLocalY).transform(oldMatrix)

        const ghostMatrix = ghostPath.calcTransformMatrix()
        const ghostOffset = ghostPath.pathOffset || { x: 0, y: 0 }
        const ghostLocalX = (firstCmd[1] as number) - ghostOffset.x
        const ghostLocalY = (firstCmd[2] as number) - ghostOffset.y
        const ghostWorldPt = new Point(ghostLocalX, ghostLocalY).transform(
          ghostMatrix
        )

        const dx = oldWorldPt.x - ghostWorldPt.x
        const dy = oldWorldPt.y - ghostWorldPt.y
        ghostPath.set({
          left: (ghostPath.left || 0) + dx,
          top: (ghostPath.top || 0) + dy,
        })
        ghostPath.setCoords()
      }

      canvas.add(ghostPath)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(pathObj as any)._ghostPath = ghostPath

      canvas.discardActiveObject()

      // Hover Logic on Ghost Path with Breathing Animation
      const highlightColor = "#4f46e5"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pathAny = pathObj as any
      pathAny._ghostHoverState = {
        breathingAnimationId: null as number | null,
        hoverIndicator: null as Circle | null,
        isHovering: false,
        highlightColor,
        lastClickTime: 0,
      }

      const bindGhostPathEvents = (gp: Path) => {
        const state = pathAny._ghostHoverState

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

        const startBreathingAnimation = () => {
          if (state.breathingAnimationId !== null) return

          let opacity = 1
          let increasing = false
          const minOpacity = 0.3
          const maxOpacity = 1
          const step = 0.03

          const animate = () => {
            if (!gp || !canvas) return

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

            gp.set({ opacity })

            if (state.hoverIndicator && state.hoverIndicator.visible) {
              state.hoverIndicator.set({ opacity })
            }

            canvas.requestRenderAll()
            state.breathingAnimationId = requestAnimationFrame(animate)
          }

          state.breathingAnimationId = requestAnimationFrame(animate)
        }

        const stopBreathingAnimation = () => {
          if (state.breathingAnimationId !== null) {
            cancelAnimationFrame(state.breathingAnimationId)
            state.breathingAnimationId = null
          }
          gp.set({ opacity: 1 })
          if (state.hoverIndicator) {
            state.hoverIndicator.set({ visible: false, opacity: 1 })
          }
          canvas.requestRenderAll()
        }

        const updateHoverIndicatorPosition = (e: {
          pointer?: Point
          e?: MouseEvent
        }) => {
          if (!state.hoverIndicator) return

          const indicator = state.hoverIndicator
          let pointer: { x: number; y: number } | null = null
          if (e.pointer) {
            pointer = e.pointer
          } else if (e.e && canvas) {
            const canvasPointer = canvas.getViewportPoint(e.e)
            pointer = { x: canvasPointer.x, y: canvasPointer.y }
          }
          if (!pointer) return

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
          gp.set({ stroke: state.highlightColor, opacity: 1 })
          canvas.requestRenderAll()
        })

        gp.on("mousedown", (e) => {
          const mouseEvent = e.e as MouseEvent
          if (mouseEvent.button !== 0) return

          const now = Date.now()
          const timeSinceLastClick = now - state.lastClickTime
          state.lastClickTime = now

          if (timeSinceLastClick > 300) return
          state.lastClickTime = 0

          const currentPath = editingPathRef.current
          if (!currentPath) return

          const pathData = (
            currentPath as EditablePath & { customPathData?: CustomPathData }
          ).customPathData
          if (!pathData) return

          const pointer = canvas.getViewportPoint(mouseEvent)
          const matrix = currentPath.calcTransformMatrix()
          const invertedMatrix = util.invertTransform(matrix)
          const localPoint = new Point(pointer.x, pointer.y).transform(
            invertedMatrix
          )
          const offset = currentPath.pathOffset || { x: 0, y: 0 }
          const rawPoint = {
            x: localPoint.x + offset.x,
            y: localPoint.y + offset.y,
          }

          const result = findClosestSegment(
            pathData.nodes,
            rawPoint,
            pathData.closed,
            20
          )

          if (!result) return

          const { segmentIndex, t } = result
          const nodes = pathData.nodes

          const prevNode = nodes[segmentIndex]
          const nextNode = nodes[(segmentIndex + 1) % nodes.length]

          if (!prevNode || !nextNode) return

          const newMode: NodeMode =
            prevNode.mode === "straight" && nextNode.mode === "straight"
              ? "straight"
              : "mirrored"

          const newNodes = insertNodeAtSegment(nodes, segmentIndex, t, newMode)
          pathData.nodes = newNodes

          regeneratePath()
          enterEditMode(currentPath)

          mouseEvent.stopPropagation()
          mouseEvent.preventDefault()
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(gp as any)._cleanupBreathing = () => {
          stopBreathingAnimation()
          if (state.hoverIndicator) {
            canvas.remove(state.hoverIndicator)
            state.hoverIndicator = null
          }
        }
      }

      pathAny._bindGhostPathEvents = bindGhostPathEvents
      bindGhostPathEvents(ghostPath)

      canvas.requestRenderAll()

      // Create control points from nodes
      const matrix = pathObj.calcTransformMatrix()
      const transformPoint = (x: number, y: number) => {
        const offset = pathObj.pathOffset || { x: 0, y: 0 }
        const localX = x - offset.x
        const localY = y - offset.y
        return new Point(localX, localY).transform(matrix)
      }

      const { nodes } = pathWithData.customPathData

      nodes.forEach((node, nodeIndex) => {
        const { anchor } = node
        const p = transformPoint(anchor.x, anchor.y)

        const anchorCtrl = createControl(
          p.x,
          p.y,
          "anchor",
          nodeIndex,
          node.mode
        )
        canvas.add(anchorCtrl)
        controlsRef.current.push(anchorCtrl)

        if (node.mode === "mirrored") {
          const displayHandleIn = actualToDisplay(node.handleIn)
          const displayHandleOut = actualToDisplay(node.handleOut)

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

          const lineOut = new Line([p.x, p.y, pOut.x, pOut.y], {
            stroke: "#888888",
            strokeWidth: 1 / currentZoom,
            selectable: false,
            evented: false,
            originX: "center",
            originY: "center",
            excludeFromExport: true,
          })

          handleIn.line = lineIn
          handleOut.line = lineOut

          canvas.add(lineIn, lineOut, handleIn, handleOut)
          controlsRef.current.push(lineIn, lineOut, handleIn, handleOut)
        }
      })

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

      if (editingPathRef.current && !e.target) {
        clearControls()
        return
      }

      if (e.target && e.target.type === "path") {
        if (editingPathRef.current === e.target) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e.target as any).isGhost) return
        enterEditMode(e.target as Path)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseDown = (e: any) => {
      if (!editingPathRef.current) return

      const pathObj = editingPathRef.current as EditablePath
      const pathWithData = pathObj as EditablePath & {
        customPathData?: CustomPathData
      }
      if (!pathWithData.customPathData) return

      const target = e.target as ControlPoint
      const mouseEvent = e.e as MouseEvent

      if (mouseEvent.button === 2 && controlDragStartRef.current) {
        const saved = controlDragStartRef.current
        const node = pathWithData.customPathData.nodes[saved.nodeIndex]
        if (node) {
          node.anchor = { ...saved.anchor }
          node.handleIn = { ...saved.handleIn }
          node.handleOut = { ...saved.handleOut }
          regeneratePath()
          enterEditMode(pathObj)
        }
        controlDragStartRef.current = null
        return
      }

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

      const pathObj = editingPathRef.current
      const pathWithData = pathObj as EditablePath & {
        customPathData?: CustomPathData
      }

      if (!pathWithData.customPathData) return

      const { nodes } = pathWithData.customPathData
      const nodeIndex = data.nodeIndex

      if (nodeIndex === undefined || !nodes[nodeIndex]) return

      const matrix = pathObj.calcTransformMatrix()
      const invertedMatrix = util.invertTransform(matrix)
      const localPoint = new Point(target.left, target.top).transform(
        invertedMatrix
      )
      const offset = pathObj.pathOffset || { x: 0, y: 0 }
      const rawX = localPoint.x + offset.x
      const rawY = localPoint.y + offset.y

      if (data.type === "anchor") {
        const node = nodes[nodeIndex]
        node.anchor.x = rawX
        node.anchor.y = rawY

        regeneratePath()

        if (node.mode === "mirrored") {
          const transformPoint = (x: number, y: number) => {
            const off = pathObj.pathOffset || { x: 0, y: 0 }
            const localX = x - off.x
            const localY = y - off.y
            return new Point(localX, localY).transform(matrix)
          }

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

        refreshControlLines()
        return
      }

      if (data.type === "handle_in" || data.type === "handle_out") {
        const node = nodes[nodeIndex]
        const anchor = node.anchor

        const displayDx = rawX - anchor.x
        const displayDy = rawY - anchor.y

        const actualOffset = displayToActual({ x: displayDx, y: displayDy })
        const dx = actualOffset.x
        const dy = actualOffset.y

        if (node.mode === "mirrored") {
          if (data.type === "handle_in") {
            node.handleIn = { x: dx, y: dy }
            node.handleOut = { x: -dx, y: -dy }
          } else {
            node.handleOut = { x: dx, y: dy }
            node.handleIn = { x: -dx, y: -dy }
          }
        } else {
          if (data.type === "handle_in") {
            node.handleIn = { x: dx, y: dy }
          } else {
            node.handleOut = { x: dx, y: dy }
          }
        }

        const transformPoint = (x: number, y: number) => {
          const off = pathObj.pathOffset || { x: 0, y: 0 }
          const localX = x - off.x
          const localY = y - off.y
          return new Point(localX, localY).transform(matrix)
        }

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

        if (node.mode === "mirrored") {
          const oppositeType =
            data.type === "handle_in" ? "handle_out" : "handle_in"
          const oppositeCtrl = (controlsRef.current as ControlPoint[]).find(
            (c) =>
              c.data?.type === oppositeType && c.data.nodeIndex === nodeIndex
          )

          if (oppositeCtrl) {
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

        regeneratePath()
        refreshControlLines()
      }
    }

    const handleGlobalMouseUp = () => {
      if (editingPathRef.current) {
        recreateGhostPath()
      }
      controlDragStartRef.current = null
    }

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
      if (!node) return

      const newMode = e.mode
      node.mode = newMode

      if (newMode === "mirrored") {
        const isHandleInZero = node.handleIn.x === 0 && node.handleIn.y === 0
        const isHandleOutZero = node.handleOut.x === 0 && node.handleOut.y === 0

        if (isHandleInZero && isHandleOutZero) {
          const nodes = pathObj.customPathData.nodes
          const isClosed = pathObj.customPathData.closed
          const numNodes = nodes.length

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

          let dirX = 1,
            dirY = 0

          if (prevNode && nextNode) {
            dirX = nextNode.anchor.x - prevNode.anchor.x
            dirY = nextNode.anchor.y - prevNode.anchor.y
          } else if (prevNode) {
            dirX = node.anchor.x - prevNode.anchor.x
            dirY = node.anchor.y - prevNode.anchor.y
          } else if (nextNode) {
            dirX = nextNode.anchor.x - node.anchor.x
            dirY = nextNode.anchor.y - node.anchor.y
          }

          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
          if (dirLen > 0.001) {
            dirX /= dirLen
            dirY /= dirLen
          } else {
            dirX = 1
            dirY = 0
          }

          const handleLength = 0.001
          node.handleOut = { x: dirX * handleLength, y: dirY * handleLength }
          node.handleIn = { x: -dirX * handleLength, y: -dirY * handleLength }
        } else {
          const lenIn = Math.sqrt(node.handleIn.x ** 2 + node.handleIn.y ** 2)
          const lenOut = Math.sqrt(
            node.handleOut.x ** 2 + node.handleOut.y ** 2
          )

          if (lenOut >= lenIn) {
            node.handleIn = { x: -node.handleOut.x, y: -node.handleOut.y }
          } else {
            node.handleOut = { x: -node.handleIn.x, y: -node.handleIn.y }
          }
        }
      } else if (newMode === "straight") {
        node.handleIn = { x: 0, y: 0 }
        node.handleOut = { x: 0, y: 0 }
      }

      regeneratePath()
      enterEditMode(pathObj)

      const newControls = controlsRef.current as ControlPoint[]
      const newAnchor = newControls.find((c) => {
        const d = c.data
        return d && d.type === "anchor" && d.nodeIndex === nodeIndex
      })

      if (newAnchor) {
        canvas.setActiveObject(newAnchor)
        useEditorStore.getState().setSelectedObjects([newAnchor])
        canvas.requestRenderAll()
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleNodeDelete = (e: { target: any }) => {
      const target = e.target
      if (target?.data?.type === "anchor") {
        pendingDeleteNodeRef.current = { nodeIndex: target.data.nodeIndex }
        setDeleteNodeDialogOpen(true)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSelection = (e: any) => {
      if (!editingPathRef.current) return

      const selected = e.selected || []
      const deselected = e.deselected || []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deselected.forEach((obj: any) => {
        const data = obj.data
        if (!data) return
        if (data.type === "anchor") {
          obj.set("fill", "#0000ff")
        } else if (data.type === "handle_in" || data.type === "handle_out") {
          obj.set("fill", "#ffffff")
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selected.forEach((obj: any) => {
        const data = obj.data
        if (!data) return
        if (
          data.type === "anchor" ||
          data.type === "handle_in" ||
          data.type === "handle_out"
        ) {
          obj.set("fill", "#ffff00")
        }
      })
      canvas.requestRenderAll()
    }

    const handlePathDataChanged = (e: { target?: FabricObject }) => {
      if (!e.target || e.target.type !== "path") return
      if (editingPathRef.current === e.target) {
        enterEditMode(e.target as Path)
      }
    }

    const handleObjectModified = (e: { target?: FabricObject }) => {
      if (!e.target || e.target.type !== "path") return
      if (editingPathRef.current === e.target) {
        const pathObj = editingPathRef.current as EditablePath
        const ghostPath = pathObj._ghostPath

        if (ghostPath) {
          ghostPath.set({ strokeWidth: pathObj.strokeWidth || 1 })
          recreateGhostPath()
        }

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
              const displayHandleIn = actualToDisplay(node.handleIn)
              const p = transformPoint(
                node.anchor.x + displayHandleIn.x,
                node.anchor.y + displayHandleIn.y
              )
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            } else if (data.type === "handle_out" && node.mode === "mirrored") {
              const displayHandleOut = actualToDisplay(node.handleOut)
              const p = transformPoint(
                node.anchor.x + displayHandleOut.x,
                node.anchor.y + displayHandleOut.y
              )
              ctrl.set({ left: p.x, top: p.y })
              ctrl.setCoords()
            }
          })

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
  }, [activeTool])

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

    if (nodes.length <= 2) {
      setDeleteNodeDialogOpen(false)
      pendingDeleteNodeRef.current = null
      return
    }

    nodes.splice(nodeIndex, 1)

    const newCommands = nodesToSvgPath(pathObj.customPathData)
    pathObj.set({ path: newCommands })
    pathObj.setCoords()
    pathObj.dirty = true

    canvas.fire("path:data:changed", { target: pathObj })

    pendingDeleteNodeRef.current = null
    setDeleteNodeDialogOpen(false)
  }

  // ========================================
  // Render | 渲染
  // ========================================

  return (
    <div
      ref={containerRef}
      /**
       * 【关键修复】[&>.canvas-container]:absolute! [&>.canvas-container]:inset-0!
       *
       * Fabric.js 会将 canvas 包裹在 div.canvas-container 中。
       * 必须设置为 absolute 定位，否则会导致 ResizeObserver 无限循环：
       * ResizeObserver → setDimensions → container 高度变化 → ResizeObserver...
       */
      className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 [&>.canvas-container]:absolute! [&>.canvas-container]:inset-0!"
      style={{
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      {/* Dot Pattern Background */}
      <div
        className="pointer-events-none absolute inset-0 text-zinc-300 opacity-50 dark:text-zinc-700 dark:opacity-20"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Canvas Element - 由 useCanvasInit 动态创建并添加到 containerRef */}
      {/* Canvas Element - created dynamically by useCanvasInit and appended to containerRef */}

      {/* Canvas Navigator */}
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
        zoomMode={zoomMode}
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
