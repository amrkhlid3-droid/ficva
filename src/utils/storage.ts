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
  data: ProjectData
}

const STORAGE_PREFIX = "ficva-project-"

export function saveToLocalStorage(
  projectId: string,
  data: ProjectData,
  unsavedChanges: boolean = true
) {
  if (typeof window === "undefined") return

  const storageData: LocalStorageData = {
    timestamp: Date.now(),
    version: 1,
    unsavedChanges,
    data,
  }

  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${projectId}`,
      JSON.stringify(storageData)
    )
  } catch (e) {
    console.error("Failed to save to localStorage", e)
  }
}

export function loadFromLocalStorage(
  projectId: string
): LocalStorageData | null {
  if (typeof window === "undefined") return null

  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`)
    if (!item) return null
    return JSON.parse(item) as LocalStorageData
  } catch (e) {
    console.error("Failed to load from localStorage", e)
    return null
  }
}

export function clearLocalStorage(projectId: string) {
  if (typeof window === "undefined") return
  localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`)
}
