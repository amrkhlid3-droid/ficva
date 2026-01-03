/**
 * conflictResolution - 冲突解决纯函数模块
 *
 * 职责：
 * - 比较本地存储与服务器数据的时间戳
 * - 决定使用本地数据还是服务器数据
 * - 统一处理多页面和旧版单页面数据结构
 *
 * 设计原则：
 * - 纯函数：无副作用，输入确定则输出确定
 * - 单一职责：只负责冲突解决决策，不执行任何 IO 操作
 * - 可测试：输入输出明确，便于单元测试
 *
 * Debug 信息：
 * - 开启方式：window.__FICVA_DEBUG__ = true; window.__FICVA_DEBUG_MODULES__.conflictResolution = true
 * - 输出内容：场景判断、时间戳比较、最终决策、数据来源
 */

import type { Page } from "@/store/useEditorStore"
import type { ProjectData } from "@/hooks/useProjectDataFetch"
import { debugConflictResolution as debug } from "@/lib/editor/utils/debug"

/**
 * 本地存储数据结构
 * 与 @/utils/storage 中的 LocalStorageData 保持一致
 */
export interface LocalStorageData {
  timestamp: number
  version: number
  unsavedChanges: boolean
  data: {
    pages: Page[]
    activePageId: string
    projectName: string
  }
}

/**
 * 冲突解决输入参数
 */
export interface ConflictResolutionInput {
  /** 服务器返回的项目数据 */
  serverData: ProjectData
  /** 本地存储的数据，可能为 null（无本地缓存） */
  localData: LocalStorageData | null
}

/**
 * 冲突解决结果
 */
export interface ConflictResolutionResult {
  /** 最终使用的页面数据 */
  pages: Page[]
  /** 最终使用的活动页面 ID */
  activePageId: string
  /** 最终使用的项目名称 */
  projectName: string
  /** 数据来源：'server' | 'local' | 'empty' */
  source: "server" | "local" | "empty"
  /** 是否需要同步本地存储（当使用服务器数据时需要更新本地） */
  shouldSyncToLocal: boolean
}

/**
 * 判断服务器数据是否为多页面结构
 */
function isMultiPageData(
  json: Record<string, unknown>
): json is { pages: Page[]; activePageId?: string } {
  return (
    json !== null &&
    typeof json === "object" &&
    "pages" in json &&
    Array.isArray(json.pages) &&
    json.pages.length > 0
  )
}

/**
 * 判断服务器数据是否为旧版单页面结构（Fabric.js 直接导出的 JSON）
 */
function isLegacySinglePageData(json: Record<string, unknown>): boolean {
  return (
    json !== null &&
    typeof json === "object" &&
    Object.keys(json).length > 0 &&
    !("pages" in json)
  )
}

/**
 * 比较时间戳，判断本地数据是否更新
 *
 * 冲突解决策略：
 * - 条件1：本地有未保存的更改 (unsavedChanges)
 * - 条件2：本地数据比服务器数据更新 (localTime > serverTime)
 * - 两个条件都满足时，使用本地数据
 *
 * 为什么两个条件都需要？
 * - 只有 unsavedChanges：可能是很久以前的未保存更改，服务器数据可能已更新
 * - 只有时间戳更新：可能只是本地时间戳更新但没有实际更改
 */
function shouldUseLocalData(
  localData: LocalStorageData,
  serverUpdatedAt: string | undefined
): boolean {
  const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0
  const localTime = localData.timestamp

  debug.info("Comparing timestamps", {
    serverTime,
    localTime,
    serverDate: serverUpdatedAt
      ? new Date(serverUpdatedAt).toISOString()
      : "N/A",
    localDate: new Date(localTime).toISOString(),
    difference: `${((localTime - serverTime) / 1000).toFixed(1)}s`,
  })

  debug.info("Local data flags", {
    unsavedChanges: localData.unsavedChanges,
    isLocalNewer: localTime > serverTime,
  })

  const useLocal = localData.unsavedChanges && localTime > serverTime

  debug.info("Decision", {
    useLocalData: useLocal,
    reason: useLocal
      ? "Local has unsaved changes AND is newer"
      : !localData.unsavedChanges
        ? "No unsaved changes in local"
        : "Server data is newer or equal",
  })

  return useLocal
}

/**
 * 冲突解决主函数
 *
 * 处理以下场景：
 * 1. 多页面项目 + 本地更新 → 使用本地数据
 * 2. 多页面项目 + 服务器更新 → 使用服务器数据
 * 3. 旧版单页面项目 → 转换为多页面结构
 * 4. 空项目 → 初始化默认空白页面
 *
 * @param input - 服务器数据和本地数据
 * @returns 冲突解决结果
 */
export function resolveConflict(
  input: ConflictResolutionInput
): ConflictResolutionResult {
  const { serverData, localData } = input
  const json = serverData.json

  debug.group("resolveConflict")
  debug.info("Input received", {
    projectId: serverData.id,
    projectName: serverData.name,
    hasLocalData: !!localData,
    serverUpdatedAt: serverData.updatedAt,
  })

  if (localData) {
    debug.info("Local data details", {
      timestamp: new Date(localData.timestamp).toISOString(),
      unsavedChanges: localData.unsavedChanges,
      pageCount: localData.data.pages?.length,
      activePageId: localData.data.activePageId,
    })
  }

  // 场景 1: 多页面项目（新结构）
  if (isMultiPageData(json)) {
    debug.scenario(
      "MULTI_PAGE",
      "Server data contains pages array - using multi-page flow"
    )
    debug.info("Multi-page structure detected", {
      pageCount: json.pages.length,
      activePageId: json.activePageId,
      pageIds: json.pages.map((p) => p.id),
    })

    // 默认使用服务器数据
    // 注意：isMultiPageData 已确保 pages 非空数组，所以 pages[0] 一定存在
    // 使用 ! 断言，因为 TypeScript 无法从类型守卫中推断数组长度
    const firstPage = json.pages[0]!
    let result: ConflictResolutionResult = {
      pages: json.pages,
      activePageId: json.activePageId || firstPage.id,
      projectName: serverData.name,
      source: "server",
      shouldSyncToLocal: true, // 需要同步到本地
    }

    // 如果本地有数据，进行冲突解决
    if (localData && shouldUseLocalData(localData, serverData.updatedAt)) {
      debug.success("Conflict resolved: Using LOCAL data")
      const localFirstPageId = localData.data.pages[0]?.id
      result = {
        pages: localData.data.pages,
        activePageId:
          localData.data.activePageId || localFirstPageId || firstPage.id,
        projectName: localData.data.projectName || serverData.name,
        source: "local",
        shouldSyncToLocal: false, // 本地已是最新，无需同步
      }
    } else if (localData) {
      debug.success("Conflict resolved: Using SERVER data (will sync to local)")
    } else {
      debug.info("No local data, using server data directly")
    }

    debug.info("Resolution result", {
      source: result.source,
      pageCount: result.pages.length,
      activePageId: result.activePageId,
      shouldSyncToLocal: result.shouldSyncToLocal,
    })
    debug.health("healthy", `Resolved using ${result.source} data`)
    debug.groupEnd()

    return result
  }

  // 场景 2: 旧版单页面项目
  if (isLegacySinglePageData(json)) {
    debug.scenario(
      "LEGACY_SINGLE_PAGE",
      "Server data is legacy format - needs conversion to multi-page"
    )
    debug.info("Legacy structure detected", {
      jsonKeys: Object.keys(json),
      hasObjects: "objects" in json,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      objectCount: (json as any).objects?.length,
    })

    // 检查本地数据是否已转换为多页面结构
    if (
      localData &&
      localData.data.pages &&
      localData.data.pages.length > 0 &&
      shouldUseLocalData(localData, serverData.updatedAt)
    ) {
      debug.success(
        "Local data already converted to multi-page, using local data"
      )
      // 使用 ! 断言，因为上面已经检查了 pages.length > 0
      const localFirstPage = localData.data.pages[0]!
      const result: ConflictResolutionResult = {
        pages: localData.data.pages,
        activePageId: localData.data.activePageId || localFirstPage.id,
        projectName: localData.data.projectName || serverData.name,
        source: "local",
        shouldSyncToLocal: false,
      }
      debug.health("healthy", "Using converted local data")
      debug.groupEnd()
      return result
    }

    // 将旧版结构转换为新的多页面结构
    debug.info("Converting legacy to multi-page structure")
    const pageId = crypto.randomUUID()
    const result: ConflictResolutionResult = {
      pages: [{ id: pageId, json: json }],
      activePageId: pageId,
      projectName: serverData.name,
      source: "server",
      shouldSyncToLocal: true,
    }
    debug.success("Legacy project converted", {
      newPageId: pageId,
    })
    debug.health("healthy", "Legacy project converted successfully")
    debug.groupEnd()
    return result
  }

  // 场景 3: 空项目
  // 不创建默认 JSON 结构，让 useCanvasDataLoad 跳过 loadFromJSON
  // 首次保存时会自动生成完整的 Fabric JSON
  debug.scenario(
    "EMPTY_PROJECT",
    "Server data is empty - creating empty page (no loadFromJSON)"
  )
  debug.info("Empty project detected, creating page with null json")

  const pageId = crypto.randomUUID()
  const result: ConflictResolutionResult = {
    pages: [
      {
        id: pageId,
        json: null, // 空 JSON，确保 useCanvasDataLoad 跳过 loadFromJSON
      },
    ],
    activePageId: pageId,
    projectName: serverData.name || "Untitled Design",
    source: "empty",
    shouldSyncToLocal: false, // 空项目无需立即同步
  }
  debug.success("Empty project initialized with null json", {
    pageId,
    projectName: result.projectName,
  })
  debug.health("healthy", "Empty project ready (no loadFromJSON needed)")
  debug.groupEnd()

  return result
}
