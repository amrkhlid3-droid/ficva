"use client"

import { useCallback, useEffect, useRef } from "react"
import { Rect, type Canvas } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { findWorkspace, type WorkspaceObject } from "@/lib/editor/workspace"

// ============ DEBUG 开关 ============
const DEBUG_WORKSPACE = true
// ====================================

function debugLog(...args: unknown[]) {
  if (DEBUG_WORKSPACE) {
    console.log("[useCanvasWorkspace]", ...args)
  }
}

// Re-export for backwards compatibility
export type { WorkspaceObject }

export interface CanvasWorkspaceOptions {
  /** 默认工作区宽度，默认 1200 */
  defaultWidth?: number
  /** 默认工作区高度，默认 800 */
  defaultHeight?: number
  /** 浅色主题边框颜色 */
  lightBorderColor?: string
  /** 深色主题边框颜色 */
  darkBorderColor?: string
  /** 浅色主题默认填充色 */
  lightFillColor?: string
  /** 深色主题默认填充色 */
  darkFillColor?: string
  /** 边框宽度，默认 1 */
  borderWidth?: number
}

/**
 * useCanvasWorkspace - 工作区模块
 *
 * 【核心职责】
 * 1. 在 canvas 中创建一个 workspace 矩形作为工作区域
 * 2. 工作区默认填充：浅色主题 #E5E5E5，深色主题 #404040
 * 3. 边框颜色黑白主题同色（#E5E5E5）
 * 4. 默认尺寸为 1200x800（用户可修改）
 * 5. 居中显示
 *
 * 【特性】
 * - 不可选中、不可移动（作为背景参考）
 * - **会被导出到 JSON**（用户可以修改画布尺寸，需要持久化）
 * - 始终在最底层
 * - 响应主题变化自动更新边框颜色
 * - 如果从 JSON 加载了 workspace，保留其尺寸和位置
 * - 只有在没有 workspace 时才创建默认的
 */
export function useCanvasWorkspace({
  defaultWidth = 1200,
  defaultHeight = 800,
  lightBorderColor = "#e5e5e5", // neutral-200
  darkBorderColor = "#e5e5e5", // neutral-200，黑白主题同色
  lightFillColor = "#e5e5e5", // neutral-200，浅色主题默认填充
  darkFillColor = "#404040", // zinc-700，深色主题默认填充
  borderWidth = 1,
}: CanvasWorkspaceOptions = {}) {
  const canvas = useEditorStore((s) => s.canvas)
  const canvasContainerSize = useEditorStore((s) => s.canvasContainerSize)

  // 跟踪当前 canvas 实例
  const canvasInstanceRef = useRef<Canvas | null>(null)

  // 获取当前边框颜色
  const getBorderColor = useCallback(() => {
    if (typeof window === "undefined") return lightBorderColor
    const isDark = document.documentElement.classList.contains("dark")
    return isDark ? darkBorderColor : lightBorderColor
  }, [lightBorderColor, darkBorderColor])

  // 获取当前填充颜色
  const getFillColor = useCallback(() => {
    if (typeof window === "undefined") return lightFillColor
    const isDark = document.documentElement.classList.contains("dark")
    return isDark ? darkFillColor : lightFillColor
  }, [lightFillColor, darkFillColor])

  /**
   * 创建默认 workspace（仅当不存在时调用）
   *
   * 注意：如果 workspace 已从 JSON 加载，不会调用此函数
   * 这样可以保留用户修改的画布尺寸
   */
  const createDefaultWorkspace = useCallback(() => {
    if (!canvas || !canvasContainerSize) return null

    const containerWidth = canvasContainerSize.width
    const containerHeight = canvasContainerSize.height

    if (containerWidth === 0 || containerHeight === 0) return null

    // 使用固定的默认尺寸 1200x800（或用户配置的尺寸）
    const workspaceWidth = defaultWidth
    const workspaceHeight = defaultHeight
    // 居中放置
    const left = (containerWidth - workspaceWidth) / 2
    const top = (containerHeight - workspaceHeight) / 2

    // 创建新的 workspace（不设置 excludeFromExport，会被保存到 JSON）
    const newWorkspace = new Rect({
      width: workspaceWidth,
      height: workspaceHeight,
      left,
      top,
      fill: getFillColor(), // 根据主题获取默认填充色
      stroke: getBorderColor(),
      strokeWidth: borderWidth,
      originX: "left",
      originY: "top",
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      // 注意：不设置 excludeFromExport，workspace 会被保存到 JSON
    })

    ;(newWorkspace as WorkspaceObject).isWorkspace = true
    ;(newWorkspace as WorkspaceObject).name = "workspace"
    ;(newWorkspace as WorkspaceObject).followTheme = true // 默认开启跟随主题

    return newWorkspace as WorkspaceObject
  }, [
    canvas,
    canvasContainerSize,
    defaultWidth,
    defaultHeight,
    borderWidth,
    getBorderColor,
    getFillColor,
  ])

  /**
   * 确保 workspace 存在
   *
   * 逻辑：
   * 1. 如果已存在 workspace（可能从 JSON 加载），只更新边框颜色
   * 2. 如果不存在，创建默认的 workspace
   */
  const ensureWorkspace = useCallback(() => {
    if (!canvas || !canvasContainerSize) return

    // 查找现有的 workspace（可能从 JSON 加载）
    let workspace = findWorkspace(canvas)

    if (workspace) {
      // workspace 已存在（可能从 JSON 加载），只更新边框颜色（主题相关）
      // 不修改尺寸和位置，保留用户的设置
      workspace.set({
        stroke: getBorderColor(),
        strokeWidth: borderWidth,
      })
      debugLog("✅ 使用已有 workspace (从 JSON 加载):", {
        width: workspace.width,
        height: workspace.height,
        left: workspace.left,
        top: workspace.top,
      })
    } else {
      // 没有 workspace，创建默认的
      workspace = createDefaultWorkspace()
      if (workspace) {
        canvas.add(workspace)
        debugLog("✅ 创建默认 workspace:", {
          width: workspace.width,
          height: workspace.height,
          left: workspace.left,
          top: workspace.top,
        })
      }
    }

    // 确保在最底层
    if (workspace) {
      canvas.sendObjectToBack(workspace)
    }
  }, [
    canvas,
    canvasContainerSize,
    borderWidth,
    getBorderColor,
    createDefaultWorkspace,
  ])

  // 主 effect：创建 workspace 并监听 canvas 事件
  useEffect(() => {
    debugLog("========== useEffect 触发 ==========")
    debugLog("canvas:", canvas ? "存在" : "null")
    debugLog("canvasContainerSize:", canvasContainerSize)

    if (!canvas || !canvasContainerSize) {
      debugLog("❌ 提前返回: canvas 或 canvasContainerSize 为空")
      return
    }

    // 检查 canvas 实例是否变化
    const isNewCanvas = canvasInstanceRef.current !== canvas
    canvasInstanceRef.current = canvas
    debugLog("isNewCanvas:", isNewCanvas)

    // 立即创建/更新 workspace
    ensureWorkspace()
    canvas.renderAll()

    // 监听 canvas 的 after:render 事件
    // 这样当 loadFromJSON 清空 canvas 后，我们可以重新创建 workspace
    const handleAfterRender = () => {
      // 检查 workspace 是否存在，如果不存在则重新创建
      const workspace = findWorkspace(canvas)
      if (!workspace) {
        debugLog("🔄 after:render: workspace 不存在，重新创建")
        ensureWorkspace()
      }
    }

    canvas.on("after:render", handleAfterRender)

    // 清理函数
    return () => {
      debugLog("========== cleanup 触发 ==========")
      canvas.off("after:render", handleAfterRender)
    }
  }, [canvas, canvasContainerSize, ensureWorkspace])

  // 监听主题变化
  useEffect(() => {
    if (!canvas) return

    const updateThemeColors = () => {
      const workspace = findWorkspace(canvas)
      if (workspace) {
        // 始终更新边框颜色
        workspace.set({ stroke: getBorderColor() })

        // 仅当 followTheme 开启时更新填充色
        if (workspace.followTheme) {
          workspace.set({ fill: getFillColor() })
          // 触发 modified 事件以便保存更改
          canvas.fire("object:modified", { target: workspace })
        }

        canvas.requestRenderAll()
      }
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          updateThemeColors()
        }
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => {
      observer.disconnect()
    }
  }, [canvas, getBorderColor, getFillColor])
}
