/**
 * useCanvasDataLoad - 画布数据加载 Hook
 *
 * 职责：
 * - 将页面数据加载到 Fabric.js 画布
 * - 处理异步加载流程
 * - 修复路径对象的自定义属性
 * - 同步图层面板
 *
 * 设计原则：
 * - 单一职责：只负责将数据加载到画布
 * - 封装复杂性：隐藏 loadFromJSON 的异步细节
 * - 安全检查：处理画布销毁情况
 *
 * Debug 信息：
 * - 开启方式：window.__FICVA_DEBUG__ = true; window.__FICVA_DEBUG_MODULES__.canvasDataLoad = true
 * - 输出内容：加载状态、页面数据、加载耗时、错误信息
 */
"use client"

import { useEffect, useRef } from "react"
import type { Canvas } from "fabric"
import type { Page } from "@/store/useEditorStore"
import { useEditorStore } from "@/store/useEditorStore"
import { fixPathObjectsAfterLoad } from "@/lib/editor/utils/CanvasUtils"
import { debugCanvasDataLoad as debug } from "@/lib/editor/utils/debug"

export interface UseCanvasDataLoadOptions {
  /** Fabric.js 画布实例 */
  canvas: Canvas | null
  /** 页面数据数组 */
  pages: Page[]
  /** 当前活动页面 ID */
  activePageId: string | null
  /** 项目 ID（用于检测项目切换） */
  projectId: string | null
}

export interface UseCanvasDataLoadResult {
  /** 画布是否已完成加载 */
  isCanvasReady: boolean
}

/**
 * 画布数据加载 Hook
 *
 * @param options - 加载选项
 * @returns 加载状态
 *
 * @example
 * ```tsx
 * const { isCanvasReady } = useCanvasDataLoad({
 *   canvas,
 *   pages: store.pages,
 *   activePageId: store.activePageId,
 *   projectId: store.projectId,
 * })
 *
 * if (!isCanvasReady) return <Loading />
 * ```
 */
export function useCanvasDataLoad({
  canvas,
  pages,
  activePageId,
  projectId,
}: UseCanvasDataLoadOptions): UseCanvasDataLoadResult {
  // 从 Store 读写 isCanvasReady 状态
  const isCanvasReady = useEditorStore((state) => state.isCanvasReady)
  const setIsCanvasReady = useEditorStore((state) => state.setIsCanvasReady)

  // 使用 ref 跟踪加载状态，避免重复加载
  const isLoadingRef = useRef(false)
  // 跟踪上一次加载的 activePageId，用于检测页面切换
  const lastLoadedPageIdRef = useRef<string | null>(null)

  // 从 Store 获取 syncLayers 方法
  const syncLayers = useEditorStore((state) => state.syncLayers)

  useEffect(() => {
    debug.group("useCanvasDataLoad Effect")
    debug.info("Effect triggered", {
      hasCanvas: !!canvas,
      pageCount: pages.length,
      activePageId,
      projectId,
      lastLoadedPageId: lastLoadedPageIdRef.current,
      isCurrentlyLoading: isLoadingRef.current,
      isCanvasReady,
    })

    // 前置条件检查：必须有画布、页面数据、活动页面 ID 和项目 ID
    if (!canvas || !pages.length || !activePageId || !projectId) {
      debug.warn("Preconditions not met, skipping load", {
        hasCanvas: !!canvas,
        pageCount: pages.length,
        hasActivePageId: !!activePageId,
        hasProjectId: !!projectId,
      })
      debug.health("warning", "Waiting for required dependencies")
      debug.groupEnd()
      return
    }

    // 避免重复加载同一页面
    if (lastLoadedPageIdRef.current === activePageId && isCanvasReady) {
      debug.info("Page already loaded, skipping", {
        pageId: activePageId,
      })
      debug.groupEnd()
      return
    }

    // 避免并发加载
    if (isLoadingRef.current) {
      debug.warn("Loading already in progress, skipping")
      debug.groupEnd()
      return
    }

    // 异步加载函数
    // 为什么使用 async 函数？避免在 effect 同步阶段调用 setState
    const loadCanvasData = async () => {
      // 修复：先清空 Canvas 上的用户对象（移除项目切换时的残留内容）
      // React 复用 FabricCanvas 组件，Canvas 实例不会随项目切换而销毁
      const objects = canvas.getObjects()
      objects.forEach((obj) => {
        // 保留工作区背景等特殊对象
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyObj = obj as any
        if (!anyObj.isCanvasBackground && !anyObj.excludeFromExport) {
          canvas.remove(obj)
        }
      })
      canvas.requestRenderAll()
      debug.info("Canvas cleared before loading", {
        removedCount: objects.length,
      })

      // 找到当前活动页面
      const activePage = pages.find((p) => p.id === activePageId) || pages[0]

      if (!activePage) {
        debug.error("No active page found")
        debug.health("error", "Cannot find active page in pages array")
        setIsCanvasReady(true)
        return
      }

      debug.info("Active page found", {
        pageId: activePage.id,
        hasJson: !!activePage.json,
        jsonKeys: activePage.json ? Object.keys(activePage.json) : [],
      })

      // 如果页面没有 JSON 数据，直接标记为就绪
      if (!activePage.json || Object.keys(activePage.json).length === 0) {
        debug.scenario("EMPTY_PAGE", "Page has no JSON data, marking as ready")
        lastLoadedPageIdRef.current = activePageId
        setIsCanvasReady(true)
        debug.health("healthy", "Empty page ready")
        return
      }

      // 开始加载
      isLoadingRef.current = true
      debug.scenario(
        "LOAD_PAGE",
        `Loading canvas data for page: ${activePageId}`
      )
      debug.time("Canvas Load Duration")

      // 分析要加载的 JSON 内容
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageJson = activePage.json as any
      debug.info("JSON content analysis", {
        version: pageJson.version,
        objectCount: pageJson.objects?.length || 0,
        backgroundColor: pageJson.backgroundColor,
        hasObjects: Array.isArray(pageJson.objects),
      })

      if (pageJson.objects && pageJson.objects.length > 0) {
        debug.table(
          pageJson.objects.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (obj: any, idx: number) => ({
              index: idx,
              type: obj.type,
              name: obj.name || "unnamed",
              visible: obj.visible !== false,
            })
          )
        )
      }

      try {
        await canvas.loadFromJSON(activePage.json)

        // 检查画布是否已被销毁（用户可能在加载过程中离开页面）
        if (!canvas.getElement()) {
          debug.warn("Canvas was disposed during loading")
          debug.health(
            "warning",
            "Canvas disposed - component may have unmounted"
          )
          return
        }

        debug.timeEnd("Canvas Load Duration")
        debug.success("JSON loaded into canvas")

        // 修复路径对象的自定义属性
        // 为什么需要？Fabric.js 的 loadFromJSON 不会自动恢复我们的自定义 pathData
        debug.info("Fixing path objects after load")
        fixPathObjectsAfterLoad(canvas)

        // 请求重新渲染
        canvas.requestRenderAll()
        debug.info("Canvas render requested")

        // 同步图层面板
        syncLayers(canvas)
        debug.info("Layers synced to panel")

        // 获取加载后的画布状态
        const objects = canvas.getObjects()
        debug.success("Canvas data loaded successfully", {
          pageId: activePageId,
          objectCount: objects.length,
          objectTypes: objects.map((o) => o.type),
        })

        // 更新状态
        lastLoadedPageIdRef.current = activePageId
        setIsCanvasReady(true)

        debug.health(
          "healthy",
          `Page ${activePageId} loaded with ${objects.length} objects`
        )
      } catch (error) {
        debug.timeEnd("Canvas Load Duration")
        debug.error("Failed to load canvas data", {
          error: error instanceof Error ? error.message : String(error),
        })
        debug.health(
          "error",
          `Load failed: ${error instanceof Error ? error.message : "Unknown error"}`
        )
        // 即使加载失败也标记为就绪，避免无限加载状态
        setIsCanvasReady(true)
      } finally {
        isLoadingRef.current = false
        debug.info("Loading flag reset")
      }
    }

    loadCanvasData()
    debug.groupEnd()
  }, [
    canvas,
    pages,
    activePageId,
    projectId,
    syncLayers,
    isCanvasReady,
    setIsCanvasReady,
  ])

  // 当项目切换时重置状态
  useEffect(() => {
    debug.info("Project ID effect", { projectId })

    // 项目 ID 变化时，重置加载状态
    return () => {
      debug.info("Cleanup: resetting state for project switch")
      lastLoadedPageIdRef.current = null
      setIsCanvasReady(false)
    }
  }, [projectId, setIsCanvasReady])

  // 输出当前状态
  debug.stateChange("useCanvasDataLoad result", null, {
    isCanvasReady,
    lastLoadedPageId: lastLoadedPageIdRef.current,
  })

  return { isCanvasReady }
}
