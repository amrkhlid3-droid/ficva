"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import {
  MIN_ZOOM,
  MAX_ZOOM,
  calculateFitZoom,
  centerWorkspace,
  centerSelection,
  clampZoom,
} from "@/lib/editor/utils/canvasViewport"
import { findWorkspace } from "@/lib/editor/workspace"

/**
 * useCanvasZoom - 画布缩放与视口管理 Hook（核心模块）
 *
 * 【核心职责】
 * 1. 监听容器尺寸变化并调整画布
 * 2. 首次加载时自动居中并适应屏幕
 * 3. 提供缩放 API 供 ZoomControls 和其他模块使用
 *
 * 【已移除的功能（已拆分到独立模块）】
 * - 键盘快捷键（Shift+1/2/3）→ useZoomShortcuts
 * - 滚轮缩放（Ctrl+滚轮）→ useWheelZoom
 *
 * 【为什么使用 Fabric.js 原生缩放 API？】
 * 有两种实现缩放的方式：
 *
 * 方式 1：CSS transform（不推荐）
 * - 用 CSS scale() 缩放整个 canvas 容器
 * - 问题：放大时图形会模糊，因为 canvas 的实际像素没变
 *
 * 方式 2：Fabric.js 原生 API（推荐，当前使用）
 * - 使用 canvas.setViewportTransform() 和 canvas.zoomToPoint()
 * - 优点：矢量图形在任何缩放级别都保持清晰
 * - Fabric 会在正确的缩放级别重新渲染所有对象
 *
 * @param containerRef - 画布容器的 DOM 引用，用于绑定事件和获取尺寸
 */
export function useCanvasZoom(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const {
    canvas,
    zoom,
    zoomMode,
    setZoomMode,
    setCanvasContainerSize,
    zoomIn,
    zoomOut,
    applyZoom,
  } = useEditorStore()

  /**
   * 追踪是否已完成首次适应
   */
  const initialFitDoneRef = useRef(false)

  /**
   * 将 workspace 居中到视口中央
   */
  const centerCanvasAtWorkspace = useCallback((zoomLevel: number) => {
    const {
      canvas: currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
    } = useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

    const workspace = findWorkspace(currentCanvas)
    const workspacePosition = workspace
      ? { left: workspace.left ?? 0, top: workspace.top ?? 0 }
      : { left: 0, top: 0 }

    centerWorkspace(
      currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
      zoomLevel,
      workspacePosition
    )
  }, [])

  /**
   * 自适应缩放并居中（Fit 模式）
   */
  const zoomToFitAndCenter = useCallback(() => {
    const {
      canvas: currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
    } = useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

    try {
      currentCanvas.getElement()
    } catch {
      return
    }

    const canvasWidth = logicalCanvasSize.width
    const canvasHeight = logicalCanvasSize.height
    const padding = 40

    const availableWidth = canvasContainerSize.width - padding * 2
    const availableHeight = canvasContainerSize.height - padding * 2

    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight

    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(scaleX, scaleY))
    )

    applyZoom(fitZoom)
    setZoomMode("fit")
    centerCanvasAtWorkspace(fitZoom)
  }, [applyZoom, setZoomMode, centerCanvasAtWorkspace])

  /**
   * 缩放到指定级别并居中（workspace 居中）
   */
  const centerAndZoom = useCallback(
    (newZoom: number, mode: "fit" | "100%" | "focus" | "custom" = "custom") => {
      const clampedZoom = clampZoom(newZoom)

      applyZoom(clampedZoom)
      setZoomMode(mode)
      centerCanvasAtWorkspace(clampedZoom)
    },
    [applyZoom, setZoomMode, centerCanvasAtWorkspace]
  )

  /**
   * 100% 缩放模式
   */
  const zoomTo100 = useCallback(() => {
    centerAndZoom(1.0, "100%")
  }, [centerAndZoom])

  /**
   * Focus Selection 模式 - 自适应选中内容到屏幕
   */
  const zoomToSelection = useCallback(() => {
    const { canvas: currentCanvas, canvasContainerSize } =
      useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

    const activeObject = currentCanvas.getActiveObject()
    if (!activeObject) return

    const bounds = activeObject.getBoundingRect()
    const fitZoom = calculateFitZoom(canvasContainerSize, {
      width: bounds.width,
      height: bounds.height,
    })

    applyZoom(fitZoom)
    setZoomMode("focus")
    centerSelection(currentCanvas, canvasContainerSize, bounds, fitZoom)
  }, [applyZoom, setZoomMode])

  /**
   * 监听容器尺寸变化
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let lastWidth = 0
    let lastHeight = 0
    let resizeTimeout: NodeJS.Timeout | null = null

    const updateSize = () => {
      const rect = container.getBoundingClientRect()

      if (rect.width === 0 || rect.height === 0) return
      if (rect.width === lastWidth && rect.height === lastHeight) return

      lastWidth = rect.width
      lastHeight = rect.height

      setCanvasContainerSize({ width: rect.width, height: rect.height })

      const {
        canvas: currentCanvas,
        zoom: currentZoom,
        zoomMode: currentZoomMode,
      } = useEditorStore.getState()

      if (currentCanvas) {
        try {
          currentCanvas.setDimensions({
            width: rect.width,
            height: rect.height,
          })
        } catch {
          // Canvas 可能还没初始化完成或已被销毁
        }
      }

      if (currentZoomMode === "fit" && initialFitDoneRef.current) {
        setTimeout(() => {
          zoomToFitAndCenter()
        }, 0)
      } else if (initialFitDoneRef.current) {
        centerCanvasAtWorkspace(currentZoom)
      }
    }

    updateSize()

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateSize, 50)
    })

    resizeObserver.observe(container)

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeObserver.disconnect()
    }
  }, [
    containerRef,
    setCanvasContainerSize,
    zoomToFitAndCenter,
    centerCanvasAtWorkspace,
  ])

  /**
   * 重置 initialFitDoneRef - React 18 严格模式兼容
   */
  useEffect(() => {
    if (!canvas) {
      initialFitDoneRef.current = false
    }
  }, [canvas])

  /**
   * 首次加载时自动适应屏幕
   */
  useEffect(() => {
    const { canvasContainerSize: containerSize } = useEditorStore.getState()

    if (!canvas || !containerSize) return undefined

    if (!initialFitDoneRef.current) {
      const timer = setTimeout(() => {
        zoomToFitAndCenter()
        initialFitDoneRef.current = true
      }, 100)

      return () => {
        clearTimeout(timer)
      }
    }

    return undefined
  }, [canvas, zoomToFitAndCenter])

  /**
   * 返回缩放相关的状态和方法
   */
  return {
    /** 当前缩放级别 (0.1 - 50.0) */
    zoom,
    /** 当前缩放模式 ("fit" | "100%" | "focus" | "custom") */
    zoomMode,
    /** 放大一档 */
    zoomIn,
    /** 缩小一档 */
    zoomOut,
    /** Fit 模式：自适应 workspace 到屏幕 */
    zoomToFit: zoomToFitAndCenter,
    /** 100% 缩放并居中 */
    zoomTo100,
    /** Focus 模式：自适应选中内容到屏幕 */
    zoomToSelection,
    /** 设置具体缩放值（不居中） */
    setZoom: (newZoom: number) => {
      applyZoom(newZoom)
      setZoomMode("custom")
    },
    /** 设置具体缩放值并居中 */
    centerAndZoom,
    /** 重置到 100% 并居中 */
    resetZoom: zoomTo100,
  }
}
