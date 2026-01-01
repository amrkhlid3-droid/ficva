"use client"

import { useCallback, useEffect, useRef } from "react"
import { Point } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5.0
const ZOOM_STEP = 0.1

/**
 * Hook for canvas zoom operations using Fabric.js native zoom API.
 *
 * Uses canvas.setZoom() and canvas.zoomToPoint() for high-quality vector rendering
 * instead of CSS transform which causes blurry graphics at high zoom levels.
 */
export function useCanvasZoom(containerRef: React.RefObject<HTMLDivElement>) {
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

  const initialFitDoneRef = useRef(false)

  /**
   * Center the canvas in the viewport at the given zoom level.
   * Uses logicalCanvasSize for the content dimensions.
   */
  const centerCanvas = useCallback((zoomLevel: number) => {
    const {
      canvas: currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
    } = useEditorStore.getState()
    if (!currentCanvas || !canvasContainerSize) return

    const canvasWidth = logicalCanvasSize.width
    const canvasHeight = logicalCanvasSize.height

    // Calculate center position so canvas is centered in container
    const centerX = (canvasContainerSize.width - canvasWidth * zoomLevel) / 2
    const centerY = (canvasContainerSize.height - canvasHeight * zoomLevel) / 2

    // Set viewport transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
    currentCanvas.setViewportTransform([
      zoomLevel,
      0,
      0,
      zoomLevel,
      centerX,
      centerY,
    ])
    currentCanvas.requestRenderAll()
  }, [])

  /**
   * Handle wheel zoom (Ctrl/Cmd + scroll) - centers on mouse position.
   * Uses Fabric.js zoomToPoint to keep mouse position stable during zoom.
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return

      e.preventDefault()

      const { zoom: currentZoom, canvas: currentCanvas } =
        useEditorStore.getState()
      if (!currentCanvas) return

      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom + delta)
      )

      if (newZoom === currentZoom) return

      // Get mouse position relative to canvas element
      const canvasElement = currentCanvas.getElement()
      const rect = canvasElement.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Use Fabric.js zoomToPoint to zoom centered on mouse position
      const point = new Point(mouseX, mouseY)
      currentCanvas.zoomToPoint(point, newZoom)

      applyZoom(newZoom)
      setZoomMode("custom")
    },
    [applyZoom, setZoomMode]
  )

  // Attach wheel event listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [containerRef, handleWheel])

  /**
   * Zoom to fit the canvas within the container with padding.
   * Centers the canvas after fitting.
   */
  const zoomToFitAndCenter = useCallback(() => {
    const {
      canvas: currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
    } = useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

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

    // Center the canvas at the fit zoom level
    centerCanvas(fitZoom)
  }, [applyZoom, setZoomMode, centerCanvas])

  /**
   * Zoom to a specific level and center the canvas.
   * Used for zoom slider and preset zoom levels (100%, etc.)
   */
  const centerAndZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))

      applyZoom(clampedZoom)
      setZoomMode("custom")

      // Center the canvas at the new zoom level
      centerCanvas(clampedZoom)
    },
    [applyZoom, setZoomMode, centerCanvas]
  )

  /**
   * Handle keyboard shortcuts for zoom
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // Ctrl/Cmd + Plus: Zoom In
      if (isCtrlOrMeta && (e.key === "+" || e.key === "=")) {
        e.preventDefault()
        const { zoom: currentZoom } = useEditorStore.getState()
        const newZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP)
        centerAndZoom(newZoom)
      }

      // Ctrl/Cmd + Minus: Zoom Out
      if (isCtrlOrMeta && e.key === "-") {
        e.preventDefault()
        const { zoom: currentZoom } = useEditorStore.getState()
        const newZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP)
        centerAndZoom(newZoom)
      }

      // Ctrl/Cmd + 0: Fit to screen
      if (isCtrlOrMeta && e.key === "0") {
        e.preventDefault()
        zoomToFitAndCenter()
      }

      // Ctrl/Cmd + 1: Reset to 100%
      if (isCtrlOrMeta && e.key === "1") {
        e.preventDefault()
        centerAndZoom(1.0)
      }
    },
    [zoomToFitAndCenter, centerAndZoom]
  )

  // Attach keyboard event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  // Update container size on mount and resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      // Skip if container has no size yet
      if (rect.width === 0 || rect.height === 0) return

      setCanvasContainerSize({ width: rect.width, height: rect.height })

      const {
        canvas: currentCanvas,
        zoom: currentZoom,
        zoomMode: currentZoomMode,
      } = useEditorStore.getState()

      // Resize canvas element to match container (only if canvas is ready)
      if (currentCanvas) {
        try {
          currentCanvas.setDimensions({
            width: rect.width,
            height: rect.height,
          })
        } catch {
          // Canvas not fully initialized yet, skip resize
          console.log("[useCanvasZoom] Canvas not ready for resize, skipping")
        }
      }

      // If in fit mode, recalculate zoom on resize
      if (currentZoomMode === "fit" && initialFitDoneRef.current) {
        // Defer to next tick to ensure size is updated
        setTimeout(() => {
          zoomToFitAndCenter()
        }, 0)
      } else if (initialFitDoneRef.current) {
        // Re-center at current zoom
        centerCanvas(currentZoom)
      }
    }

    // Initial size
    updateSize()

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateSize()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef, setCanvasContainerSize, zoomToFitAndCenter, centerCanvas])

  // Auto-fit on initial load
  useEffect(() => {
    const { canvasContainerSize: containerSize } = useEditorStore.getState()
    if (!canvas || !containerSize) return undefined

    // Initial fit on first load
    if (!initialFitDoneRef.current) {
      // Small delay to ensure canvas is fully initialized
      const timer = setTimeout(() => {
        zoomToFitAndCenter()
        initialFitDoneRef.current = true
      }, 100)
      return () => clearTimeout(timer)
    }

    return undefined
  }, [canvas, zoomToFitAndCenter])

  return {
    zoom,
    zoomMode,
    zoomIn,
    zoomOut,
    zoomToFit: zoomToFitAndCenter,
    setZoom: (newZoom: number) => {
      applyZoom(newZoom)
      setZoomMode("custom")
    },
    centerAndZoom,
    resetZoom: () => {
      centerAndZoom(1.0)
    },
  }
}
