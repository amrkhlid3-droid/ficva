"use client"

import { useCallback, useEffect } from "react"
import { Point } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { ZOOM_STEP, clampZoom } from "@/lib/editor/utils/canvasViewport"

/**
 * useWheelZoom - Ctrl + 滚轮缩放模块（可插拔）
 *
 * 行为：
 * - Ctrl + 滚轮向上：放大（以鼠标位置为中心）
 * - Ctrl + 滚轮向下：缩小（以鼠标位置为中心）
 *
 * 注意：只响应 Ctrl，不响应 Cmd（Mac）
 *
 * 启用：useWheelZoom(containerRef)
 * 禁用：注释掉调用
 *
 * @param containerRef - 画布容器的 DOM 引用
 */
export function useWheelZoom(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const applyZoom = useEditorStore((s) => s.applyZoom)
  const setZoomMode = useEditorStore((s) => s.setZoomMode)

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // 只响应 Ctrl，不响应 Cmd (metaKey)
      if (!e.ctrlKey || e.metaKey) return

      e.preventDefault()

      const { zoom: currentZoom, canvas } = useEditorStore.getState()
      if (!canvas) return

      // 计算新缩放值
      // deltaY > 0 表示向下滚动（缩小）
      // deltaY < 0 表示向上滚动（放大）
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZoom = clampZoom(currentZoom + delta)

      if (newZoom === currentZoom) return

      // 获取鼠标相对于 canvas 元素的位置
      const canvasElement = canvas.getElement()
      const rect = canvasElement.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // 以鼠标位置为中心进行缩放
      const point = new Point(mouseX, mouseY)
      canvas.zoomToPoint(point, newZoom)

      applyZoom(newZoom)
      setZoomMode("custom")
    },
    [applyZoom, setZoomMode]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // passive: false 允许调用 preventDefault()
    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [containerRef, handleWheel])
}
