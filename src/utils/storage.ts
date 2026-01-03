"use client"

import { Page } from "@/store/useEditorStore"

interface ProjectData {
  pages: Page[]
  activePageId: string
  projectName: string
}

interface LocalStorageData {
  timestamp: number
  version: number
  unsavedChanges: boolean
  userId: string
  data: ProjectData
}

const STORAGE_PREFIX = "ficva-project-"
const ACTIVE_USER_KEY = "ficva-active-user"

/**
 * 生成包含 userId 的存储 key
 * 格式: ficva-project-{userId}-{projectId}
 */
function getStorageKey(userId: string, projectId: string): string {
  return `${STORAGE_PREFIX}${userId}-${projectId}`
}

/**
 * 保存项目数据到 localStorage
 * @param userId 当前登录用户 ID
 * @param projectId 项目 ID
 * @param data 项目数据
 * @param unsavedChanges 是否有未保存到服务器的更改
 */
export function saveToLocalStorage(
  userId: string,
  projectId: string,
  data: ProjectData,
  unsavedChanges: boolean = true
) {
  if (typeof window === "undefined") return

  const storageData: LocalStorageData = {
    timestamp: Date.now(),
    version: 2, // 版本升级，包含 userId
    unsavedChanges,
    userId,
    data,
  }

  try {
    localStorage.setItem(
      getStorageKey(userId, projectId),
      JSON.stringify(storageData)
    )
  } catch (e) {
    console.error("Failed to save to localStorage", e)
  }
}

/**
 * 从 localStorage 加载项目数据
 * @param userId 当前登录用户 ID
 * @param projectId 项目 ID
 * @returns 存储的数据，如果不存在或 userId 不匹配则返回 null
 */
export function loadFromLocalStorage(
  userId: string,
  projectId: string
): LocalStorageData | null {
  if (typeof window === "undefined") return null

  try {
    const item = localStorage.getItem(getStorageKey(userId, projectId))
    if (!item) return null

    const data = JSON.parse(item) as LocalStorageData

    // 安全验证：确保 userId 匹配
    if (data.userId && data.userId !== userId) {
      console.warn("localStorage data userId mismatch, ignoring")
      return null
    }

    return data
  } catch (e) {
    console.error("Failed to load from localStorage", e)
    return null
  }
}

/**
 * 清除指定项目的 localStorage 数据
 */
export function clearLocalStorage(userId: string, projectId: string) {
  if (typeof window === "undefined") return
  localStorage.removeItem(getStorageKey(userId, projectId))
}

/**
 * 清除当前用户的所有项目缓存
 */
export function clearAllUserProjectCache(userId: string) {
  if (typeof window === "undefined") return

  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(`${STORAGE_PREFIX}${userId}-`)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

/**
 * 清除所有项目缓存（用于用户切换时）
 */
export function clearAllProjectCache() {
  if (typeof window === "undefined") return

  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

/**
 * 获取当前活跃用户 ID
 */
export function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_USER_KEY)
}

/**
 * 设置当前活跃用户 ID
 */
export function setActiveUserId(userId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_USER_KEY, userId)
}

/**
 * 清除活跃用户记录
 */
export function clearActiveUserId() {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACTIVE_USER_KEY)
}

/**
 * 迁移旧版本数据（不含 userId）到新版本
 * 在用户登录后调用，将旧格式数据迁移到新格式
 */
export function migrateOldStorageData(userId: string) {
  if (typeof window === "undefined") return

  const keysToMigrate: string[] = []

  // 查找旧格式的 key (ficva-project-{projectId})
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      // 检查是否是旧格式（不含 userId 的格式）
      const suffix = key.replace(STORAGE_PREFIX, "")
      // 新格式: {userId}-{projectId}，旧格式: {projectId}
      // UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
      // 如果 suffix 长度等于 36 且只包含一个完整的 UUID，说明是旧格式
      if (suffix.length === 36 && !suffix.includes("-", 9)) {
        // 旧格式，projectId 是完整的 UUID
        keysToMigrate.push(key)
      }
    }
  }

  // 迁移旧数据到新格式
  keysToMigrate.forEach((oldKey) => {
    try {
      const item = localStorage.getItem(oldKey)
      if (!item) return

      const oldData = JSON.parse(item)
      const projectId = oldKey.replace(STORAGE_PREFIX, "")

      // 创建新格式数据
      const newData: LocalStorageData = {
        timestamp: oldData.timestamp || Date.now(),
        version: 2,
        unsavedChanges: oldData.unsavedChanges ?? true,
        userId,
        data: oldData.data,
      }

      // 保存到新 key
      const newKey = getStorageKey(userId, projectId)
      localStorage.setItem(newKey, JSON.stringify(newData))

      // 删除旧 key
      localStorage.removeItem(oldKey)

      console.log(`Migrated storage data: ${oldKey} -> ${newKey}`)
    } catch (e) {
      console.error(`Failed to migrate storage data for key: ${oldKey}`, e)
    }
  })
}
