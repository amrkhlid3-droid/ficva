"use client"

import { useEffect, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { findWorkspace } from "@/lib/editor/workspace"

export interface SnapshotOptions {
  /** Debounce delay in milliseconds (default: 200) */
  debounceMs?: number
  /** Thumbnail quality 0-1 (default: 0.8) */
  quality?: number
  /** Thumbnail scale multiplier (default: 0.5) */
  multiplier?: number
}

/**
 * useCanvasSnapshot - 画布快照 Hook
 *
 * 【核心职责】
 * 监听 canvas 对象变化，生成快照（JSON + 缩略图）并更新到当前页面。
 * 这是连接 canvas 状态与 pages store 的桥梁，也是触发 useAutoSave 的关键。
 *
 * 【数据流】
 * canvas 对象变化 → object:modified 事件 → 生成快照 → updatePage() → useAutoSave 检测到变化 → 保存
 *
 * 【监听事件】
 * - object:added: 对象添加
 * - object:removed: 对象删除
 * - object:modified: 对象修改（包括属性变化）
 * - canvas:modified: 自定义事件（用于手动触发）
 *
 * 【防止数据泄漏】
 * 在防抖定时器触发时验证 projectId 和 activePageId 是否仍然匹配，
 * 防止项目切换时旧项目的数据被写入新项目。
 *
 * Dependencies: Canvas must be initialized (useCanvasInit)
 */
export function useCanvasSnapshot(options: SnapshotOptions = {}) {
  const { debounceMs = 200, quality = 0.8, multiplier = 0.5 } = options

  const canvas = useEditorStore((s) => s.canvas)
  const projectId = useEditorStore((s) => s.projectId)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // 用于在防抖期间跟踪触发时的 projectId 和 activePageId
  const snapshotContextRef = useRef<{
    projectId: string | null
    activePageId: string | null
  } | null>(null)

  useEffect(() => {
    if (!canvas) return

    const updateState = () => {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // 捕获当前的 projectId 和 activePageId
      const currentState = useEditorStore.getState()
      snapshotContextRef.current = {
        projectId: currentState.projectId,
        activePageId: currentState.activePageId,
      }

      timeoutRef.current = setTimeout(() => {
        // 验证项目是否仍然匹配，防止数据泄漏到其他项目
        const {
          projectId: currentProjectId,
          activePageId,
          updatePage,
        } = useEditorStore.getState()
        const capturedContext = snapshotContextRef.current

        // 如果 projectId 或 activePageId 在防抖期间发生变化，丢弃这次更新
        if (
          !capturedContext ||
          capturedContext.projectId !== currentProjectId ||
          capturedContext.activePageId !== activePageId
        ) {
          // 项目已切换，丢弃旧项目的快照数据
          snapshotContextRef.current = null
          return
        }

        if (!activePageId) {
          snapshotContextRef.current = null
          return
        }

        // 1. 查找 workspace 获取边界框
        const workspace = findWorkspace(canvas)
        if (!workspace) {
          snapshotContextRef.current = null
          return
        }

        // 2. Generate Thumbnail - 只截取 workspace 区域
        const dataURL = canvas.toDataURL({
          format: "png",
          quality,
          multiplier,
          left: workspace.left,
          top: workspace.top,
          width: workspace.width,
          height: workspace.height,
        })

        // 3. Generate JSON with custom properties
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

        if (!json.backgroundColor) {
          json.backgroundColor = canvas.backgroundColor
        }

        // 4. Update page in store
        updatePage(activePageId, { thumbnail: dataURL, json })
        snapshotContextRef.current = null
      }, debounceMs)
    }

    canvas.on("object:added", updateState)
    canvas.on("object:removed", updateState)
    canvas.on("object:modified", updateState)
    // @ts-expect-error -- Custom event not in types
    canvas.on("canvas:modified", updateState)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      snapshotContextRef.current = null
      canvas.off("object:added", updateState)
      canvas.off("object:removed", updateState)
      canvas.off("object:modified", updateState)
      // @ts-expect-error -- Custom event not in types
      canvas.off("canvas:modified", updateState)
    }
  }, [canvas, debounceMs, quality, multiplier])

  // 当 projectId 变化时，清除所有 pending 的防抖定时器
  useEffect(() => {
    // projectId 变化意味着切换了项目，清除旧项目的 pending 快照
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    snapshotContextRef.current = null
  }, [projectId])
}
