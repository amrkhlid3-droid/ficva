"use client"

import { useCallback, useEffect, useRef } from "react"
import type { FabricObject } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { findWorkspace, type WorkspaceObject } from "@/lib/editor/workspace"
import {
  calculateFitZoom,
  centerWorkspace,
  centerSelection,
} from "@/lib/editor/utils/canvasViewport"

/**
 * useCanvasWorkspaceAutoFit - Workspace 尺寸变更响应模块
 *
 * 【核心职责】
 * 监听 workspace 尺寸变化，根据当前 zoomMode 执行相应操作：
 * - fit: 重新计算自适应缩放，workspace 居中
 * - 100%: 保持 100%，workspace 居中
 * - custom: 保持当前缩放，workspace 居中
 * - focus: 保持选中内容居中，重新计算适应比例
 *
 * 【模块化设计】
 * 这是一个即插即拔的模块，可以通过注释掉 hook 调用来禁用功能。
 *
 * 【使用方式】
 * ```tsx
 * // 启用
 * useCanvasWorkspaceAutoFit()
 *
 * // 禁用
 * // useCanvasWorkspaceAutoFit()
 * ```
 */
export function useCanvasWorkspaceAutoFit() {
  const canvas = useEditorStore((s) => s.canvas)
  const setLogicalCanvasSize = useEditorStore((s) => s.setLogicalCanvasSize)
  const applyZoom = useEditorStore((s) => s.applyZoom)

  /**
   * 缓存上一次的尺寸，避免不必要的更新
   *
   * 当 workspace 的其他属性（如填充色）被修改时，
   * 也会触发 object:modified 事件，但尺寸没变时不需要响应
   */
  const lastSizeRef = useRef({ width: 0, height: 0 })

  /**
   * 根据当前 zoomMode 执行响应
   */
  const handleWorkspaceResize = useCallback(
    (newWidth: number, newHeight: number) => {
      const {
        canvas: currentCanvas,
        canvasContainerSize,
        zoomMode,
        zoom,
      } = useEditorStore.getState()

      if (!currentCanvas || !canvasContainerSize) return

      const newSize = { width: newWidth, height: newHeight }

      // 查找 workspace 获取其实际位置
      const workspace = findWorkspace(currentCanvas)
      const workspacePosition = workspace
        ? { left: workspace.left ?? 0, top: workspace.top ?? 0 }
        : { left: 0, top: 0 }

      switch (zoomMode) {
        case "fit": {
          // 重新计算自适应缩放
          const fitZoom = calculateFitZoom(canvasContainerSize, newSize)
          applyZoom(fitZoom)
          centerWorkspace(
            currentCanvas,
            canvasContainerSize,
            newSize,
            fitZoom,
            workspacePosition
          )
          break
        }
        case "100%": {
          // 保持 100%，居中
          centerWorkspace(
            currentCanvas,
            canvasContainerSize,
            newSize,
            1.0,
            workspacePosition
          )
          break
        }
        case "focus": {
          // 保持选中内容居中
          const activeObject = currentCanvas.getActiveObject()
          if (activeObject) {
            const bounds = activeObject.getBoundingRect()
            const focusZoom = calculateFitZoom(canvasContainerSize, {
              width: bounds.width,
              height: bounds.height,
            })
            applyZoom(focusZoom)
            centerSelection(
              currentCanvas,
              canvasContainerSize,
              bounds,
              focusZoom
            )
          } else {
            // 没有选中对象时，回退到 workspace 居中
            centerWorkspace(
              currentCanvas,
              canvasContainerSize,
              newSize,
              zoom,
              workspacePosition
            )
          }
          break
        }
        case "custom":
        default: {
          // 保持当前缩放，居中
          centerWorkspace(
            currentCanvas,
            canvasContainerSize,
            newSize,
            zoom,
            workspacePosition
          )
          break
        }
      }
    },
    [applyZoom]
  )

  /**
   * 监听 workspace 的 object:modified 事件
   */
  useEffect(() => {
    if (!canvas) return

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const target = e.target
      if (!target) return

      // 检查是否是 workspace 对象
      if (!(target as WorkspaceObject).isWorkspace) return

      const workspace = target as WorkspaceObject
      const newWidth = workspace.width ?? 1200
      const newHeight = workspace.height ?? 800

      // 尺寸没变则跳过
      if (
        newWidth === lastSizeRef.current.width &&
        newHeight === lastSizeRef.current.height
      ) {
        return
      }

      // 更新缓存
      lastSizeRef.current = { width: newWidth, height: newHeight }

      // 1. 同步到 store
      setLogicalCanvasSize({ width: newWidth, height: newHeight })

      // 2. 延迟执行响应，确保 store 更新完成
      setTimeout(() => {
        handleWorkspaceResize(newWidth, newHeight)
      }, 0)
    }

    canvas.on("object:modified", handleObjectModified)

    return () => {
      canvas.off("object:modified", handleObjectModified)
    }
  }, [canvas, setLogicalCanvasSize, handleWorkspaceResize])

  /**
   * 初始化时同步 workspace 尺寸到 store
   *
   * 当 canvas 准备好后，从 workspace 对象读取尺寸并同步到 store。
   * 这确保了从 JSON 加载的 workspace 尺寸能正确反映到 logicalCanvasSize。
   */
  useEffect(() => {
    if (!canvas) return

    // 延迟执行，确保 workspace 已加载
    const timer = setTimeout(() => {
      const workspace = findWorkspace(canvas)
      if (workspace) {
        const width = workspace.width ?? 1200
        const height = workspace.height ?? 800

        // 更新缓存
        lastSizeRef.current = { width, height }

        // 同步到 store
        setLogicalCanvasSize({ width, height })
      }
    }, 100)

    return () => {
      clearTimeout(timer)
    }
  }, [canvas, setLogicalCanvasSize])
}
