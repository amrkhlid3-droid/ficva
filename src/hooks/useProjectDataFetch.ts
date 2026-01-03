/**
 * useProjectDataFetch - 项目数据获取 Hook
 *
 * 职责：
 * - 从服务器获取项目数据
 * - 同步项目名称到 Store
 * - 管理加载和错误状态
 *
 * 设计原则：
 * - 单一职责：只负责数据获取，不处理数据加载到画布
 * - 可测试：独立的数据获取逻辑
 * - 可复用：可在其他需要获取项目数据的页面使用
 *
 * Debug 信息：
 * - 开启方式：window.__FICVA_DEBUG__ = true; window.__FICVA_DEBUG_MODULES__.projectDataFetch = true
 * - 输出内容：请求状态、响应数据、错误信息、健康状态
 */
"use client"

import { useEffect, useState } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { debugProjectDataFetch as debug } from "@/lib/editor/utils/debug"

/**
 * 项目数据接口
 *
 * 为什么需要 updatedAt？
 * - 用于冲突解决：比较服务器数据和本地存储数据的时间戳
 * - 当用户离线编辑后重新上线时，需要判断使用哪份数据
 */
export interface ProjectData {
  id: string
  name: string
  json: Record<string, unknown> // 画布内容，可能是多页面结构或旧版单页面结构
  updatedAt?: string // 服务器端最后更新时间
}

export interface UseProjectDataFetchResult {
  /** 获取到的项目数据，未加载完成时为 null */
  projectData: ProjectData | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 加载错误，无错误时为 null */
  error: Error | null
}

/**
 * 从服务器获取项目数据的 Hook
 *
 * @param projectId - 项目 ID，可以是字符串或字符串数组（Next.js 动态路由参数）
 * @returns 项目数据、加载状态和错误信息
 *
 * @example
 * ```tsx
 * const params = useParams()
 * const { projectData, isLoading, error } = useProjectDataFetch(params.id)
 *
 * if (isLoading) return <Loading />
 * if (error) return <Error message={error.message} />
 * if (!projectData) return null
 *
 * // 使用 projectData...
 * ```
 */
export function useProjectDataFetch(
  projectId: string | string[] | undefined
): UseProjectDataFetchResult {
  // 项目数据状态：从服务器获取的原始数据
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  // 加载状态 - 初始为 true，因为会立即开始加载
  const [isLoading, setIsLoading] = useState(true)
  // 错误状态
  const [error, setError] = useState<Error | null>(null)

  // 从 Store 获取 setProjectName 方法
  // 为什么在这里同步项目名称？
  // - Header 组件需要显示项目名称
  // - 数据获取后立即同步，保证 UI 一致性
  const setProjectName = useEditorStore((state) => state.setProjectName)

  useEffect(() => {
    debug.group("useProjectDataFetch Effect")
    debug.info("Effect triggered", { projectId })

    // 参数验证：projectId 必须是有效的字符串
    if (!projectId || Array.isArray(projectId)) {
      debug.warn("Invalid projectId, skipping fetch", { projectId })
      debug.health("warning", "No valid projectId provided")
      setIsLoading(false)
      debug.groupEnd()
      return
    }

    debug.info("Starting fetch for project", { projectId })
    debug.time("Fetch Duration")

    // 使用 AbortController 支持取消请求
    const abortController = new AbortController()
    let isMounted = true

    const fetchData = async () => {
      try {
        debug.info("Sending API request", {
          url: `/api/projects/${projectId}`,
        })

        const res = await fetch(`/api/projects/${projectId}`, {
          signal: abortController.signal,
        })

        debug.info("API response received", {
          status: res.status,
          ok: res.ok,
        })

        if (!res.ok) {
          throw new Error(`Failed to load project (HTTP ${res.status})`)
        }

        const data: ProjectData = await res.json()

        if (isMounted) {
          debug.timeEnd("Fetch Duration")
          debug.success("Project data fetched successfully")
          debug.info("Project data details", {
            id: data.id,
            name: data.name,
            hasJson: !!data.json,
            jsonKeys: data.json ? Object.keys(data.json) : [],
            updatedAt: data.updatedAt,
          })

          // 分析 JSON 结构
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = data.json as any
          if (json?.pages) {
            debug.info("JSON structure: Multi-page", {
              pageCount: json.pages.length,
              activePageId: json.activePageId,
            })
          } else if (json && Object.keys(json).length > 0) {
            debug.info("JSON structure: Legacy single-page", {
              hasObjects: !!json.objects,
              objectCount: json.objects?.length,
            })
          } else {
            debug.info("JSON structure: Empty project")
          }

          setProjectData(data)
          setProjectName(data.name || "Untitled Design")
          setIsLoading(false)

          debug.health("healthy", "Data fetch completed successfully")
        }
      } catch (err) {
        if (isMounted && err instanceof Error && err.name !== "AbortError") {
          debug.timeEnd("Fetch Duration")
          debug.error("Fetch failed", {
            message: err.message,
            name: err.name,
          })
          debug.health("error", `Fetch error: ${err.message}`)
          setError(err)
          setIsLoading(false)
        } else if (err instanceof Error && err.name === "AbortError") {
          debug.info("Fetch aborted (component unmounted)")
        }
      }
    }

    fetchData()

    debug.groupEnd()

    return () => {
      debug.info("Cleanup: aborting pending request")
      isMounted = false
      abortController.abort()
    }
  }, [projectId, setProjectName])

  // 输出最终状态
  debug.stateChange("useProjectDataFetch result", null, {
    hasData: !!projectData,
    isLoading,
    hasError: !!error,
  })

  return { projectData, isLoading, error }
}
