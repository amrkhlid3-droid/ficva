/**
 * useAutoSave - 自动保存 Hook
 *
 * 【核心职责】
 * 这个 Hook 负责将编辑器中的项目数据自动保存到两个地方：
 * 1. LocalStorage（本地存储）- 立即保存，用于离线恢复和页面刷新恢复
 * 2. Server（服务器）- 防抖保存（200ms），用于持久化存储
 *
 * 【设计原理】
 * 采用"双写"策略确保数据安全：
 * - L1 缓存：Zustand Store（内存，最快，但刷新即失）
 * - L2 缓存：LocalStorage（本地，快速，可离线恢复）
 * - L3 持久化：Server/Database（远程，最可靠，需要网络）
 *
 * 【触发条件】
 * 当以下任何一个值发生变化时，自动保存会被触发：
 * - pages：页面数组（包含每个页面的 JSON 数据）
 * - activePageId：当前活动页面的 ID
 * - projectName：项目名称
 *
 * 【防抖机制】
 * 为什么需要防抖？
 * - 用户在画布上拖动对象时，会频繁触发 pages 更新（每帧都可能更新）
 * - 如果每次更新都发送请求，会导致：
 *   1. 服务器压力过大
 *   2. 网络请求堆积
 *   3. 可能的竞态条件（后发请求先到达）
 * - 200ms 防抖意味着：用户停止操作 200ms 后才发送请求
 *
 * 【保存状态】
 * - "saved"：已保存，所有更改都已同步到服务器
 * - "saving"：保存中，正在发送请求
 * - "error"：保存失败，请求出错
 * - "unsaved"：有未保存的更改（保留状态，未使用）
 */

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useEditorStore } from "@/store/useEditorStore"
import { debugAutoSave as debug } from "@/lib/editor/utils/debug"

/**
 * 保存状态类型
 * 用于 UI 显示当前保存状态（如 Header 中的保存指示器）
 */
export type SaveStatus = "saved" | "saving" | "error" | "unsaved"

/**
 * 自动保存 Hook
 *
 * @returns {Object} 包含 status 字段的对象，表示当前保存状态
 *
 * @example
 * ```tsx
 * function Header() {
 *   const { status } = useAutoSave()
 *
 *   return (
 *     <div>
 *       {status === 'saving' && <Spinner />}
 *       {status === 'saved' && <CheckIcon />}
 *       {status === 'error' && <ErrorIcon />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAutoSave() {
  // ============================================================================
  // 状态定义
  // ============================================================================

  /**
   * 保存状态
   * 初始值为 "saved"，因为刚加载时没有未保存的更改
   */
  const [status, setStatus] = useState<SaveStatus>("saved")

  /**
   * 获取当前用户 ID（用于 localStorage 隔离）
   */
  const { data: session } = useSession()
  const userId = session?.user?.id

  /**
   * 从 Zustand Store 订阅需要监听的数据
   *
   * 为什么使用解构而不是 selector？
   * - 这些值都需要在 useEffect 依赖数组中使用
   * - 使用 selector 会导致每次渲染创建新引用
   */
  const { pages, activePageId, projectId, projectName } = useEditorStore()

  // ============================================================================
  // Refs（不触发重渲染的状态）
  // ============================================================================

  /**
   * 是否已完成首次加载的标志
   *
   * 为什么需要这个 ref？
   * - 防止初始加载时触发保存
   * - 当 pages 从服务器加载到 Store 时，会触发 useEffect
   * - 但此时不应该保存，因为数据本来就来自服务器
   * - 只有用户真正修改后，才应该触发保存
   */
  const isLoadedRef = useRef(false)

  /**
   * 防抖定时器引用
   *
   * 为什么使用 ref 而不是 state？
   * - 定时器 ID 的变化不需要触发重渲染
   * - 使用 ref 可以在 cleanup 函数中访问最新值
   */
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 上次 LocalStorage 保存时间
   *
   * 为什么需要这个 ref？
   * - React Strict Mode 下，Effect 会同步执行两次
   * - 第一次执行后立即 cleanup，然后再执行第二次
   * - 使用时间戳可以检测到短时间内的重复调用并跳过
   * - 100ms 阈值足够过滤 Strict Mode 的重复调用，同时不影响正常的连续保存
   */
  const lastLocalSaveTimeRef = useRef<number>(0)

  /**
   * 上次保存的数据快照（用于检测真正的变化）
   *
   * 为什么需要这个 ref？
   * - REMOUNT 场景下，Effect 会被触发但数据没有真正变化
   * - 通过比较 JSON 快照可以避免不必要的保存
   * - 只有当数据真正变化时才执行保存操作
   */
  const lastSavedDataRef = useRef<string | null>(null)

  /**
   * 跟踪上次的 projectId，用于检测项目切换
   */
  const lastProjectIdRef = useRef<string | null>(null)

  // ============================================================================
  // Effect 0: 项目切换时重置状态（防止数据泄漏）
  // ============================================================================

  /**
   * 当 projectId 变化时，重置所有状态
   *
   * 为什么需要这个 effect？
   * - 防止旧项目的 pending 防抖定时器污染新项目
   * - 重置加载状态，确保新项目需要重新完成加载标记
   * - 清除旧项目的数据快照
   */
  useEffect(() => {
    if (projectId !== lastProjectIdRef.current) {
      debug.info("Project changed, resetting auto-save state", {
        from: lastProjectIdRef.current,
        to: projectId,
      })

      // 清除旧项目的 pending 防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
        debug.info("Cleared pending debounce timer from previous project")
      }

      // 重置加载状态
      isLoadedRef.current = false

      // 清除旧项目的数据快照
      lastSavedDataRef.current = null

      // 更新 projectId 跟踪
      lastProjectIdRef.current = projectId
    }
  }, [projectId])

  // ============================================================================
  // Effect 1: 初始化标记
  // ============================================================================

  /**
   * 监听 pages 变化，标记首次加载完成
   *
   * 【执行时机】
   * - 组件挂载时（pages 可能为空数组）
   * - pages 从服务器加载到 Store 时
   *
   * 【逻辑说明】
   * - 当 pages.length > 0 且 isLoadedRef.current === false 时
   * - 说明这是首次加载完成，设置标志为 true
   * - 之后的 pages 变化才会触发保存
   */
  useEffect(() => {
    if (pages.length > 0 && !isLoadedRef.current) {
      isLoadedRef.current = true
      debug.info("Initial load complete, auto-save enabled", {
        pageCount: pages.length,
        projectId,
      })
    }
  }, [pages, projectId])

  // ============================================================================
  // Effect 2: 核心保存逻辑
  // ============================================================================

  /**
   * 监听数据变化，执行保存操作
   *
   * 【触发条件】
   * - pages、activePageId、projectName、projectId 任一变化
   * - 且 isLoadedRef.current === true（已完成首次加载）
   * - 且 projectId 存在（项目已创建）
   */
  useEffect(() => {
    // 守卫条件：未完成首次加载、没有项目 ID 或没有用户 ID
    if (!isLoadedRef.current || !projectId || !userId) {
      debug.info("Skipping save", {
        reason: !isLoadedRef.current
          ? "Initial load not complete"
          : !projectId
            ? "No projectId"
            : "No userId",
      })
      return
    }

    // ========================================================================
    // 数据变化检测（避免 REMOUNT 场景的无效保存）
    // ========================================================================

    /**
     * 创建数据快照用于比较
     * 只包含会影响保存的关键字段，排除 thumbnail（因为它可能因渲染而变化）
     */
    const currentDataSnapshot = JSON.stringify({
      projectId,
      projectName,
      activePageId,
      // 只比较页面的 id 和 json，不比较 thumbnail
      pages: pages.map((p) => ({ id: p.id, json: p.json })),
    })

    // 如果数据没有真正变化，跳过保存
    if (lastSavedDataRef.current === currentDataSnapshot) {
      debug.info("Skipping save (data unchanged)", {
        projectId,
        reason: "Data snapshot matches previous save",
      })
      return
    }

    // 更新快照（在确认要保存后立即更新，防止后续重复触发）
    lastSavedDataRef.current = currentDataSnapshot

    debug.group("Auto Save Triggered")
    debug.info("Data changed, preparing to save", {
      projectId,
      projectName,
      pageCount: pages.length,
      activePageId,
    })

    // ========================================================================
    // 步骤 1: 立即保存到 LocalStorage（L2 缓存）
    // ========================================================================

    /**
     * 为什么立即保存到 LocalStorage？
     * - 防止浏览器崩溃或意外关闭时丢失数据
     * - LocalStorage 写入是同步的，速度很快
     * - 作为服务器保存的备份
     *
     * 为什么使用动态 import？
     * - 避免循环依赖
     * - 按需加载，减少初始 bundle 大小
     */
    /**
     * LocalStorage 保存（带重复调用检测）
     *
     * 使用 lastLocalSaveTimeRef 检测 React Strict Mode 下的重复调用：
     * - Strict Mode 会同步执行 Effect 两次（间隔 < 1ms）
     * - 100ms 阈值可以过滤这种重复调用
     * - 正常用户操作间隔通常 > 100ms，不会被误过滤
     */
    const now = Date.now()
    const timeSinceLastSave = now - lastLocalSaveTimeRef.current

    if (timeSinceLastSave < 100) {
      debug.info("Skipping LocalStorage save (duplicate call)", {
        timeSinceLastSave,
        threshold: 100,
      })
    } else {
      lastLocalSaveTimeRef.current = now
      const timerId = `LocalStorage Save ${now}`

      debug.time(timerId)
      import("@/utils/storage").then(({ saveToLocalStorage }) => {
        saveToLocalStorage(
          userId,
          projectId,
          {
            pages,
            activePageId,
            projectName,
          },
          true
        )
        debug.timeEnd(timerId)
        debug.success("Saved to LocalStorage", {
          projectId,
          userId,
          unsavedChanges: true,
        })
      })
    }

    // 更新状态为"保存中"
    setStatus("saving")

    // ========================================================================
    // 步骤 2: 防抖保存到服务器（L3 持久化）
    // ========================================================================

    /**
     * 服务器保存函数
     *
     * 【请求体结构】
     * {
     *   json: { pages, activePageId },  // 项目完整数据
     *   name: projectName,               // 项目名称
     *   thumbnailUrl: coverThumbnail,    // 封面缩略图（第一页）
     *   updatedAt: new Date(),           // 更新时间戳
     * }
     *
     * 【为什么使用 PATCH 而不是 PUT？】
     * - PATCH 表示部分更新，只更新提供的字段
     * - PUT 表示完全替换，需要提供完整资源
     * - 我们只更新变化的字段，所以用 PATCH
     */
    const saveToServer = async () => {
      debug.time("Server Save")
      debug.info("Sending PATCH request to server")

      try {
        // 获取封面页（第一页）的缩略图作为项目封面
        const coverPage = pages[0]
        const projectThumbnail = coverPage?.thumbnail || null

        const body = {
          json: { pages, activePageId },
          name: projectName,
          thumbnailUrl: projectThumbnail,
          updatedAt: new Date(),
        }

        debug.info("Request body", {
          pagesCount: pages.length,
          hasThumnail: !!projectThumbnail,
          projectName,
        })

        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        debug.timeEnd("Server Save")

        if (res.ok) {
          setStatus("saved")
          debug.success("Server save successful", { status: res.status })

          // 保存成功后，更新 LocalStorage 的 unsavedChanges 标志为 false
          // 这表示本地数据与服务器同步
          import("@/utils/storage").then(({ saveToLocalStorage }) => {
            saveToLocalStorage(
              userId,
              projectId,
              { pages, activePageId, projectName },
              false // unsavedChanges = false
            )
            debug.info("LocalStorage unsavedChanges flag cleared")
          })

          debug.health("healthy", "All data synced to server")
        } else {
          setStatus("error")
          debug.error("Server save failed", {
            status: res.status,
            statusText: res.statusText,
          })
          debug.health("error", `Server returned ${res.status}`)
        }
      } catch (e) {
        console.error("Server save failed", e)
        setStatus("error")
        debug.error("Server save exception", {
          error: e instanceof Error ? e.message : String(e),
        })
        debug.health("error", "Network or server error")
      }

      debug.groupEnd()
    }

    // ========================================================================
    // 防抖实现
    // ========================================================================

    /**
     * 防抖逻辑说明：
     *
     * 1. 如果已有定时器，先清除（重置计时）
     * 2. 设置新的定时器，200ms 后执行保存
     * 3. 如果 200ms 内再次触发，回到步骤 1
     *
     * 【视觉表示】
     * 用户操作：  ─●──●──●──●──────────────────●──●───────
     * 防抖效果：  ─────────────────●───────────────────●──
     *                           ↑ 200ms后        ↑ 200ms后
     *
     * 这样可以将多次快速操作合并为一次保存
     */

    // 清除之前的定时器（如果有）
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debug.info("Previous debounce timer cleared")
    }

    // 设置新的定时器，200ms 后执行保存
    debounceTimerRef.current = setTimeout(() => {
      debug.info("Debounce timer fired (200ms elapsed)")
      saveToServer()
    }, 200)

    debug.info("Debounce timer set (200ms)")

    // ========================================================================
    // Cleanup 函数
    // ========================================================================

    /**
     * 为什么需要 cleanup？
     * - 组件卸载时，取消未执行的定时器
     * - 避免对已卸载组件调用 setState（导致内存泄漏警告）
     * - 依赖变化时，先清理旧的 effect 再执行新的
     */
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debug.info("Cleanup: debounce timer cancelled")
      }
    }
  }, [pages, activePageId, projectName, projectId, userId])

  // ============================================================================
  // 返回值
  // ============================================================================

  /**
   * 返回保存状态供 UI 使用
   * 可以在 Header 等组件中显示保存状态指示器
   */
  return { status }
}
