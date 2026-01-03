/**
 * useInitialCanvasSave - 初始化完成后主动保存 Canvas JSON
 *
 * 职责：
 * - 检测 Canvas 初始化是否完成
 * - 如果当前页面 JSON 为空，立即生成并保存
 * - 确保 workspace 等视觉元素被正确序列化
 *
 * 触发条件：
 * - Canvas 实例已创建
 * - isCanvasReady = true（由 useCanvasDataLoad 设置到 Store）
 * - 当前页面的 json 字段为 null
 * - 本 Hook 尚未触发过
 *
 * 解决的问题：
 * - 新创建的空项目刷新后 workspace 的 JSON 数据没有被保存
 * - useCanvasThumbnail 只在 object:added/removed/modified 时触发
 * - 空项目没有对象操作，所以这些事件都没有触发
 *
 * 时序说明：
 * - 立即执行保存（无延迟），确保在 autoSave 的 200ms debounce 之前完成
 * - 这样 autoSave 触发时已经有完整的 JSON 和缩略图，避免发送两次请求
 *
 * Debug 信息：
 * - 开启方式：window.__FICVA_DEBUG__ = true; window.__FICVA_DEBUG_MODULES__.initialCanvasSave = true
 * - 输出内容：触发条件、保存时机、保存耗时
 */
"use client"

import { useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { debugInitialCanvasSave as debug } from "@/lib/editor/utils/debug"
import { findWorkspace } from "@/lib/editor/workspace"

/**
 * Hook: 初始化完成后主动保存 Canvas JSON
 *
 * 无需参数，从 Store 读取所有状态
 */
export function useInitialCanvasSave() {
  // 从 Store 读取状态
  const canvas = useEditorStore((s) => s.canvas)
  const isCanvasReady = useEditorStore((s) => s.isCanvasReady)
  const pages = useEditorStore((s) => s.pages)
  const activePageId = useEditorStore((s) => s.activePageId)
  const updatePage = useEditorStore((s) => s.updatePage)

  // 防止重复触发
  const hasTriggeredRef = useRef(false)
  // 跟踪上次的 projectId，用于项目切换时重置
  const lastProjectIdRef = useRef<string | null>(null)

  // 项目切换时重置触发状态
  const projectId = useEditorStore((s) => s.projectId)

  useEffect(() => {
    if (projectId !== lastProjectIdRef.current) {
      debug.info("Project changed, resetting trigger state", {
        from: lastProjectIdRef.current,
        to: projectId,
      })
      hasTriggeredRef.current = false
      lastProjectIdRef.current = projectId
    }
  }, [projectId])

  useEffect(() => {
    debug.group("useInitialCanvasSave Effect")
    debug.info("Effect triggered", {
      hasCanvas: !!canvas,
      isCanvasReady,
      activePageId,
      hasTriggered: hasTriggeredRef.current,
      pageCount: pages.length,
    })

    // 守卫条件 1: 必须有 canvas 和 activePageId
    if (!canvas || !activePageId) {
      debug.warn("Preconditions not met: missing canvas or activePageId")
      debug.groupEnd()
      return
    }

    // 守卫条件 2: 必须已完成初始化
    if (!isCanvasReady) {
      debug.info("Canvas not ready yet, waiting...")
      debug.groupEnd()
      return
    }

    // 守卫条件 3: 已经触发过
    if (hasTriggeredRef.current) {
      debug.info("Already triggered for this project, skipping")
      debug.groupEnd()
      return
    }

    // 查找当前页面
    const currentPage = pages.find((p) => p.id === activePageId)
    debug.info("Current page", {
      pageId: currentPage?.id,
      hasJson: currentPage?.json !== null,
      jsonKeys: currentPage?.json ? Object.keys(currentPage.json) : [],
    })

    // 守卫条件 4: 只在 JSON 为空时触发
    if (currentPage?.json !== null) {
      debug.info("Page already has JSON, skipping initial save")
      debug.groupEnd()
      return
    }

    // 标记已触发，防止重复执行
    debug.scenario("INITIAL_SAVE", "Page JSON is null, triggering initial save")
    hasTriggeredRef.current = true

    // 立即执行保存（不延迟，确保在 autoSave 的 200ms debounce 之前完成）
    debug.time("Initial Canvas Save")

    try {
      // 生成 JSON（包含自定义属性）
      const json = canvas.toObject([
        "id",
        "selectable",
        "name",
        "backgroundColor",
        "nodeModes",
        "customPathData",
        "isWorkspace", // workspace 对象标识，用于画布尺寸持久化
        "followTheme", // workspace 跟随主题标志
      ])

      // 补充 backgroundColor（如果未包含）
      if (!json.backgroundColor) {
        json.backgroundColor = canvas.backgroundColor
      }

      // 查找 workspace 获取边界框
      const workspace = findWorkspace(canvas)
      if (!workspace) {
        debug.warn("Workspace not found, skipping initial save")
        debug.groupEnd()
        return
      }

      // 生成缩略图 - 只截取 workspace 区域
      const thumbnail = canvas.toDataURL({
        format: "png",
        quality: 0.8,
        multiplier: 0.5,
        left: workspace.left,
        top: workspace.top,
        width: workspace.width,
        height: workspace.height,
      })

      // 更新 Store（这会触发 useAutoSave 保存到服务器）
      updatePage(activePageId, { json, thumbnail })

      debug.timeEnd("Initial Canvas Save")
      debug.success("Initial canvas state saved", {
        pageId: activePageId,
        objectCount: json.objects?.length || 0,
        hasThumbnail: !!thumbnail,
      })
      debug.health("healthy", "Initial save completed")
    } catch (error) {
      debug.timeEnd("Initial Canvas Save")
      debug.error("Failed to save initial canvas state", {
        error: error instanceof Error ? error.message : String(error),
      })
      debug.health("error", "Initial save failed")
    }

    debug.groupEnd()
  }, [canvas, isCanvasReady, activePageId, pages, updatePage])
}
