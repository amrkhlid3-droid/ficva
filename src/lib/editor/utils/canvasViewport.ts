/**
 * canvasViewport.ts - 画布视口工具函数
 *
 * 提供缩放和居中相关的纯函数，供多个模块复用：
 * - useCanvasZoom
 * - useCanvasWorkspaceAutoFit
 * - ZoomControls
 */

import type { Canvas } from "fabric"

/** 缩放限制常量 */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 10.0 // 最大 1000%
export const ZOOM_STEP = 0.1
export const DEFAULT_PADDING = 40

/**
 * 计算适应指定区域的缩放比例
 *
 * @param containerSize - 容器尺寸
 * @param targetSize - 目标区域尺寸（workspace 或选中对象）
 * @param padding - 边距（默认 40px）
 * @returns 计算出的缩放比例（已限制在 MIN_ZOOM 和 MAX_ZOOM 之间）
 */
export function calculateFitZoom(
  containerSize: { width: number; height: number },
  targetSize: { width: number; height: number },
  padding = DEFAULT_PADDING
): number {
  const availableWidth = containerSize.width - padding * 2
  const availableHeight = containerSize.height - padding * 2

  if (availableWidth <= 0 || availableHeight <= 0) {
    return 1.0
  }

  const scaleX = availableWidth / targetSize.width
  const scaleY = availableHeight / targetSize.height

  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)))
}

/**
 * 限制缩放值在有效范围内
 */
export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

/**
 * 居中 workspace 到视口
 *
 * 使用 Fabric.js 的 viewportTransform 矩阵：
 * [scaleX, skewY, skewX, scaleY, translateX, translateY]
 *
 * 【重要】
 * workspace 可能不在原点 (0, 0)，需要考虑其实际位置。
 * 居中逻辑：将 workspace 的中心点对齐到容器的中心点。
 *
 * @param canvas - Fabric.js Canvas 实例
 * @param containerSize - 容器尺寸
 * @param workspaceSize - workspace 尺寸
 * @param zoom - 缩放比例
 * @param workspacePosition - workspace 左上角位置（可选，默认 0,0）
 */
export function centerWorkspace(
  canvas: Canvas,
  containerSize: { width: number; height: number },
  workspaceSize: { width: number; height: number },
  zoom: number,
  workspacePosition: { left: number; top: number } = { left: 0, top: 0 }
): void {
  // 计算 workspace 中心点的 canvas 坐标
  const workspaceCenterX = workspacePosition.left + workspaceSize.width / 2
  const workspaceCenterY = workspacePosition.top + workspaceSize.height / 2

  // 计算平移量：使 workspace 中心对齐容器中心
  const translateX = containerSize.width / 2 - workspaceCenterX * zoom
  const translateY = containerSize.height / 2 - workspaceCenterY * zoom

  canvas.setViewportTransform([zoom, 0, 0, zoom, translateX, translateY])
}

/**
 * 居中选中对象到视口
 *
 * @param canvas - Fabric.js Canvas 实例
 * @param containerSize - 容器尺寸
 * @param selectionBounds - 选中对象的边界框
 * @param zoom - 缩放比例
 */
export function centerSelection(
  canvas: Canvas,
  containerSize: { width: number; height: number },
  selectionBounds: {
    left: number
    top: number
    width: number
    height: number
  },
  zoom: number
): void {
  // 计算选中对象的中心位置
  const selectionCenterX = selectionBounds.left + selectionBounds.width / 2
  const selectionCenterY = selectionBounds.top + selectionBounds.height / 2

  // 计算需要的平移量，使选中对象居中
  const translateX = containerSize.width / 2 - selectionCenterX * zoom
  const translateY = containerSize.height / 2 - selectionCenterY * zoom

  canvas.setViewportTransform([zoom, 0, 0, zoom, translateX, translateY])
}
