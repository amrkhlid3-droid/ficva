"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * Hook for canvas panning using Fabric.js viewportTransform.
 *
 * Supports two panning methods:
 * 1. Middle mouse button drag
 * 2. Alt + left mouse button drag
 *
 * Uses viewportTransform[4] (panX) and viewportTransform[5] (panY) for panning,
 * which works seamlessly with Fabric.js native zoom.
 */
export function useCanvasPan() {
  const { canvas, isPanning, setIsPanning, setScrollPosition } =
    useEditorStore()

  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const listenersAttachedRef = useRef(false)

  // Update store scroll position from viewportTransform
  const syncScrollPosition = useCallback(() => {
    const { canvas: currentCanvas } = useEditorStore.getState()
    if (!currentCanvas) return

    const vpt = currentCanvas.viewportTransform
    if (vpt) {
      setScrollPosition({ x: -vpt[4], y: -vpt[5] })
    }
  }, [setScrollPosition])

  useEffect(() => {
    if (!canvas) return

    // Try to get the lower canvas element - if DOM isn't ready, this will fail
    // In Fabric.js v7, lowerCanvasEl is a getter that accesses internal DOM manager
    let canvasElement: HTMLCanvasElement | null = null
    try {
      // Access the lower canvas element directly
      canvasElement = canvas.lowerCanvasEl
    } catch {
      // DOM not ready yet
    }

    // If we can't get the canvas element, wait for the first render
    if (!canvasElement) {
      const handleAfterRender = () => {
        // Re-run this effect after first render
        canvas.off("after:render", handleAfterRender)
        // Force re-evaluation by triggering a state update
        setIsPanning(false)
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
      // Middle mouse button (button === 1) OR Alt + left mouse button
      const isMiddleButton = e.button === 1
      const isAltLeftButton = e.altKey && e.button === 0

      if (!isMiddleButton && !isAltLeftButton) return

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

      // Sync scroll position to store
      syncScrollPosition()
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
  }, [canvas, setIsPanning, syncScrollPosition])

  return {
    isPanning,
  }
}
