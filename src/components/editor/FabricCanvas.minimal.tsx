"use client"

import { useEffect, useRef } from "react"
import { Canvas } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import {
  useCanvasResize,
  useCanvasWorkspace,
  useInitialCanvasSave,
  useCanvasSnapshot,
  useCanvasWorkspaceAutoFit,
  useCanvasZoom,
  // Navigation Controls - Pluggable Modules
  useZoomShortcuts,
  useWheelZoom,
  useWheelPanVertical,
  useWheelPanHorizontal,
  useMiddleMousePan,
} from "@/hooks/canvas"
import { debugFabricCanvasMinimal as debug } from "@/lib/editor/utils/debug"
import ZoomControls from "./ZoomControls"

/**
 * FabricCanvas.minimal - 最小化调试版本
 *
 * 只包含最基础的 Fabric.js canvas 初始化：
 * - Canvas 尺寸 = 容器最大可用空间
 * - 背景透明
 * - 无画板背景 Rect
 * - 无 zoom/pan 功能
 *
 * 【模块化】
 * - useCanvasResize: 可拆装的尺寸自适应模块
 * - useCanvasWorkspace: 可拆装的工作区边框模块
 */
export default function FabricCanvasMinimal() {
  const containerRef = useRef<HTMLDivElement>(null!)
  const setCanvas = useEditorStore((s) => s.setCanvas)

  // 模块化：Canvas 尺寸自适应（可选，注释掉即可禁用）
  useCanvasResize({ containerRef })

  // 模块化：工作区边框（可选，注释掉即可禁用）
  useCanvasWorkspace()

  // 模块化：初始化完成后主动保存（解决空项目刷新后数据丢失）
  useInitialCanvasSave()

  // 模块化：画布快照（监听对象变化，同步到 pages store，触发自动保存）
  useCanvasSnapshot()

  // 模块化：Workspace 尺寸变化后自动居中缩放（可选，注释掉即可禁用）
  useCanvasWorkspaceAutoFit()

  // 模块化：缩放控制（核心 API，供 ZoomControls 使用）
  const { zoom, zoomMode, zoomIn, zoomOut, zoomToFit, centerAndZoom } =
    useCanvasZoom(containerRef)

  // ========== 导航控制模块（可插拔） ==========
  // 每个模块独立，注释掉即可禁用

  // Shift+1/2/3 缩放模式快捷键
  useZoomShortcuts()

  // Ctrl+滚轮缩放（以鼠标为中心）
  useWheelZoom(containerRef)

  // 滚轮纵向平移（workspace 超出视口时生效）
  useWheelPanVertical(containerRef)

  // Shift+滚轮横向平移（workspace 超出视口时生效）
  useWheelPanHorizontal(containerRef)

  // 鼠标中键拖拽平移
  useMiddleMousePan()

  useEffect(() => {
    if (!containerRef.current) return

    debug.group("Canvas Initialization")
    debug.info("Starting canvas initialization")

    // 动态创建 canvas 元素
    const canvasElement = document.createElement("canvas")
    containerRef.current.appendChild(canvasElement)
    debug.info("Canvas element created and appended to container")

    // 获取容器尺寸
    const containerRect = containerRef.current.getBoundingClientRect()
    const width = containerRect.width || 1200
    const height = containerRect.height || 800
    debug.info("Container dimensions", { width, height })

    // 初始化 Fabric.js Canvas
    debug.time("Fabric.js Canvas Creation")
    const canvasInstance = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: "transparent",
      fireRightClick: true,
      stopContextMenu: true,
      preserveObjectStacking: true,
    })
    debug.timeEnd("Fabric.js Canvas Creation")

    debug.info("Canvas options", {
      backgroundColor: "transparent",
      fireRightClick: true,
      stopContextMenu: true,
      preserveObjectStacking: true,
    })

    // 注册到 store
    setCanvas(canvasInstance)
    debug.success("Canvas registered to store")
    debug.health("healthy", "Canvas initialized successfully")
    debug.groupEnd()

    // 清理
    return () => {
      debug.group("Canvas Cleanup")
      debug.info("Starting canvas cleanup")

      const wrapper = canvasElement.parentElement
      setCanvas(null)
      debug.info("Canvas unregistered from store")

      canvasInstance.dispose()
      debug.info("Fabric.js canvas disposed")

      if (wrapper?.classList.contains("canvas-container")) {
        wrapper.remove()
        debug.info("Canvas wrapper removed")
      } else if (canvasElement.parentElement) {
        canvasElement.remove()
        debug.info("Canvas element removed")
      }

      debug.success("Canvas cleanup completed")
      debug.groupEnd()
    }
  }, [setCanvas])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 [&>.canvas-container]:absolute! [&>.canvas-container]:inset-0!"
    >
      {/* 点阵背景 - 使用主题默认填充色（浅色: #e5e5e5, 深色: #404040） */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] bg-size-[20px_20px] dark:bg-[radial-gradient(#404040_1px,transparent_1px)]" />

      {/* 缩放控制栏 */}
      <ZoomControls
        zoom={zoom}
        zoomMode={zoomMode}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomChange={centerAndZoom}
        onZoomToFit={zoomToFit}
      />
    </div>
  )
}
