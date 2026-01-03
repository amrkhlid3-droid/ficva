"use client"

import { useCallback, useEffect, useRef } from "react"
import { Point } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"

/**
 * 缩放限制常量
 *
 * MIN_ZOOM = 0.1 (10%) - 最小缩放，防止画布太小看不清
 * MAX_ZOOM = 5.0 (500%) - 最大缩放，防止过度放大影响性能
 * ZOOM_STEP = 0.1 (10%) - 每次缩放的步进值
 */
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5.0
const ZOOM_STEP = 0.1

/**
 * useCanvasZoom - 画布缩放与视口管理 Hook
 *
 * 【核心职责】
 * 1. 处理 Ctrl/Cmd + 滚轮缩放（以鼠标位置为中心）
 * 2. 处理键盘快捷键（Ctrl+0 适应, Ctrl+1 100%, Ctrl+/-）
 * 3. 监听容器尺寸变化并调整画布
 * 4. 首次加载时自动居中并适应屏幕
 *
 * 【为什么使用 Fabric.js 原生缩放 API？】
 * 有两种实现缩放的方式：
 *
 * 方式 1：CSS transform（不推荐）
 * - 用 CSS scale() 缩放整个 canvas 容器
 * - 问题：放大时图形会模糊，因为 canvas 的实际像素没变
 *
 * 方式 2：Fabric.js 原生 API（推荐，当前使用）
 * - 使用 canvas.setViewportTransform() 和 canvas.zoomToPoint()
 * - 优点：矢量图形在任何缩放级别都保持清晰
 * - Fabric 会在正确的缩放级别重新渲染所有对象
 *
 * @param containerRef - 画布容器的 DOM 引用，用于绑定事件和获取尺寸
 */
export function useCanvasZoom(containerRef: React.RefObject<HTMLDivElement>) {
  /**
   * 从 Zustand store 获取缩放相关状态和方法
   *
   * canvas - Fabric.js 实例
   * zoom - 当前缩放级别（0.1-5.0）
   * zoomMode - "fit"（适应屏幕）或 "custom"（用户自定义）
   * setZoomMode - 设置缩放模式
   * setCanvasContainerSize - 保存容器尺寸到 store
   * zoomIn/zoomOut - 增加/减少缩放
   * applyZoom - 应用新的缩放值
   */
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

  /**
   * 追踪是否已完成首次适应
   *
   * 【为什么需要这个 ref？】
   * 首次加载时，我们希望自动将画布缩放并居中（适应屏幕）。
   * 但之后如果用户调整窗口大小，行为取决于当前模式：
   * - "fit" 模式：重新计算适应比例
   * - "custom" 模式：保持当前缩放，只重新居中
   *
   * 这个 ref 用来区分"首次加载"和"后续调整"。
   *
   * 【React 18 严格模式注意】
   * 严格模式下组件会双重挂载，所以这个 ref 需要在 canvas 变为 null 时重置。
   * 见下面的 useEffect。
   */
  const initialFitDoneRef = useRef(false)

  /**
   * 将画布居中到视口中央
   *
   * 【原理】
   * Fabric.js 使用 viewportTransform 矩阵来控制视口：
   * [scaleX, skewY, skewX, scaleY, translateX, translateY]
   *
   * 我们只用到 scaleX/scaleY（缩放）和 translateX/translateY（平移）。
   * skewX/skewY 设为 0（不倾斜）。
   *
   * 【计算居中位置】
   * translateX = (容器宽度 - 逻辑画布宽度 × 缩放) / 2
   * translateY = (容器高度 - 逻辑画布高度 × 缩放) / 2
   *
   * 这样逻辑画布就会在容器正中央。
   */
  const centerCanvas = useCallback((zoomLevel: number) => {
    // 从 store 获取最新状态（不通过闭包，避免过时数据）
    const {
      canvas: currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
    } = useEditorStore.getState()

    console.log("currentCanvas:", currentCanvas)

    // 如果 canvas 或容器尺寸还没准备好，直接返回
    if (!currentCanvas || !canvasContainerSize) return

    // 逻辑画布尺寸（用户的设计区域，默认 1200x800）
    const canvasWidth = logicalCanvasSize.width
    const canvasHeight = logicalCanvasSize.height

    /**
     * 计算居中位置
     *
     * 公式：(容器尺寸 - 缩放后的画布尺寸) / 2
     * 这样画布两侧的空白是相等的，实现居中效果
     */
    const centerX = (canvasContainerSize.width - canvasWidth * zoomLevel) / 2
    const centerY = (canvasContainerSize.height - canvasHeight * zoomLevel) / 2

    /**
     * 设置视口变换矩阵
     *
     * 矩阵格式：[scaleX, skewY, skewX, scaleY, translateX, translateY]
     * - scaleX, scaleY = zoomLevel（统一缩放，保持比例）
     * - skewX, skewY = 0（不倾斜）
     * - translateX, translateY = 居中偏移量
     */
    currentCanvas.setViewportTransform([
      zoomLevel,
      0,
      0,
      zoomLevel,
      centerX,
      centerY,
    ])

    console.log(currentCanvas)

    // 请求重新渲染画布
    // currentCanvas.requestRenderAll()
  }, [])

  /**
   * 处理滚轮缩放（Ctrl/Cmd + 滚轮）
   *
   * 【用户体验】
   * 以鼠标位置为中心进行缩放，这样用户可以精确控制要放大的区域。
   * 这是专业设计软件（如 Figma、Sketch）的标准行为。
   *
   * 【技术实现】
   * 使用 Fabric.js 的 zoomToPoint() 方法，它会：
   * 1. 以指定点为中心进行缩放
   * 2. 自动调整视口变换矩阵
   * 3. 保持鼠标下方的内容位置不变
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // 只在按住 Ctrl（Windows/Linux）或 Cmd（Mac）时响应
      // 普通滚轮留给浏览器默认行为（如果需要的话）
      if (!e.ctrlKey && !e.metaKey) return

      // 阻止浏览器默认的缩放行为
      e.preventDefault()

      // 获取最新状态
      const { zoom: currentZoom, canvas: currentCanvas } =
        useEditorStore.getState()
      if (!currentCanvas) return

      /**
       * 计算新的缩放值
       *
       * deltaY > 0 表示向下滚动（缩小）
       * deltaY < 0 表示向上滚动（放大）
       * 注意：触控板的行为可能相反，但大多数用户习惯这种映射
       */
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom + delta)
      )

      // 如果缩放值没变（已达极限），不执行操作
      if (newZoom === currentZoom) return

      /**
       * 获取鼠标相对于 canvas 元素的位置
       *
       * 【为什么需要这个计算？】
       * e.clientX/Y 是相对于视口的坐标
       * 我们需要相对于 canvas 元素的坐标才能正确缩放
       */
      const canvasElement = currentCanvas.getElement()
      const rect = canvasElement.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      /**
       * 以鼠标位置为中心进行缩放
       *
       * Fabric.js 的 zoomToPoint 会：
       * 1. 将指定点作为缩放中心
       * 2. 应用新的缩放级别
       * 3. 保持该点在屏幕上的位置不变
       */
      const point = new Point(mouseX, mouseY)
      currentCanvas.zoomToPoint(point, newZoom)

      // 更新 store 中的缩放值
      applyZoom(newZoom)
      // 用户手动缩放后，切换到自定义模式（不再自动适应）
      setZoomMode("custom")
    },
    [applyZoom, setZoomMode]
  )

  /**
   * 绑定滚轮事件监听器
   *
   * 【为什么用 { passive: false }？】
   * 默认情况下，滚轮事件是 "passive" 的，意味着浏览器假设你不会调用
   * preventDefault()。如果你在 passive 事件中调用 preventDefault()，
   * 浏览器会忽略它并在控制台警告。
   *
   * 我们需要阻止 Ctrl+滚轮的默认缩放行为，所以必须设置 passive: false。
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [containerRef, handleWheel])

  /**
   * 自适应缩放并居中
   *
   * 【功能】
   * 计算能让整个逻辑画布在容器中可见的最大缩放比例，
   * 然后应用这个缩放并将画布居中。
   *
   * 【使用场景】
   * 1. 首次加载时自动调用
   * 2. 用户按 Ctrl+0 快捷键
   * 3. 在 "fit" 模式下调整窗口大小
   */
  const zoomToFitAndCenter = useCallback(() => {
    const {
      canvas: currentCanvas,
      canvasContainerSize,
      logicalCanvasSize,
    } = useEditorStore.getState()

    if (!currentCanvas || !canvasContainerSize) return

    /**
     * 检查 canvas 是否仍然有效
     *
     * 【为什么需要这个检查？】
     * 在 React 18 严格模式下，组件可能正在卸载过程中，
     * canvas 可能已经被 dispose 但状态还没更新。
     * getElement() 会在 canvas 无效时抛出错误。
     */
    try {
      currentCanvas.getElement()
    } catch {
      return
    }

    const canvasWidth = logicalCanvasSize.width
    const canvasHeight = logicalCanvasSize.height

    /**
     * 预留边距
     *
     * 画布不会完全贴边，留出 40px 的呼吸空间，
     * 让界面看起来更舒适。
     */
    const padding = 40

    // 计算可用空间（容器尺寸减去两侧边距）
    const availableWidth = canvasContainerSize.width - padding * 2
    const availableHeight = canvasContainerSize.height - padding * 2

    /**
     * 计算适应比例
     *
     * 分别计算水平和垂直方向的缩放比例，
     * 取较小的那个，确保画布完全可见。
     */
    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight

    // 取较小值并限制在允许范围内
    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(scaleX, scaleY))
    )

    // 应用缩放值
    applyZoom(fitZoom)
    // 设置为 "fit" 模式，这样调整窗口大小时会重新计算
    setZoomMode("fit")

    // 以计算出的缩放值居中画布
    centerCanvas(fitZoom)
  }, [applyZoom, setZoomMode, centerCanvas])

  /**
   * 缩放到指定级别并居中
   *
   * 【与 zoomToFitAndCenter 的区别】
   * - zoomToFitAndCenter：自动计算适应比例
   * - centerAndZoom：使用指定的缩放值
   *
   * 【使用场景】
   * 1. 用户通过缩放滑块选择具体缩放值
   * 2. 快捷键缩放（Ctrl+/- 或 Ctrl+1）
   * 3. 点击预设缩放值（50%, 100%, 200% 等）
   */
  const centerAndZoom = useCallback(
    (newZoom: number) => {
      // 确保缩放值在允许范围内
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))

      applyZoom(clampedZoom)
      // 用户主动设置缩放值，切换到自定义模式
      setZoomMode("custom")

      // 在新缩放级别下居中画布
      centerCanvas(clampedZoom)
    },
    [applyZoom, setZoomMode, centerCanvas]
  )

  /**
   * 处理键盘快捷键
   *
   * 支持的快捷键：
   * - Ctrl/Cmd + Plus (=)：放大
   * - Ctrl/Cmd + Minus (-)：缩小
   * - Ctrl/Cmd + 0：适应屏幕
   * - Ctrl/Cmd + 1：100% 缩放
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // Ctrl/Cmd + Plus: 放大
      // 注意：+ 键在美式键盘上需要按 Shift，所以也检查 = 键
      if (isCtrlOrMeta && (e.key === "+" || e.key === "=")) {
        e.preventDefault()
        const { zoom: currentZoom } = useEditorStore.getState()
        const newZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP)
        centerAndZoom(newZoom)
      }

      // Ctrl/Cmd + Minus: 缩小
      if (isCtrlOrMeta && e.key === "-") {
        e.preventDefault()
        const { zoom: currentZoom } = useEditorStore.getState()
        const newZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP)
        centerAndZoom(newZoom)
      }

      // Ctrl/Cmd + 0: 适应屏幕
      if (isCtrlOrMeta && e.key === "0") {
        e.preventDefault()
        zoomToFitAndCenter()
      }

      // Ctrl/Cmd + 1: 重置到 100%
      if (isCtrlOrMeta && e.key === "1") {
        e.preventDefault()
        centerAndZoom(1.0)
      }
    },
    [zoomToFitAndCenter, centerAndZoom]
  )

  /**
   * 绑定键盘事件监听器
   *
   * 绑定到 window 而不是容器，这样即使焦点不在画布上也能响应。
   */
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  /**
   * 监听容器尺寸变化
   *
   * 【职责】
   * 1. 记录容器尺寸到 store（供其他组件使用）
   * 2. 调整 Fabric.js canvas 的渲染尺寸
   * 3. 根据 zoomMode 决定是重新适应还是重新居中
   *
   * 【关键问题：无限循环的防护】
   * 这里有一个潜在的无限循环问题，已通过多种方式解决：
   *
   * 问题描述：
   * ResizeObserver 监听容器 → 容器变化时调整 canvas 尺寸 →
   * canvas 尺寸变化影响容器（如果 .canvas-container 是 relative 定位）→
   * 容器变化触发 ResizeObserver → 无限循环
   *
   * 解决方案（多层防护）：
   * 1. CSS 层面：.canvas-container 设为 absolute 定位（见 FabricCanvas.tsx）
   *    这是根本解决方案，使 canvas 不影响容器尺寸
   * 2. 代码层面：跟踪 lastWidth/lastHeight，尺寸没变就跳过
   *    作为额外保险，防止不必要的更新
   * 3. 防抖：50ms 延迟，合并快速连续的调整
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    /**
     * 跟踪上次尺寸
     *
     * 【为什么需要？】
     * 即使使用了 CSS 修复，也可能有其他原因触发 ResizeObserver，
     * 比如窗口调整。通过比较尺寸，我们避免在尺寸没变时做无谓的操作。
     */
    let lastWidth = 0
    let lastHeight = 0
    let resizeTimeout: NodeJS.Timeout | null = null

    const updateSize = () => {
      const rect = container.getBoundingClientRect()

      // 容器尚未渲染完成（尺寸为 0），跳过
      if (rect.width === 0 || rect.height === 0) return

      /**
       * 【关键】尺寸没变就跳过
       *
       * 这是防止无限循环的重要检查。
       * 即使 .canvas-container 是 absolute 定位，
       * 也可能因为其他原因触发此回调。
       */
      if (rect.width === lastWidth && rect.height === lastHeight) return

      // 更新记录的尺寸
      lastWidth = rect.width
      lastHeight = rect.height

      // 保存到 store，供其他组件使用（如缩放计算）
      setCanvasContainerSize({ width: rect.width, height: rect.height })

      const {
        canvas: currentCanvas,
        zoom: currentZoom,
        zoomMode: currentZoomMode,
      } = useEditorStore.getState()

      /**
       * 调整 Fabric.js canvas 的渲染尺寸
       *
       * 【为什么需要？】
       * Fabric.js canvas 需要知道它的实际像素尺寸才能正确渲染。
       * 当容器大小变化时，canvas 也需要相应调整。
       */
      if (currentCanvas) {
        try {
          currentCanvas.setDimensions({
            width: rect.width,
            height: rect.height,
          })
        } catch {
          // Canvas 可能还没初始化完成或已被销毁，跳过
        }
      }

      /**
       * 根据 zoomMode 决定行为
       *
       * - "fit" 模式：重新计算适应比例（用户希望画布始终适应屏幕）
       * - "custom" 模式：保持当前缩放，只重新居中（用户设置的缩放不变）
       *
       * 只在首次适应完成后才执行，避免与初始化冲突
       */
      if (currentZoomMode === "fit" && initialFitDoneRef.current) {
        // 延迟到下一个事件循环，确保尺寸更新已传播
        setTimeout(() => {
          zoomToFitAndCenter()
        }, 0)
      } else if (initialFitDoneRef.current) {
        // 在当前缩放级别下重新居中
        centerCanvas(currentZoom)
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
      /**
       * 防抖处理
       *
       * 快速调整窗口大小时会触发大量事件，
       * 50ms 延迟可以合并这些事件，只执行最后一次。
       */
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateSize, 50)
    })

    resizeObserver.observe(container)

    // 清理函数
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeObserver.disconnect()
    }
  }, [containerRef, setCanvasContainerSize, zoomToFitAndCenter, centerCanvas])

  /**
   * 重置 initialFitDoneRef - React 18 严格模式兼容
   *
   * 【为什么需要？】
   * 在严格模式下，组件会这样执行：
   * 1. 挂载 → canvas 创建 → initialFitDoneRef = true
   * 2. 卸载 → canvas 销毁 → 但 ref 保持 true！
   * 3. 重新挂载 → canvas 创建 → 因为 ref 是 true，跳过首次适应
   *
   * 结果：第二次挂载时画布不会自动居中。
   *
   * 解决方案：
   * 监听 canvas 变化，当 canvas 变为 null（卸载）时重置 ref。
   * 这样下次挂载时 ref 是 false，会正确执行首次适应。
   */
  useEffect(() => {
    if (!canvas) {
      initialFitDoneRef.current = false
    }
  }, [canvas])

  /**
   * 首次加载时自动适应屏幕
   *
   * 【时机】
   * 当以下条件都满足时执行：
   * 1. canvas 已初始化（canvas !== null）
   * 2. 容器尺寸已获取（containerSize !== null）
   * 3. 尚未执行过首次适应（initialFitDoneRef.current === false）
   *
   * 【100ms 延迟的原因】
   * Canvas 初始化是异步的，即使 canvas 对象存在，
   * 可能还有一些内部状态没有准备好。
   * 短暂延迟确保 canvas 完全可用后再执行缩放。
   */
  useEffect(() => {
    const { canvasContainerSize: containerSize } = useEditorStore.getState()

    // 等待 canvas 和容器尺寸都准备好
    if (!canvas || !containerSize) return undefined

    // 只在首次加载时执行
    if (!initialFitDoneRef.current) {
      const timer = setTimeout(() => {
        zoomToFitAndCenter()
        // 标记已完成，后续调整窗口大小时使用不同的逻辑
        initialFitDoneRef.current = true
      }, 100)

      // 清理定时器（如果在 100ms 内组件卸载）
      return () => {
        clearTimeout(timer)
      }
    }

    return undefined
  }, [canvas, zoomToFitAndCenter])

  /**
   * 返回缩放相关的状态和方法
   *
   * 这些方法供外部组件使用，例如：
   * - 工具栏的缩放按钮
   * - 底部的缩放滑块
   * - 右键菜单的缩放选项
   */
  return {
    /** 当前缩放级别 (0.1 - 5.0) */
    zoom,
    /** 当前缩放模式 ("fit" 或 "custom") */
    zoomMode,
    /** 放大一档 */
    zoomIn,
    /** 缩小一档 */
    zoomOut,
    /** 自适应屏幕 */
    zoomToFit: zoomToFitAndCenter,
    /** 设置具体缩放值（不居中） */
    setZoom: (newZoom: number) => {
      applyZoom(newZoom)
      setZoomMode("custom")
    },
    /** 设置具体缩放值并居中 */
    centerAndZoom,
    /** 重置到 100% 并居中 */
    resetZoom: () => {
      centerAndZoom(1.0)
    },
  }
}
