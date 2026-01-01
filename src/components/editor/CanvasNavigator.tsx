"use client"

import { useCallback, useRef } from "react"

interface CanvasNavigatorProps {
  canvasWidth: number
  canvasHeight: number
  zoom: number
  containerWidth: number
  containerHeight: number
  scrollLeft: number // Actually panX (from viewportTransform)
  scrollTop: number // Actually panY (from viewportTransform)
  onNavigate: (panX: number, panY: number) => void
}

const NAVIGATOR_MAX_WIDTH = 150
const NAVIGATOR_MAX_HEIGHT = 100

/**
 * Mini-map navigator for canvas panning.
 * Works with Fabric.js viewportTransform for pan position.
 */
export default function CanvasNavigator({
  canvasWidth,
  canvasHeight,
  zoom,
  containerWidth,
  containerHeight,
  scrollLeft,
  scrollTop,
  onNavigate,
}: CanvasNavigatorProps) {
  const navigatorRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Calculate scaled canvas dimensions
  const scaledCanvasWidth = canvasWidth * zoom
  const scaledCanvasHeight = canvasHeight * zoom

  // Total navigable area - canvas size scaled plus some padding for movement
  // This represents the virtual space the canvas can move within
  const padding = Math.max(containerWidth, containerHeight)
  const totalWidth = scaledCanvasWidth + padding * 2
  const totalHeight = scaledCanvasHeight + padding * 2

  // Calculate navigator display dimensions (maintain aspect ratio)
  const aspectRatio = totalWidth / totalHeight
  let navigatorWidth = NAVIGATOR_MAX_WIDTH
  let navigatorHeight = navigatorWidth / aspectRatio

  if (navigatorHeight > NAVIGATOR_MAX_HEIGHT) {
    navigatorHeight = NAVIGATOR_MAX_HEIGHT
    navigatorWidth = navigatorHeight * aspectRatio
  }

  // Scale factor from real coordinates to navigator coordinates
  const scaleX = navigatorWidth / totalWidth
  const scaleY = navigatorHeight / totalHeight

  // Canvas rectangle position in navigator (centered in the navigable area)
  const canvasRectX = padding * scaleX
  const canvasRectY = padding * scaleY
  const canvasRectWidth = scaledCanvasWidth * scaleX
  const canvasRectHeight = scaledCanvasHeight * scaleY

  // Viewport rectangle position in navigator
  // scrollLeft/scrollTop represent the negative of viewportTransform[4,5]
  // When pan is 0, viewport is at the center offset
  const viewportOffsetX = (padding - scrollLeft) * scaleX
  const viewportOffsetY = (padding - scrollTop) * scaleY
  const viewportWidth = Math.min(containerWidth, totalWidth) * scaleX
  const viewportHeight = Math.min(containerHeight, totalHeight) * scaleY

  // Handle click/drag on navigator to move viewport
  const handleNavigatorInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const navigator = navigatorRef.current
      if (!navigator) return

      const rect = navigator.getBoundingClientRect()
      const clickX = clientX - rect.left
      const clickY = clientY - rect.top

      // Convert click position to pan values
      // Center the viewport on the clicked point
      const targetPanX =
        clickX / scaleX - padding - containerWidth / 2 + scaledCanvasWidth / 2
      const targetPanY =
        clickY / scaleY - padding - containerHeight / 2 + scaledCanvasHeight / 2

      onNavigate(targetPanX, targetPanY)
    },
    [
      scaleX,
      scaleY,
      padding,
      containerWidth,
      containerHeight,
      scaledCanvasWidth,
      scaledCanvasHeight,
      onNavigate,
    ]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true
      handleNavigatorInteraction(e.clientX, e.clientY)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (isDraggingRef.current) {
          handleNavigatorInteraction(moveEvent.clientX, moveEvent.clientY)
        }
      }

      const handleMouseUp = () => {
        isDraggingRef.current = false
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    },
    [handleNavigatorInteraction]
  )

  return (
    <div
      ref={navigatorRef}
      className="bg-background/90 absolute right-4 bottom-4 z-30 cursor-pointer overflow-hidden rounded-md border shadow-lg backdrop-blur-sm"
      style={{
        width: navigatorWidth,
        height: navigatorHeight,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: `${navigatorWidth / 8}px ${navigatorHeight / 8}px`,
        }}
      />

      {/* Canvas area indicator */}
      <div
        className="border-primary/50 bg-primary/10 absolute border"
        style={{
          left: canvasRectX,
          top: canvasRectY,
          width: canvasRectWidth,
          height: canvasRectHeight,
        }}
      />

      {/* Viewport indicator */}
      <div
        className="border-primary bg-primary/20 absolute border-2"
        style={{
          left: viewportOffsetX,
          top: viewportOffsetY,
          width: viewportWidth,
          height: viewportHeight,
        }}
      />
    </div>
  )
}
