"use client"

import { useEffect, useCallback } from "react"
import { Canvas, Rect } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"

export interface CanvasInitOptions {
  /** 容器 DOM 元素的引用，canvas 将被添加到这个容器中 */
  containerRef: React.RefObject<HTMLDivElement>
}

export interface CanvasInitResult {
  /** Fabric.js Canvas 实例，初始化完成前为 null */
  canvas: Canvas | null
  /** 画布是否已经初始化完成 */
  isReady: boolean
}

/**
 * useCanvasInit - Fabric.js 画布初始化 Hook
 *
 * 【核心职责】
 * 1. 动态创建 <canvas> DOM 元素
 * 2. 初始化 Fabric.js Canvas 实例
 * 3. 添加逻辑画布背景（白色设计区域）
 * 4. 将 canvas 实例注册到 Zustand 全局状态
 * 5. 组件卸载时完整清理（包括 DOM 元素）
 *
 * 【为什么要动态创建 canvas 元素？- React 18 严格模式兼容性】
 *
 * 问题背景：
 * React 18 严格模式会在开发环境下"双重挂载"组件：
 * - 第一次挂载 → 立即卸载 → 第二次挂载
 * 这是为了帮助开发者发现副作用（useEffect）中的问题。
 *
 * Fabric.js 的问题：
 * 当你将 Fabric.js 绑定到一个 <canvas> 元素时，Fabric 会：
 * 1. 修改 canvas 元素的属性
 * 2. 将它包裹在一个 div.canvas-container 中
 * 3. 添加额外的 canvas 层（用于交互）
 *
 * 如果 canvas 元素在 JSX 中声明（如 <canvas ref={canvasRef} />），
 * 第一次挂载后 Fabric 修改了它，卸载时虽然调用了 dispose()，
 * 但 canvas 元素本身已经被"污染"了。
 * 第二次挂载时，Fabric 尝试在这个"脏"的 canvas 上初始化，就会失败。
 *
 * 解决方案：
 * 每次挂载时用 document.createElement("canvas") 创建全新的元素，
 * 卸载时将这个元素完全从 DOM 中移除。
 * 这样每次挂载都是干净的状态。
 */
export function useCanvasInit({
  containerRef,
}: CanvasInitOptions): CanvasInitResult {
  /**
   * 从 Zustand store 获取 setCanvas 方法
   *
   * 【为什么用 Zustand？】
   * canvas 实例需要被多个组件和 hooks 共享访问：
   * - 工具栏需要操作 canvas
   * - 图层面板需要读取 canvas 对象
   * - 缩放控件需要调用 canvas 方法
   * Zustand 提供了一个全局的、响应式的状态管理方案。
   */
  const setCanvas = useEditorStore((s) => s.setCanvas)
  const canvas = useEditorStore((s) => s.canvas)

  /**
   * 创建逻辑画布背景
   *
   * 【什么是逻辑画布？】
   * 用户看到的"设计区域"，默认是 1200x800 的白色矩形。
   * 这与 Fabric.js 的渲染画布（viewport）是不同的概念：
   * - 渲染画布：填满整个容器，用于显示和交互
   * - 逻辑画布：设计内容的边界，可以缩放和平移
   *
   * 【为什么需要这个白色背景？】
   * 1. 视觉上明确设计区域的边界
   * 2. 导出时只导出这个区域内的内容
   * 3. 与灰色的容器背景形成对比
   */
  const createCanvasBackground = useCallback((canvasInstance: Canvas) => {
    // 从 store 获取逻辑画布尺寸（默认 1200x800）
    const { logicalCanvasSize } = useEditorStore.getState()

    const canvasBackground = new Rect({
      left: 0,
      top: 0,
      width: logicalCanvasSize.width,
      height: logicalCanvasSize.height,
      fill: "#555555", // 白色背景
      selectable: false, // 不可选中
      evented: false, // 不响应事件（点击穿透）
      excludeFromExport: true, // 导出时排除（不是用户内容的一部分）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    /**
     * 标记为画布背景
     *
     * 【为什么需要这个标记？】
     * 在 syncLayers（同步图层列表）时，需要过滤掉这个背景对象，
     * 因为它不是用户创建的内容，不应该出现在图层面板中。
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(canvasBackground as any).isCanvasBackground = true

    // 添加到画布并发送到最底层
    canvasInstance.add(canvasBackground)
    canvasInstance.sendObjectToBack(canvasBackground)
  }, [])

  /**
   * 主初始化 Effect
   *
   * 【依赖数组为空 []】
   * 这个 effect 只在组件挂载时执行一次，卸载时执行清理。
   * 不监听任何状态变化，因为 canvas 只需要初始化一次。
   */
  useEffect(() => {
    // 容器还没准备好，直接返回
    if (!containerRef.current) return

    /**
     * 步骤 1：动态创建 canvas DOM 元素
     *
     * 【为什么用 document.createElement 而不是 JSX？】
     * 见文件顶部的详细解释 - 这是为了兼容 React 18 严格模式。
     * 每次挂载都创建全新的元素，避免复用被 Fabric 修改过的"脏"元素。
     */
    const canvasElement = document.createElement("canvas")
    containerRef.current.appendChild(canvasElement)

    /**
     * 步骤 2：获取容器尺寸
     *
     * 【为什么需要容器尺寸？】
     * Fabric.js canvas 需要明确的像素尺寸。
     * 我们让渲染画布填满整个容器，这样用户有最大的可视区域。
     *
     * 【默认值 1200x800】
     * 如果容器尺寸获取失败（极少见），使用合理的默认值。
     */
    const containerRect = containerRef.current.getBoundingClientRect()
    const initialWidth = containerRect.width || 1200
    const initialHeight = containerRect.height || 800

    /**
     * 步骤 3：初始化 Fabric.js Canvas 实例
     *
     * 【配置项解释】
     * - width/height: 渲染画布的像素尺寸
     * - backgroundColor: transparent 因为我们用 CSS 和逻辑画布背景
     * - fireRightClick: 允许右键事件（用于上下文菜单）
     * - stopContextMenu: 阻止浏览器默认右键菜单
     * - preserveObjectStacking: 保持对象堆叠顺序（选中时不自动置顶）
     */
    const canvasInstance = new Canvas(canvasElement, {
      width: initialWidth,
      height: initialHeight,
      backgroundColor: "transparent",
      fireRightClick: true,
      stopContextMenu: true,
      preserveObjectStacking: true,
    })

    /**
     * 步骤 4：添加逻辑画布背景
     *
     * 这是用户看到的白色"设计区域"。
     */
    createCanvasBackground(canvasInstance)

    /**
     * 步骤 5：注册到全局状态
     *
     * 此时 canvas 才对其他组件可见。
     * 这会触发 useEditorStore 的订阅者更新。
     */
    setCanvas(canvasInstance)

    /**
     * 清理函数 - 组件卸载时执行
     *
     * 【清理的重要性】
     * 如果不清理，会导致：
     * 1. 内存泄漏（canvas 对象没有被垃圾回收）
     * 2. DOM 节点残留
     * 3. 事件监听器堆积
     * 4. React 18 严格模式下的重复初始化失败
     */
    return () => {
      /**
       * 【关键】在 dispose 之前保存 wrapper 的引用
       *
       * Fabric.js 初始化时会把我们的 canvas 元素包裹在一个
       * div.canvas-container 中。dispose() 会清理 Fabric 的内部状态，
       * 但不会移除这个 wrapper DOM 元素。
       *
       * 如果我们在 dispose 后才尝试获取 parentElement，
       * 可能会得到错误的结果，因为 Fabric 可能已经修改了 DOM 结构。
       */
      const wrapper = canvasElement.parentElement

      // 先从全局状态中移除 canvas 引用
      // 这会让其他组件知道 canvas 已不可用
      setCanvas(null)

      // 销毁 Fabric.js 实例（释放内存、移除事件监听器）
      canvasInstance.dispose()

      /**
       * 移除 DOM 元素
       *
       * 情况 1：Fabric 创建了 wrapper（正常情况）
       * canvas 被包裹在 div.canvas-container 中，移除整个 wrapper
       *
       * 情况 2：没有 wrapper（异常情况，作为后备）
       * 直接移除 canvas 元素本身
       */
      if (wrapper && wrapper.classList.contains("canvas-container")) {
        wrapper.remove()
      } else if (canvasElement.parentElement) {
        canvasElement.remove()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    canvas,
    isReady: canvas !== null,
  }
}
