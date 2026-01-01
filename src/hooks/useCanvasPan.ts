"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

export function useCanvasPan(scrollAreaRef: React.RefObject<HTMLDivElement>) {
  const { isPanning, setIsPanning, setScrollPosition } = useEditorStore()

  const dragStartRef = useRef<{
    x: number
    y: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)

  // Initialize scroll to center on mount
  const initializeScrollPosition = useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    // Center the scroll position
    const scrollLeft = (scrollArea.scrollWidth - scrollArea.clientWidth) / 2
    const scrollTop = (scrollArea.scrollHeight - scrollArea.clientHeight) / 2

    scrollArea.scrollLeft = scrollLeft
    scrollArea.scrollTop = scrollTop

    setScrollPosition({ x: scrollLeft, y: scrollTop })
  }, [scrollAreaRef, setScrollPosition])

  // Handle middle mouse button down
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Middle mouse button (button === 1)
      if (e.button !== 1) return

      e.preventDefault()
      const scrollArea = scrollAreaRef.current
      if (!scrollArea) return

      setIsPanning(true)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: scrollArea.scrollLeft,
        scrollTop: scrollArea.scrollTop,
      }
    },
    [scrollAreaRef, setIsPanning]
  )

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const scrollArea = scrollAreaRef.current
      if (!scrollArea) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      scrollArea.scrollLeft = dragStartRef.current.scrollLeft - deltaX
      scrollArea.scrollTop = dragStartRef.current.scrollTop - deltaY
    },
    [scrollAreaRef]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!dragStartRef.current) return

    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      setScrollPosition({
        x: scrollArea.scrollLeft,
        y: scrollArea.scrollTop,
      })
    }

    dragStartRef.current = null
    setIsPanning(false)
  }, [scrollAreaRef, setIsPanning, setScrollPosition])

  // Handle scroll event to update position
  const handleScroll = useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea || dragStartRef.current) return

    setScrollPosition({
      x: scrollArea.scrollLeft,
      y: scrollArea.scrollTop,
    })
  }, [scrollAreaRef, setScrollPosition])

  // Attach event listeners
  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    // Mouse events for panning
    scrollArea.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    scrollArea.addEventListener("scroll", handleScroll)

    // Prevent default middle-click behavior (auto-scroll)
    const preventMiddleClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
      }
    }
    scrollArea.addEventListener("auxclick", preventMiddleClick)

    return () => {
      scrollArea.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      scrollArea.removeEventListener("scroll", handleScroll)
      scrollArea.removeEventListener("auxclick", preventMiddleClick)
    }
  }, [
    scrollAreaRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleScroll,
  ])

  return {
    isPanning,
    initializeScrollPosition,
  }
}
