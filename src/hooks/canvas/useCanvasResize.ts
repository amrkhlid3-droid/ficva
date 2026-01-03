"use client"

import { useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"

export interface CanvasResizeOptions {
  /** 容器 DOM 元素的引用 */
  containerRef: React.RefObject<HTMLDivElement>
  /** 防抖延迟（毫秒），默认 50ms */
  debounceMs?: number
}

/**
 * useCanvasResize - Canvas 尺寸自适应 Hook
 *
 * 【核心职责】
 * 1. 监听容器尺寸变化（ResizeObserver）
 * 2. 自动调整 Fabric.js canvas 的渲染尺寸
 * 3. 更新 store 中的 canvasContainerSize
 *
 * 【防止无限循环】
 * 问题：ResizeObserver → setDimensions → 容器高度变化 → ResizeObserver → 无限循环
 *
 * 解决方案（三层防护）：
 * 1. CSS 层面：容器使用 [&>.canvas-container]:absolute!
 *    这是根本解决方案，使 canvas 不影响容器尺寸
 * 2. 代码层面：跟踪 lastWidth/lastHeight，尺寸没变就跳过
 *    作为额外保险，防止不必要的更新
 * 3. 防抖处理：默认 50ms 延迟，合并快速连续的调整
 *
 * 【使用方式】
 * 在 FabricCanvas 组件中：
 * - 需要自适应：useCanvasResize({ containerRef })
 * - 不需要自适应：不调用此 hook
 */
export function useCanvasResize({
  containerRef,
  debounceMs = 1,
}: CanvasResizeOptions) {
  const canvas = useEditorStore((s) => s.canvas)
  const setCanvasContainerSize = useEditorStore((s) => s.setCanvasContainerSize)

  // 跟踪上次尺寸，防止不必要的更新
  const lastSizeRef = useRef({ width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let resizeTimeout: NodeJS.Timeout | null = null

    const updateSize = () => {
      const rect = container.getBoundingClientRect()

      // 容器尚未渲染完成（尺寸为 0），跳过
      if (rect.width === 0 || rect.height === 0) return

      // 尺寸没变就跳过（防止无限循环）
      const { width: lastWidth, height: lastHeight } = lastSizeRef.current
      if (rect.width === lastWidth && rect.height === lastHeight) return

      // 更新记录的尺寸
      lastSizeRef.current = { width: rect.width, height: rect.height }

      // 保存到 store，供其他组件使用
      setCanvasContainerSize({ width: rect.width, height: rect.height })

      // 调整 Fabric.js canvas 的渲染尺寸
      const currentCanvas = useEditorStore.getState().canvas
      if (currentCanvas) {
        try {
          currentCanvas.setDimensions({
            width: rect.width,
            height: rect.height,
          })
          currentCanvas.requestRenderAll()
        } catch {
          // Canvas 可能还没初始化完成或已被销毁，跳过
        }
      }
    }

    // 首次调用，获取初始尺寸
    updateSize()

    /**
     * 使用 ResizeObserver 监听容器尺寸变化
     *
     * 【为什么用 ResizeObserver 而不是 window.resize？】
     * window.resize 只在窗口大小变化时触发。
     * ResizeObserver 可以检测到任何导致元素尺寸变化的情况，
     * 包括 CSS 动画、侧边栏展开/收起等。
     */
    const resizeObserver = new ResizeObserver(() => {
      // 防抖处理：快速调整时合并事件
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateSize, debounceMs)
    })

    resizeObserver.observe(container)

    // 清理函数
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeObserver.disconnect()
    }
  }, [containerRef, canvas, setCanvasContainerSize, debounceMs])
}
