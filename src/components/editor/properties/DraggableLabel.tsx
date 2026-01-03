"use client"

/**
 * DraggableLabel - 可拖拽标签组件
 *
 * 类似 Figma 的拖拽调整数值功能：
 * - 拖动标签左右移动可以调整数值
 * - 使用 Pointer Lock API 实现无限拖拽
 * - 显示自定义光标以保持视觉反馈
 * - 光标超出屏幕边界时从另一侧出现（循环）
 * - 支持自定义灵敏度和范围限制
 */

import { useCallback, useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"

interface DraggableLabelProps {
  /** 标签文字 */
  children: React.ReactNode
  /** 当前值 */
  value: number
  /** 值变化回调 */
  onChange: (value: number) => void
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 灵敏度（每移动1像素改变的值），默认 1 */
  sensitivity?: number
  /** 自定义类名 */
  className?: string
}

/** 虚拟光标组件 - 在 Pointer Lock 模式下显示 */
function VirtualCursor({ x, y }: { x: number; y: number }) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: 20,
        height: 20,
        pointerEvents: "none",
        zIndex: 99999,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* 左右箭头光标 SVG */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 白色描边（背景） */}
        <path
          d="M6 10L2 10M2 10L4 8M2 10L4 12"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 10L18 10M18 10L16 8M18 10L16 12"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 6L10 14"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* 黑色前景 */}
        <path
          d="M6 10L2 10M2 10L4 8M2 10L4 12"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 10L18 10M18 10L16 8M18 10L16 12"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 6L10 14"
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    document.body
  )
}

export function DraggableLabel({
  children,
  value,
  onChange,
  min = 0,
  max = 100,
  sensitivity = 1,
  className = "",
}: DraggableLabelProps) {
  const isDraggingRef = useRef(false)
  const startValueRef = useRef(value)
  const accumulatedDeltaRef = useRef(0)

  // 虚拟光标位置
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // 清理函数
  useEffect(() => {
    return () => {
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault()
      isDraggingRef.current = true
      startValueRef.current = value
      accumulatedDeltaRef.current = 0

      // 记录初始光标位置
      const startX = e.clientX
      const startY = e.clientY
      let virtualX = startX
      let virtualY = startY

      setCursorPos({ x: startX, y: startY })
      setIsDragging(true)

      // 请求 Pointer Lock
      const target = e.currentTarget
      target.requestPointerLock()

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return

        // 更新累积值
        accumulatedDeltaRef.current += moveEvent.movementX * sensitivity

        // 计算新值并限制在范围内
        let newValue = startValueRef.current + accumulatedDeltaRef.current
        newValue = Math.round(newValue)
        newValue = Math.max(min, Math.min(max, newValue))
        onChange(newValue)

        // 更新虚拟光标位置（循环）
        virtualX += moveEvent.movementX
        virtualY += moveEvent.movementY

        // 屏幕边界循环
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        const padding = 10

        if (virtualX > screenWidth - padding) {
          virtualX = padding
        } else if (virtualX < padding) {
          virtualX = screenWidth - padding
        }

        if (virtualY > screenHeight - padding) {
          virtualY = padding
        } else if (virtualY < padding) {
          virtualY = screenHeight - padding
        }

        setCursorPos({ x: virtualX, y: virtualY })
      }

      const handlePointerUp = () => {
        isDraggingRef.current = false
        setIsDragging(false)
        document.exitPointerLock()
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
      }

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
    },
    [value, onChange, min, max, sensitivity]
  )

  return (
    <>
      <span
        onPointerDown={handlePointerDown}
        className={`cursor-ew-resize select-none ${className}`}
        title="拖拽调整数值"
      >
        {children}
      </span>
      {isDragging && <VirtualCursor x={cursorPos.x} y={cursorPos.y} />}
    </>
  )
}
