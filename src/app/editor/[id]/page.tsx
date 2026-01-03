/**
 * 编辑器主页面组件（模块化重构版）
 *
 * 职责：
 * 1. 协调各模块完成项目数据的获取、冲突解决、画布加载
 * 2. 将最终状态传递给布局组件
 *
 * 模块依赖：
 * - useProjectDataFetch: 从服务器获取项目数据
 * - resolveConflict: 冲突解决纯函数
 * - useCanvasDataLoad: 将数据加载到画布
 * - EditorLayout: 纯展示布局组件
 *
 * 数据流：
 * 1. useProjectDataFetch 获取服务器数据
 * 2. resolveConflict 决定使用本地还是服务器数据
 * 3. 更新 Store 状态
 * 4. useCanvasDataLoad 将数据加载到画布
 * 5. EditorLayout 渲染界面
 *
 * Debug 信息：
 * - 开启方式：window.__FICVA_DEBUG__ = true; window.__FICVA_DEBUG_MODULES__.editorPage = true
 * - 输出内容：页面生命周期、模块协调、场景判断、健康状态总览
 */
"use client"

import { useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"

import { useEditorStore } from "@/store/useEditorStore"
import { useProjectDataFetch } from "@/hooks/useProjectDataFetch"
import { useCanvasDataLoad } from "@/hooks/useCanvasDataLoad"
import {
  resolveConflict,
  type LocalStorageData,
} from "@/lib/editor/utils/conflictResolution"
import { loadFromLocalStorage, saveToLocalStorage } from "@/utils/storage"
import { EditorLayout } from "@/components/editor/EditorLayout"
import {
  debugEditorPage as debug,
  initDebugUtils,
} from "@/lib/editor/utils/debug"

export default function EditorPage() {
  // 初始化调试工具（只在客户端执行一次）
  useEffect(() => {
    initDebugUtils()
    debug.group("EditorPage Mounted")
    debug.info("Debug system initialized")
    debug.info("To enable debug output, run in console:")
    debug.info("  __FICVA_DEBUG_UTILS__.enableAll()")
    debug.groupEnd()
  }, [])

  // 获取当前用户 ID
  const { data: session } = useSession()
  const userId = session?.user?.id

  // 从 URL 获取项目 ID
  const params = useParams()
  const projectId = typeof params.id === "string" ? params.id : undefined

  debug.group("EditorPage Render")
  debug.info("URL params", { id: params.id, projectId })

  // 从 Store 获取状态
  const canvas = useEditorStore((s) => s.canvas)
  const storeProjectId = useEditorStore((s) => s.projectId)
  const pages = useEditorStore((s) => s.pages)
  const activePageId = useEditorStore((s) => s.activePageId)

  debug.info("Store state", {
    hasCanvas: !!canvas,
    storeProjectId,
    pageCount: pages.length,
    activePageId,
  })

  // 跟踪是否已初始化，避免重复执行冲突解决
  const isInitializedRef = useRef(false)

  // 1. 获取项目数据
  debug.info("Step 1: Fetching project data...")
  const { projectData, isLoading, error } = useProjectDataFetch(projectId)

  debug.info("Fetch result", {
    hasData: !!projectData,
    isLoading,
    hasError: !!error,
    errorMessage: error?.message,
  })

  // 2. 冲突解决 + 初始化 Store
  useEffect(() => {
    debug.group("Step 2: Conflict Resolution Effect")
    debug.info("Effect triggered", {
      hasProjectData: !!projectData,
      projectId,
      storeProjectId,
      pageCount: pages.length,
      isInitialized: isInitializedRef.current,
    })

    if (!projectData || !projectId || !userId) {
      debug.warn("Missing required data, skipping conflict resolution", {
        hasProjectData: !!projectData,
        hasProjectId: !!projectId,
        hasUserId: !!userId,
      })
      debug.groupEnd()
      return
    }

    // 场景 1: 重新挂载检测
    // 如果 Store 中已有当前项目的数据，说明是重新挂载，直接使用 Store 数据
    if (storeProjectId === projectData.id && pages.length > 0) {
      debug.scenario(
        "REMOUNT",
        "Store already has data for this project - likely a remount"
      )
      debug.info("Remount details", {
        storeProjectId,
        projectDataId: projectData.id,
        storedPageCount: pages.length,
      })
      debug.health("healthy", "Using existing Store data (remount scenario)")
      isInitializedRef.current = true
      debug.groupEnd()
      return
    }

    // 避免重复初始化
    if (isInitializedRef.current && storeProjectId === projectData.id) {
      debug.info("Already initialized for this project, skipping")
      debug.groupEnd()
      return
    }

    // 场景 2-4: 首次加载或切换项目
    debug.scenario(
      "FIRST_LOAD",
      "First time loading this project - need conflict resolution"
    )

    // 从本地存储加载数据（用于冲突解决）
    debug.info("Loading local storage data...")
    const localData = loadFromLocalStorage(
      userId,
      projectId
    ) as LocalStorageData | null
    debug.info("Local storage result", {
      hasLocalData: !!localData,
      localTimestamp: localData
        ? new Date(localData.timestamp).toISOString()
        : null,
      localUnsavedChanges: localData?.unsavedChanges,
    })

    // 执行冲突解决
    debug.info("Executing conflict resolution...")
    const resolved = resolveConflict({
      serverData: projectData,
      localData,
    })

    debug.success("Conflict resolution complete", {
      source: resolved.source,
      pageCount: resolved.pages.length,
      activePageId: resolved.activePageId,
      shouldSyncToLocal: resolved.shouldSyncToLocal,
    })

    // 更新 Store 状态
    debug.info("Updating Store state...")
    useEditorStore.setState({
      pages: resolved.pages,
      activePageId: resolved.activePageId,
      projectName: resolved.projectName,
      projectId: projectData.id,
    })
    debug.success("Store updated")

    // 如果使用服务器数据，同步到本地存储
    if (resolved.shouldSyncToLocal) {
      debug.info("Syncing to local storage (server data was newer)...")
      saveToLocalStorage(
        userId,
        projectId,
        {
          pages: resolved.pages,
          activePageId: resolved.activePageId,
          projectName: resolved.projectName,
        },
        false // 没有未保存的更改
      )
      debug.success("Local storage synced")
    }

    isInitializedRef.current = true
    debug.health("healthy", "Project initialized successfully")
    debug.groupEnd()
  }, [projectData, projectId, storeProjectId, pages.length, userId])

  // 3. 加载数据到画布
  debug.info("Step 3: Loading data to canvas...")
  // 调用 hook 触发加载逻辑
  useCanvasDataLoad({
    canvas,
    pages,
    activePageId,
    projectId: storeProjectId,
  })

  // 从 Store 读取 isCanvasReady（已由 useCanvasDataLoad 内部设置）
  const isCanvasReady = useEditorStore((s) => s.isCanvasReady)

  debug.info("Canvas load result", { isCanvasReady })
  debug.groupEnd()

  // 输出健康状态总览（在 effect 中访问 ref，避免 render 期间访问）
  useEffect(() => {
    const healthStatus = {
      projectDataFetch: {
        status: error ? "error" : isLoading ? "loading" : "healthy",
        detail: error?.message || (isLoading ? "Fetching..." : "OK"),
      },
      conflictResolution: {
        status: isInitializedRef.current ? "healthy" : "pending",
        detail: isInitializedRef.current ? "Resolved" : "Waiting for data",
      },
      canvasDataLoad: {
        status: isCanvasReady ? "healthy" : "loading",
        detail: isCanvasReady ? "Ready" : "Loading...",
      },
      overall: {
        status: error
          ? "error"
          : !isLoading && isInitializedRef.current && isCanvasReady
            ? "healthy"
            : "loading",
      },
    }

    debug.info("Health Status Overview")
    debug.table(healthStatus)
  }, [error, isLoading, isCanvasReady])

  // 4. 渲染布局
  return (
    <EditorLayout
      isLoading={isLoading || !projectData}
      isCanvasReady={isCanvasReady}
    />
  )
}
