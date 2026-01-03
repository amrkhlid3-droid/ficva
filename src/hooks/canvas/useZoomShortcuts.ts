"use client"

import { useCallback, useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import {
  MIN_ZOOM,
  MAX_ZOOM,
  calculateFitZoom,
  centerWorkspace,
  centerSelection,
} from "@/lib/editor/utils/canvasViewport"
import { findWorkspace } from "@/lib/editor/workspace"

/**
 * useZoomShortcuts - 缩放模式快捷键模块（可插拔）
 *
 * 快捷键：
 * - Shift+1: Fit 模式（自适应 workspace）
 * - Shift+2: 100% 缩放并居中
 * - Shift+3: Focus 模式（自适应选中内容）
 *
 * 启用：useZoomShortcuts()
 * 禁用：注释掉调用
 */
export function useZoomShortcuts() {
  const applyZoom = useEditorStore((s) => s.applyZoom)
  const setZoomMode = useEditorStore((s) => s.setZoomMode)

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

    // 查找 workspace 对象以获取其实际位置
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
   * Shift+1: Fit 模式 - 自适应 workspace 到屏幕
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

    const padding = 40
    const availableWidth = canvasContainerSize.width - padding * 2
    const availableHeight = canvasContainerSize.height - padding * 2

    const scaleX = availableWidth / logicalCanvasSize.width
    const scaleY = availableHeight / logicalCanvasSize.height

    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(scaleX, scaleY))
    )

    applyZoom(fitZoom)
    setZoomMode("fit")
    centerCanvasAtWorkspace(fitZoom)
  }, [applyZoom, setZoomMode, centerCanvasAtWorkspace])

  /**
   * Shift+2: 100% 模式 - 100% 缩放并居中
   */
  const zoomTo100 = useCallback(() => {
    applyZoom(1.0)
    setZoomMode("100%")
    centerCanvasAtWorkspace(1.0)
  }, [applyZoom, setZoomMode, centerCanvasAtWorkspace])

  /**
   * Shift+3: Focus 模式 - 自适应选中内容到屏幕
   */
  const zoomToSelection = useCallback(() => {
    const { canvas: currentCanvas, canvasContainerSize } =
      useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

    const activeObject = currentCanvas.getActiveObject()
    if (!activeObject) return

    // 获取选中对象的边界框
    const bounds = activeObject.getBoundingRect()

    // 计算适应选中内容的缩放比例
    const fitZoom = calculateFitZoom(canvasContainerSize, {
      width: bounds.width,
      height: bounds.height,
    })

    applyZoom(fitZoom)
    setZoomMode("focus")

    // 将选中对象居中
    centerSelection(currentCanvas, canvasContainerSize, bounds, fitZoom)
  }, [applyZoom, setZoomMode])

  /**
   * 处理键盘快捷键
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 只响应 Shift + 数字键，不响应 Ctrl/Cmd
      if (!e.shiftKey || e.ctrlKey || e.metaKey) return

      switch (e.key) {
        case "!": // Shift+1 在某些键盘布局下会变成 !
        case "1":
          e.preventDefault()
          zoomToFitAndCenter()
          break
        case "@": // Shift+2 在某些键盘布局下会变成 @
        case "2":
          e.preventDefault()
          zoomTo100()
          break
        case "#": // Shift+3 在某些键盘布局下会变成 #
        case "3":
          e.preventDefault()
          zoomToSelection()
          break
      }
    },
    [zoomToFitAndCenter, zoomTo100, zoomToSelection]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return {
    zoomToFit: zoomToFitAndCenter,
    zoomTo100,
    zoomToSelection,
  }
}
