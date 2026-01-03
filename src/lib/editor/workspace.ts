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

/** generateWorkspaceThumbnail 选项 */
export interface ThumbnailOptions {
  /** 图片格式，默认 'png' */
  format?: "png" | "jpeg"
  /** 图片质量 0-1，默认 0.8 */
  quality?: number
  /** 缩放倍数，默认 0.5 */
  multiplier?: number
}

/**
 * 生成 workspace 区域的缩略图
 *
 * 【重要】
 * 此函数会临时重置 viewport transform 为单位矩阵，
 * 确保 toDataURL 的裁剪坐标正确对应 canvas 坐标系。
 * 执行完毕后会恢复原始的 viewport transform。
 *
 * 【为什么需要这样做？】
 * Fabric.js 的 toDataURL 的 left/top/width/height 参数
 * 是相对于当前 viewport 的，而不是 canvas 坐标系。
 * 当 canvas 被缩放或平移后，直接使用 workspace.left/top
 * 会导致裁剪区域错误。
 *
 * @param canvas - Fabric.js Canvas 实例
 * @param options - 缩略图选项
 * @returns data URL 字符串，如果 workspace 不存在则返回 null
 */
export function generateWorkspaceThumbnail(
  canvas: Canvas,
  options: ThumbnailOptions = {}
): string | null {
  const { format = "png", quality = 0.8, multiplier = 0.5 } = options

  const workspace = findWorkspace(canvas)
  if (!workspace) {
    return null
  }

  // 保存当前 viewport transform
  const originalTransform = canvas.viewportTransform?.slice() as
    | [number, number, number, number, number, number]
    | undefined

  // 临时重置为单位矩阵（无缩放、无平移）
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

  // 生成缩略图
  const dataURL = canvas.toDataURL({
    format,
    quality,
    multiplier,
    left: workspace.left ?? 0,
    top: workspace.top ?? 0,
    width: workspace.width ?? 1200,
    height: workspace.height ?? 800,
  })

  // 恢复原始 viewport transform
  if (originalTransform) {
    canvas.setViewportTransform(originalTransform)
  }

  return dataURL
}
