/**
 * Workspace 工具函数
 *
 * 提供 Workspace 对象的类型定义和查找功能
 * 供 PropertiesPanel 和 useCanvasWorkspace 共同使用
 */

import { type Canvas, type Rect } from "fabric"

/** Workspace 对象接口 */
export interface WorkspaceObject extends Rect {
  /** 标识这是 workspace 对象 */
  isWorkspace: true
  /** 自定义名称 */
  name: "workspace"
  /** 为 true 时，填充色自动跟随主题切换 */
  followTheme?: boolean
}

/**
 * 在 canvas 中查找 workspace 对象
 *
 * @param canvas - Fabric.js Canvas 实例
 * @returns WorkspaceObject 或 null
 */
export function findWorkspace(canvas: Canvas): WorkspaceObject | null {
  const objects = canvas.getObjects()
  for (const obj of objects) {
    if ((obj as WorkspaceObject).isWorkspace) {
      return obj as WorkspaceObject
    }
  }
  return null
}
