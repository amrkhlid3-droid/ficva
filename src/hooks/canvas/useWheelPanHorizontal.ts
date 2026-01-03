"use client"

import { useCallback, useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * useWheelPanHorizontal - Shift + 滚轮横向平移模块（可插拔）
 *
 * 行为：
 * - Shift + 滚轮向上：向左平移
 * - Shift + 滚轮向下：向右平移
 * - 只在 workspace 超出视口时生效（考虑 40px padding）
 *
 * 启用：useWheelPanHorizontal(containerRef)
 * 禁用：注释掉调用
 *
 * @param containerRef - 画布容器的 DOM 引用
 */
export function useWheelPanHorizontal(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const handleWheel = useCallback((e: WheelEvent) => {
    // 只响应 Shift + 滚轮（不带其他修饰键）
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return

    const { canvas, canvasContainerSize, logicalCanvasSize, zoom } =
      useEditorStore.getState()
    if (!canvas || !canvasContainerSize) return

    // 检查 workspace 是否超出视口（横向）
    // 考虑 40px padding，所以使用 canvasContainerSize.width - 80
    const workspaceWidth = logicalCanvasSize.width * zoom
    const availableWidth = canvasContainerSize.width - 80
    if (workspaceWidth <= availableWidth) return

    e.preventDefault()

    // 平移
    // macOS + Shift 会把 deltaY 转换为 deltaX，所以两者都要检查
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
    const vpt = canvas.viewportTransform
    if (vpt) {
      vpt[4] -= delta // 横向平移
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
