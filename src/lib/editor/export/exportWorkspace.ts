/**
 * Workspace 导出模块
 *
 * 提供将 workspace 区域导出为各种格式的功能。
 * 支持 PNG、JPEG、SVG、JSON 四种格式。
 *
 * 模块化设计：
 * - 基础功能：直接调用 exportWorkspace() 导出 PNG
 * - 高级功能：配合 ExportDialog 使用完整选项
 */

import type { Canvas } from "fabric"
import { findWorkspace } from "@/lib/editor/workspace"

/** 导出格式类型 */
export type ExportFormat = "png" | "jpeg" | "svg" | "json"

/** 导出选项 */
export interface ExportOptions {
  /** 导出格式 */
  format: ExportFormat
  /** 图片质量 0-1，默认 1 */
  quality?: number
  /** 分辨率倍数，默认 2（2x 高清） */
  multiplier?: number
  /** PNG 透明背景，默认 false */
  transparent?: boolean
  /** 自定义文件名（不含扩展名） */
  filename?: string
}

/** 默认导出选项 */
const DEFAULT_OPTIONS: Required<Omit<ExportOptions, "format">> = {
  quality: 1,
  multiplier: 2,
  transparent: false,
  filename: "design-export",
}

/**
 * 获取文件扩展名
 */
function getExtension(format: ExportFormat): string {
  switch (format) {
    case "jpeg":
      return "jpg"
    case "png":
      return "png"
    case "svg":
      return "svg"
    case "json":
      return "json"
  }
}

/**
 * 获取 MIME 类型
 */
function getMimeType(format: ExportFormat): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "svg":
      return "image/svg+xml"
    case "json":
      return "application/json"
  }
}

/**
 * 触发文件下载
 */
function downloadFile(content: string | Blob, filename: string): void {
  const link = document.createElement("a")

  if (content instanceof Blob) {
    link.href = URL.createObjectURL(content)
  } else {
    link.href = content
  }

  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // 清理 Object URL
  if (content instanceof Blob) {
    URL.revokeObjectURL(link.href)
  }
}

/**
 * 导出为图片格式（PNG/JPEG）
 */
function exportAsImage(
  canvas: Canvas,
  format: "png" | "jpeg",
  options: Required<Omit<ExportOptions, "format">>
): string | null {
  const workspace = findWorkspace(canvas)
  if (!workspace) {
    console.warn("[Export] Workspace not found")
    return null
  }

  // 临时隐藏 workspace 边框
  const originalStroke = workspace.stroke
  const originalStrokeWidth = workspace.strokeWidth
  workspace.set({ stroke: "transparent", strokeWidth: 0 })

  // 如果需要透明背景，临时修改 workspace 填充色
  const originalFill = workspace.fill
  if (options.transparent && format === "png") {
    workspace.set({ fill: "transparent" })
  }

  canvas.requestRenderAll()

  const dataURL = canvas.toDataURL({
    format,
    quality: options.quality,
    multiplier: options.multiplier,
    left: workspace.left,
    top: workspace.top,
    width: workspace.width,
    height: workspace.height,
  })

  // 恢复 workspace 原始状态
  workspace.set({
    stroke: originalStroke,
    strokeWidth: originalStrokeWidth,
    fill: originalFill,
  })
  canvas.requestRenderAll()

  return dataURL
}

/**
 * 导出为 SVG 格式
 */
function exportAsSVG(canvas: Canvas): string | null {
  const workspace = findWorkspace(canvas)
  if (!workspace) {
    console.warn("[Export] Workspace not found")
    return null
  }

  // 临时隐藏 workspace 边框
  const originalStroke = workspace.stroke
  const originalStrokeWidth = workspace.strokeWidth
  workspace.set({ stroke: "transparent", strokeWidth: 0 })

  canvas.requestRenderAll()

  // 使用 viewBox 裁剪到 workspace 区域
  const svg = canvas.toSVG({
    viewBox: {
      x: workspace.left ?? 0,
      y: workspace.top ?? 0,
      width: workspace.width ?? 1200,
      height: workspace.height ?? 800,
    },
    width: `${workspace.width}px`,
    height: `${workspace.height}px`,
  })

  // 恢复 workspace 原始状态
  workspace.set({
    stroke: originalStroke,
    strokeWidth: originalStrokeWidth,
  })
  canvas.requestRenderAll()

  return svg
}

/**
 * 导出为 JSON 格式
 */
function exportAsJSON(canvas: Canvas): string {
  const json = canvas.toObject([
    "id",
    "selectable",
    "name",
    "backgroundColor",
    "nodeModes",
    "customPathData",
    "isWorkspace",
    "followTheme",
  ])

  return JSON.stringify(json, null, 2)
}

/**
 * 导出 Workspace 区域
 *
 * @param canvas - Fabric.js Canvas 实例
 * @param options - 导出选项
 *
 * @example
 * ```typescript
 * // 基础导出：PNG 格式
 * exportWorkspace(canvas, { format: "png" })
 *
 * // 高级导出：PNG 透明背景
 * exportWorkspace(canvas, {
 *   format: "png",
 *   transparent: true,
 *   filename: "my-design"
 * })
 *
 * // SVG 矢量导出
 * exportWorkspace(canvas, { format: "svg" })
 * ```
 */
export function exportWorkspace(
  canvas: Canvas,
  options: ExportOptions = { format: "png" }
): void {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const extension = getExtension(opts.format)
  const filename = `${opts.filename}.${extension}`

  let content: string | Blob | null = null

  switch (opts.format) {
    case "png":
    case "jpeg": {
      const dataURL = exportAsImage(canvas, opts.format, opts)
      if (dataURL) {
        content = dataURL
      }
      break
    }
    case "svg": {
      const svg = exportAsSVG(canvas)
      if (svg) {
        content = new Blob([svg], { type: getMimeType("svg") })
      }
      break
    }
    case "json": {
      const json = exportAsJSON(canvas)
      content = new Blob([json], { type: getMimeType("json") })
      break
    }
  }

  if (content) {
    downloadFile(content, filename)
  }
}
