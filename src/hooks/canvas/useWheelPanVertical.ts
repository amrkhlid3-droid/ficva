"use client"

import { useCallback, useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * useWheelPanVertical - 滚轮纵向平移模块（可插拔）
 *
 * 行为：
 * - 滚轮向上：向上平移（无修饰键）
 * - 滚轮向下：向下平移（无修饰键）
 * - 只在 workspace 超出视口时生效（考虑 40px padding）
 *
 * 启用：useWheelPanVertical(containerRef)
 * 禁用：注释掉调用
 *
 * @param containerRef - 画布容器的 DOM 引用
 */
export function useWheelPanVertical(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const handleWheel = useCallback((e: WheelEvent) => {
    // 只响应无修饰键的滚轮
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return

    const { canvas, canvasContainerSize, logicalCanvasSize, zoom } =
      useEditorStore.getState()
    if (!canvas || !canvasContainerSize) return

    // 检查 workspace 是否超出视口（纵向）
    // 考虑 40px padding，所以使用 canvasContainerSize.height - 80
    const workspaceHeight = logicalCanvasSize.height * zoom
    const availableHeight = canvasContainerSize.height - 80
    if (workspaceHeight <= availableHeight) return

    e.preventDefault()

    // 平移
    const vpt = canvas.viewportTransform
    if (vpt) {
      vpt[5] -= e.deltaY // 纵向平移
      canvas.setViewportTransform(vpt)
      canvas.requestRenderAll()
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [containerRef, handleWheel])
}
