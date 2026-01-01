"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5.0
const ZOOM_STEP = 0.1

export function useCanvasZoom(
  containerRef: React.RefObject<HTMLDivElement>,
  scrollAreaRef?: React.RefObject<HTMLDivElement>
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

  const initialFitDoneRef = useRef(false)

  // Helper function to calculate scroll area dimensions
  const calcScrollAreaSize = useCallback(
    (zoomLevel: number, canvasW: number, canvasH: number) => {
      const { canvasContainerSize } = useEditorStore.getState()
      const containerW = canvasContainerSize?.width || 800
      const containerH = canvasContainerSize?.height || 600
      const scaledW = canvasW * zoomLevel
      const scaledH = canvasH * zoomLevel
      return {
        width: Math.max(containerW, scaledW + containerW),
        height: Math.max(containerH, scaledH + containerH),
        containerW,
        containerH,
        scaledW,
        scaledH,
      }
    },
    []
  )

  // Handle wheel zoom (Ctrl/Cmd + scroll) - centers on mouse position
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return

      e.preventDefault()

      const scrollArea = scrollAreaRef?.current
      if (!scrollArea) return

      const { zoom: currentZoom, canvas: currentCanvas } =
        useEditorStore.getState()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom + delta)
      )

      if (newZoom === currentZoom) return

      // Get canvas dimensions
      const canvasWidth = currentCanvas?.width || 1200
      const canvasHeight = currentCanvas?.height || 800

      // Get mouse position relative to scroll area
      const scrollAreaRect = scrollArea.getBoundingClientRect()
      const mouseX = e.clientX - scrollAreaRect.left
      const mouseY = e.clientY - scrollAreaRect.top

      // Current scroll position
      const scrollLeft = scrollArea.scrollLeft
      const scrollTop = scrollArea.scrollTop

      // Calculate old and new scroll area dimensions
      const oldSize = calcScrollAreaSize(currentZoom, canvasWidth, canvasHeight)
      const newSize = calcScrollAreaSize(newZoom, canvasWidth, canvasHeight)

      // Mouse position in the virtual scroll space (before zoom)
      const virtualX = scrollLeft + mouseX
      const virtualY = scrollTop + mouseY

      // Canvas center position in the old scroll area
      const oldCenterX = oldSize.width / 2
      const oldCenterY = oldSize.height / 2

      // Distance from mouse to canvas center in the old zoom
      const distFromCenterX = virtualX - oldCenterX
      const distFromCenterY = virtualY - oldCenterY

      // Scale this distance by the zoom ratio
      const zoomRatio = newZoom / currentZoom
      const newDistFromCenterX = distFromCenterX * zoomRatio
      const newDistFromCenterY = distFromCenterY * zoomRatio

      // Canvas center position in the new scroll area
      const newCenterX = newSize.width / 2
      const newCenterY = newSize.height / 2

      // New virtual position of the mouse
      const newVirtualX = newCenterX + newDistFromCenterX
      const newVirtualY = newCenterY + newDistFromCenterY

      // New scroll position to keep mouse at same screen position
      const newScrollLeft = newVirtualX - mouseX
      const newScrollTop = newVirtualY - mouseY

      // Apply zoom first
      applyZoom(newZoom)
      setZoomMode("custom")

      // Then adjust scroll position after a microtask to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollArea.scrollLeft = Math.max(
          0,
          Math.min(newSize.width - scrollArea.clientWidth, newScrollLeft)
        )
        scrollArea.scrollTop = Math.max(
          0,
          Math.min(newSize.height - scrollArea.clientHeight, newScrollTop)
        )
      })
    },
    [scrollAreaRef, applyZoom, setZoomMode, calcScrollAreaSize]
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

  // Zoom to fit and center - local implementation that handles scroll positioning
  const zoomToFitAndCenter = useCallback(() => {
    const scrollArea = scrollAreaRef?.current
    const { canvas: currentCanvas, canvasContainerSize } =
      useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

    const canvasWidth = currentCanvas.width || 1200
    const canvasHeight = currentCanvas.height || 800
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

    // Center the scroll position after zoom is applied
    if (scrollArea) {
      requestAnimationFrame(() => {
        const newSize = calcScrollAreaSize(fitZoom, canvasWidth, canvasHeight)
        const newScrollLeft = (newSize.width - scrollArea.clientWidth) / 2
        const newScrollTop = (newSize.height - scrollArea.clientHeight) / 2

        scrollArea.scrollLeft = Math.max(0, newScrollLeft)
        scrollArea.scrollTop = Math.max(0, newScrollTop)
      })
    }
  }, [scrollAreaRef, applyZoom, setZoomMode, calcScrollAreaSize])

  // Center-first zoom for slider and reset - centers the canvas, then applies zoom
  const centerAndZoom = useCallback(
    (newZoom: number) => {
      const scrollArea = scrollAreaRef?.current
      if (!scrollArea) {
        // Fallback: just apply zoom without centering
        applyZoom(newZoom)
        setZoomMode("custom")
        return
      }

      const { canvas: currentCanvas } = useEditorStore.getState()
      const canvasWidth = currentCanvas?.width || 1200
      const canvasHeight = currentCanvas?.height || 800

      // Apply the new zoom
      applyZoom(newZoom)
      setZoomMode("custom")

      // Center the scroll position after zoom is applied
      requestAnimationFrame(() => {
        const newSize = calcScrollAreaSize(newZoom, canvasWidth, canvasHeight)

        // Center the scroll position - canvas is always at center of scroll area
        const newScrollLeft = (newSize.width - scrollArea.clientWidth) / 2
        const newScrollTop = (newSize.height - scrollArea.clientHeight) / 2

        scrollArea.scrollLeft = Math.max(0, newScrollLeft)
        scrollArea.scrollTop = Math.max(0, newScrollTop)
      })
    },
    [scrollAreaRef, applyZoom, setZoomMode, calcScrollAreaSize]
  )

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // Ctrl/Cmd + Plus: Zoom In
      if (isCtrlOrMeta && (e.key === "+" || e.key === "=")) {
        e.preventDefault()
        zoomIn()
      }

      // Ctrl/Cmd + Minus: Zoom Out
      if (isCtrlOrMeta && e.key === "-") {
        e.preventDefault()
        zoomOut()
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
    [zoomIn, zoomOut, zoomToFitAndCenter, centerAndZoom]
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
      setCanvasContainerSize({ width: rect.width, height: rect.height })

      // If in fit mode, recalculate zoom on resize
      const { zoomMode: currentZoomMode } = useEditorStore.getState()
      if (currentZoomMode === "fit" && initialFitDoneRef.current) {
        // Defer to next tick to ensure size is updated
        setTimeout(() => {
          zoomToFitAndCenter()
        }, 0)
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
  }, [containerRef, setCanvasContainerSize, zoomToFitAndCenter])

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
      applyZoom(1.0)
      setZoomMode("custom")
    },
  }
}
