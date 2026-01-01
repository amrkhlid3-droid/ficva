"use client"

import { useCallback, useRef } from "react"

interface CanvasNavigatorProps {
  canvasWidth: number
  canvasHeight: number
  zoom: number
  containerWidth: number
  containerHeight: number
  scrollLeft: number
  scrollTop: number
  scrollAreaWidth: number
  scrollAreaHeight: number
  onNavigate: (x: number, y: number) => void
}

const NAVIGATOR_MAX_WIDTH = 150
const NAVIGATOR_MAX_HEIGHT = 100

export default function CanvasNavigator({
  canvasWidth,
  canvasHeight,
  zoom,
  containerWidth,
  containerHeight,
  scrollLeft,
  scrollTop,
  scrollAreaWidth,
  scrollAreaHeight,
  onNavigate,
}: CanvasNavigatorProps) {
  const navigatorRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Calculate scaled canvas dimensions
  const scaledCanvasWidth = canvasWidth * zoom
  const scaledCanvasHeight = canvasHeight * zoom

  // Use the actual scroll area dimensions passed from parent
  const totalWidth = scrollAreaWidth
  const totalHeight = scrollAreaHeight

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

  // Canvas rectangle in navigator (centered)
  const canvasRectX = ((totalWidth - scaledCanvasWidth) / 2) * scaleX
  const canvasRectY = ((totalHeight - scaledCanvasHeight) / 2) * scaleY
  const canvasRectWidth = scaledCanvasWidth * scaleX
  const canvasRectHeight = scaledCanvasHeight * scaleY

  // Viewport rectangle in navigator
  const viewportX = scrollLeft * scaleX
  const viewportY = scrollTop * scaleY
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

      // Convert to scroll position (center viewport on click point)
      const newScrollLeft = clickX / scaleX - containerWidth / 2
      const newScrollTop = clickY / scaleY - containerHeight / 2

      // Clamp to valid range
      const maxScrollLeft = totalWidth - containerWidth
      const maxScrollTop = totalHeight - containerHeight

      onNavigate(
        Math.max(0, Math.min(maxScrollLeft, newScrollLeft)),
        Math.max(0, Math.min(maxScrollTop, newScrollTop))
      )
    },
    [
      scaleX,
      scaleY,
      containerWidth,
      containerHeight,
      totalWidth,
      totalHeight,
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
          left: viewportX,
          top: viewportY,
          width: viewportWidth,
          height: viewportHeight,
        }}
      />
    </div>
  )
}
