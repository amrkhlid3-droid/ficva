"use client"

/**
 * FabricCanvas - 画布容器组件（完整版入口）
 *
 * 此文件重新导出完整版本的 FabricCanvas 组件。
 * 完整版包含所有功能：钢笔工具、路径编辑、缩放控制、导航器等。
 *
 * 【React 18 严格模式兼容性】
 * Canvas 元素由 useCanvasInit 动态创建，而不是在 JSX 中声明。
 * 这确保了与 React 18 严格模式的兼容性。
 * 详见 useCanvasInit.ts 和 FabricCanvas.full.tsx 中的注释。
 *
 * 【无限循环修复】
 * 容器使用 [&>.canvas-container]: ! CSS 类，
 * 防止 Fabric.js 的 .canvas-container 影响父容器尺寸，
 * 从而避免 ResizeObserver 无限循环。
 * 详见 FabricCanvas.full.tsx 和 useCanvasZoom.ts 中的注释。
 */

/**
 * 切换版本 / Switch Version:
 * - 调试模式：导出 minimal 版本
 * - 正常模式：导出 full 版本
 *
 * 当前：调试模式 (minimal)
 * 切换：注释/取消注释下面的导出语句
 */
export { default } from "./FabricCanvas.minimal"
// export { default } from "./FabricCanvas.full"
