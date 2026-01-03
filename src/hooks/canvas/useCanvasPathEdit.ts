"use client"

import { useEffect, useRef, useCallback } from "react"
import { Path, Circle, Line, FabricObject, Point } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { svgPathToNodes } from "@/lib/editor/pathConverter"
import { nodesToSvgPath } from "@/lib/editor/pathUtils"
import type { NodeMode, CustomPathData, PathNode } from "@/types/fabric"

type PathCommand = (string | number)[]

interface ControlPoint extends Circle {
  line?: Line
  lineToHandle?: Line
  handle?: ControlPoint
  lineFromAnchor?: boolean
  data?: {
    type: "anchor" | "handle_in" | "handle_out"
    nodeIndex: number
    nodeMode?: NodeMode
  }
}

interface EditablePath extends Path {
  _ghostPath?: Path
  _originalStroke?: string | FabricObject["stroke"]
  _originalStrokeWidth?: number
  id?: string
  isGhost?: boolean
  customPathData?: CustomPathData
}

export interface PathEditRefs {
  editingPathRef: React.MutableRefObject<Path | null>
  controlsRef: React.MutableRefObject<FabricObject[]>
  clearControlsRef: React.MutableRefObject<(() => void) | null>
}

/**
 * Hook for path editing functionality.
 *
 * Responsibilities:
 * - Enter/exit edit mode on double-click
 * - Create and manage control points (anchors, handles)
 * - Handle node manipulation (move, delete, insert)
 * - Generate ghost path for editing preview
 * - Regenerate SVG path from nodes
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 *
 * Note: This is a complex hook that handles the core path editing logic.
 * For the full implementation with all features (ghost hover, node insertion, etc.),
 * see the original FabricCanvas.tsx implementation.
 */
export function useCanvasPathEdit(): PathEditRefs {
  const setEditingPath = useEditorStore((s) => s.setEditingPath)

  // Refs for path editing state
  const editingPathRef = useRef<Path | null>(null)
  const controlsRef = useRef<FabricObject[]>([])
  const clearControlsRef = useRef<(() => void) | null>(null)
  const editModeEntryNodesRef = useRef<{
    nodes: PathNode[]
    closed: boolean
  } | null>(null)

  // Create control point helper
  const createControl = useCallback(
    (
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
    },
    []
  )

  // Regenerate path from nodes
  const regeneratePath = useCallback(() => {
    if (!editingPathRef.current) return

    const pathObj = editingPathRef.current as EditablePath
    if (!pathObj.customPathData) {
      console.warn("No customPathData found on path object")
      return
    }

    const newCommands = nodesToSvgPath(pathObj.customPathData)
    pathObj.set({ path: newCommands })
    pathObj.setCoords()
    pathObj.dirty = true
  }, [])

  useEffect(() => {
    const canvas = useEditorStore.getState().canvas
    if (!canvas) return

    // Remove control visuals from canvas
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

    // Clear controls and exit edit mode
    const clearControls = () => {
      setEditingPath(null)
      removeControlsVisuals()

      // Restore selection globally
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

        // Get world position before recreation
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

        // Copy customPathData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((oldPath as any).customPathData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(newPath as any).customPathData = (oldPath as any).customPathData
        }

        // Adjust position
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

    // Expose clearControls
    clearControlsRef.current = clearControls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(canvas as any).exitEditMode = clearControls

    // Enter edit mode
    const enterEditMode = (pathObj: Path) => {
      const pathWithData = pathObj as EditablePath

      // Initialize customPathData if not exists
      if (!pathWithData.customPathData) {
        console.log("[Path Edit] Converting SVG Path to nodes...")

        // Normalize path (convert L to C commands)
        const rawCmds = pathObj.path as PathCommand[]
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
              const x = cmd[1] as number
              const y = cmd[2] as number
              newCmds.push(["C", lx, ly, x, y, x, y])
              lx = x
              ly = y
            } else if (cmd[0] === "C") {
              lx = cmd[5] as number
              ly = cmd[6] as number
              newCmds.push(cmd)
            } else if (cmd[0] === "Q") {
              const cx = cmd[1] as number
              const cy = cmd[2] as number
              const x = cmd[3] as number
              const y = cmd[4] as number
              const cp1x = lx + (2 / 3) * (cx - lx)
              const cp1y = ly + (2 / 3) * (cy - ly)
              const cp2x = x + (2 / 3) * (cx - x)
              const cp2y = y + (2 / 3) * (cy - y)
              newCmds.push(["C", cp1x, cp1y, cp2x, cp2y, x, y])
              lx = x
              ly = y
            } else if (cmd[0] === "Z" || cmd[0] === "z") {
              if (Math.hypot(lx - sx, ly - sy) > 0.01) {
                newCmds.push(["C", lx, ly, sx, sy, sx, sy])
              }
              newCmds.push(cmd)
              lx = sx
              ly = sy
            } else {
              newCmds.push(cmd)
            }
          })

          pathObj.set({ path: newCmds })
        }

        // Convert to node-centric data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pathWithData.customPathData = svgPathToNodes(pathObj as any)
      }

      // Store entry state
      editModeEntryNodesRef.current = {
        nodes: JSON.parse(JSON.stringify(pathWithData.customPathData.nodes)),
        closed: pathWithData.customPathData.closed,
      }

      editingPathRef.current = pathObj
      setEditingPath(pathObj)

      // Disable selection during edit mode
      canvas.selection = false
      canvas.forEachObject((o) => {
        if (o !== pathObj) {
          o.selectable = false
          o.evented = false
        }
      })
      pathObj.selectable = false
      pathObj.evented = true

      // Save original stroke for highlighting
      pathWithData._originalStroke = pathObj.stroke
      pathWithData._originalStrokeWidth = pathObj.strokeWidth

      // Create control points
      const { customPathData } = pathWithData
      const { nodes } = customPathData
      const matrix = pathObj.calcTransformMatrix()
      const offset = pathObj.pathOffset || { x: 0, y: 0 }

      nodes.forEach((node, nodeIndex) => {
        const localAnchor = new Point(
          node.anchor.x - offset.x,
          node.anchor.y - offset.y
        )
        const worldAnchor = localAnchor.transform(matrix)

        // Create anchor control
        const anchor = createControl(
          worldAnchor.x,
          worldAnchor.y,
          "anchor",
          nodeIndex,
          node.mode
        )
        canvas.add(anchor)
        controlsRef.current.push(anchor)

        // Create handle controls if not collapsed
        const isHandleInCollapsed =
          Math.abs(node.handleIn.x - node.anchor.x) < 0.01 &&
          Math.abs(node.handleIn.y - node.anchor.y) < 0.01

        const isHandleOutCollapsed =
          Math.abs(node.handleOut.x - node.anchor.x) < 0.01 &&
          Math.abs(node.handleOut.y - node.anchor.y) < 0.01

        if (!isHandleInCollapsed) {
          const localHandleIn = new Point(
            node.handleIn.x - offset.x,
            node.handleIn.y - offset.y
          )
          const worldHandleIn = localHandleIn.transform(matrix)

          const handleInLine = new Line(
            [worldAnchor.x, worldAnchor.y, worldHandleIn.x, worldHandleIn.y],
            {
              stroke: "#0000ff",
              strokeWidth: 1 / (canvas.getZoom() || 1),
              selectable: false,
              evented: false,
              excludeFromExport: true,
            }
          )
          canvas.add(handleInLine)
          controlsRef.current.push(handleInLine)

          const handleIn = createControl(
            worldHandleIn.x,
            worldHandleIn.y,
            "handle_in",
            nodeIndex,
            node.mode
          )
          handleIn.line = handleInLine
          canvas.add(handleIn)
          controlsRef.current.push(handleIn)
        }

        if (!isHandleOutCollapsed) {
          const localHandleOut = new Point(
            node.handleOut.x - offset.x,
            node.handleOut.y - offset.y
          )
          const worldHandleOut = localHandleOut.transform(matrix)

          const handleOutLine = new Line(
            [worldAnchor.x, worldAnchor.y, worldHandleOut.x, worldHandleOut.y],
            {
              stroke: "#0000ff",
              strokeWidth: 1 / (canvas.getZoom() || 1),
              selectable: false,
              evented: false,
              excludeFromExport: true,
            }
          )
          canvas.add(handleOutLine)
          controlsRef.current.push(handleOutLine)

          const handleOut = createControl(
            worldHandleOut.x,
            worldHandleOut.y,
            "handle_out",
            nodeIndex,
            node.mode
          )
          handleOut.line = handleOutLine
          canvas.add(handleOut)
          controlsRef.current.push(handleOut)
        }
      })

      canvas.requestRenderAll()
    }

    // Double-click handler to enter/exit edit mode
    const handleDoubleClick = (e: { target?: FabricObject }) => {
      const target = e.target

      // If clicking on a control point, ignore
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (target && (target as any).data?.type) {
        return
      }

      // If already in edit mode and clicked elsewhere, exit
      if (editingPathRef.current && target !== editingPathRef.current) {
        clearControls()
        return
      }

      // If clicked on a path, enter edit mode
      if (target && target.type === "path") {
        enterEditMode(target as Path)
      }
    }

    // Control point movement
    const handleObjectMoving = (e: { target?: FabricObject }) => {
      const target = e.target as ControlPoint
      if (!target?.data || !editingPathRef.current) return

      const pathObj = editingPathRef.current as EditablePath
      if (!pathObj.customPathData) return

      const { type, nodeIndex } = target.data
      const node = pathObj.customPathData.nodes[nodeIndex]
      if (!node) return

      // Transform world coordinates back to local
      const matrix = pathObj.calcTransformMatrix()
      const invMatrix = matrix.slice() as number[]
      // Invert 2x3 matrix manually
      const det = matrix[0] * matrix[3] - matrix[1] * matrix[2]
      invMatrix[0] = matrix[3] / det
      invMatrix[1] = -matrix[1] / det
      invMatrix[2] = -matrix[2] / det
      invMatrix[3] = matrix[0] / det
      invMatrix[4] = (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / det
      invMatrix[5] = (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / det

      const offset = pathObj.pathOffset || { x: 0, y: 0 }
      const worldPt = new Point(target.left!, target.top!)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localPt = worldPt.transform(invMatrix as any)
      const pathPt = { x: localPt.x + offset.x, y: localPt.y + offset.y }

      if (type === "anchor") {
        // Move anchor and its handles together
        const dx = pathPt.x - node.anchor.x
        const dy = pathPt.y - node.anchor.y
        node.anchor.x = pathPt.x
        node.anchor.y = pathPt.y
        node.handleIn.x += dx
        node.handleIn.y += dy
        node.handleOut.x += dx
        node.handleOut.y += dy
      } else if (type === "handle_in") {
        node.handleIn.x = pathPt.x
        node.handleIn.y = pathPt.y

        // Mirror handle if mirrored mode
        if (node.mode === "mirrored") {
          const dx = node.anchor.x - pathPt.x
          const dy = node.anchor.y - pathPt.y
          node.handleOut.x = node.anchor.x + dx
          node.handleOut.y = node.anchor.y + dy
        }
      } else if (type === "handle_out") {
        node.handleOut.x = pathPt.x
        node.handleOut.y = pathPt.y

        // Mirror handle if mirrored mode
        if (node.mode === "mirrored") {
          const dx = node.anchor.x - pathPt.x
          const dy = node.anchor.y - pathPt.y
          node.handleIn.x = node.anchor.x + dx
          node.handleIn.y = node.anchor.y + dy
        }
      }

      regeneratePath()
      canvas.requestRenderAll()
    }

    canvas.on("mouse:dblclick", handleDoubleClick)
    canvas.on("object:moving", handleObjectMoving)

    return () => {
      canvas.off("mouse:dblclick", handleDoubleClick)
      canvas.off("object:moving", handleObjectMoving)
    }
  }, [setEditingPath, createControl, regeneratePath])

  return {
    editingPathRef,
    controlsRef,
    clearControlsRef,
  }
}
