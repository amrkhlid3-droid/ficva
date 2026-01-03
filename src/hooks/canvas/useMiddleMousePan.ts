"use client"

import { useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * useMiddleMousePan - 鼠标中键拖拽平移模块（可插拔）
 *
 * 行为：
 * - 按住中键拖拽：平移画布
 * - 松开中键：停止平移
 *
 * 注意：不支持 Alt+左键（已移除）
 *
 * 启用：useMiddleMousePan()
 * 禁用：注释掉调用
 */
export function useMiddleMousePan() {
  const canvas = useEditorStore((s) => s.canvas)
  const setIsPanning = useEditorStore((s) => s.setIsPanning)
  const isPanning = useEditorStore((s) => s.isPanning)

  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const listenersAttachedRef = useRef(false)

  useEffect(() => {
    if (!canvas) return

    // Try to get the lower canvas element
    let canvasElement: HTMLCanvasElement | null = null
    try {
      canvasElement = canvas.lowerCanvasEl
    } catch {
      // DOM not ready yet
    }

    if (!canvasElement) {
      // Wait for first render
      const handleAfterRender = () => {
        canvas.off("after:render", handleAfterRender)
        setIsPanning(false) // Force re-evaluation
      }
      canvas.on("after:render", handleAfterRender)
      return () => {
        canvas.off("after:render", handleAfterRender)
      }
    }

    const canvasWrapper = canvasElement.parentElement
    if (!canvasWrapper) return

    // Prevent duplicate listener attachment
    if (listenersAttachedRef.current) return
    listenersAttachedRef.current = true

    const handleMouseDown = (e: MouseEvent) => {
      // 只响应中键（button === 1），不支持 Alt+左键
      if (e.button !== 1) return

      e.preventDefault()
      e.stopPropagation()

      isDraggingRef.current = true
      lastPosRef.current = { x: e.clientX, y: e.clientY }

      // Disable object selection while panning
      canvas.selection = false
      setIsPanning(true)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return

      const deltaX = e.clientX - lastPosRef.current.x
      const deltaY = e.clientY - lastPosRef.current.y

      // Update viewport transform for panning
      const vpt = canvas.viewportTransform
      if (vpt) {
        vpt[4] += deltaX
        vpt[5] += deltaY
        canvas.setViewportTransform(vpt)
        canvas.requestRenderAll()
      }

      lastPosRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return

      isDraggingRef.current = false
      canvas.selection = true
      setIsPanning(false)
    }

    // Prevent default middle-click behavior (auto-scroll)
    const preventMiddleClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
      }
    }

    // Attach event listeners
    canvasWrapper.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    canvasWrapper.addEventListener("auxclick", preventMiddleClick)

    return () => {
      canvasWrapper.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      canvasWrapper.removeEventListener("auxclick", preventMiddleClick)
      listenersAttachedRef.current = false
    }
  }, [canvas, setIsPanning])

  return {
    isPanning,
  }
}
