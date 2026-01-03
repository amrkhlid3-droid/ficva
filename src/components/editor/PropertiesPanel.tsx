"use client"

/**
 * PropertiesPanel - 属性面板容器
 *
 * 作为面板宿主，根据当前状态渲染对应的属性面板模块。
 * 每个面板模块都是独立的组件，可以按需插入或移除。
 *
 * 面板优先级：
 * 1. PenToolPropertiesPanel - 钢笔工具激活且无选中对象
 * 2. PathNodePropertiesPanel - 选中路径锚点
 * 3. ObjectPropertiesPanel - 选中普通对象
 * 4. WorkspacePropertiesPanel - 无选中对象但画布存在
 *
 * 插拔方式：
 * - 移除某个面板：删除对应的 import 和渲染逻辑
 * - 添加新面板：创建新组件并添加判断条件
 */

import { useEditorStore } from "@/store/useEditorStore"
import {
  WorkspacePropertiesPanel,
  PenToolPropertiesPanel,
  PathNodePropertiesPanel,
  ObjectPropertiesPanel,
} from "./properties"

export default function PropertiesPanel() {
  const selectedObjects = useEditorStore((s) => s.selectedObjects)
  const canvas = useEditorStore((s) => s.canvas)
  const activeTool = useEditorStore((s) => s.activeTool)
  const editingPath = useEditorStore((s) => s.editingPath)

  const selection = selectedObjects?.[0]
  const activeObject = selection || editingPath

  // 无选中对象时的面板
  if (!activeObject) {
    // 钢笔工具面板
    if (activeTool === "pen") {
      return <PenToolPropertiesPanel />
    }

    // Workspace 属性面板
    if (canvas) {
      return <WorkspacePropertiesPanel />
    }

    // 空白面板
    return null
  }

  // 路径节点面板
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((activeObject as any).data?.type === "anchor") {
    return <PathNodePropertiesPanel />
  }

  // 对象属性面板
  return <ObjectPropertiesPanel />
}
