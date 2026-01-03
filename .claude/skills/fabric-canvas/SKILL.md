---
name: fabric-canvas
description: FabricCanvas 模块化初始化架构指南。当需要：调试 canvas 初始化、添加新的 canvas hook、理解 zoom/resize 机制、或修改 canvas 相关功能时使用此 skill。
---

# FabricCanvas 模块化初始化架构

## 概述 / Overview

FabricCanvas 使用模块化 hook 架构进行初始化，每个 hook 负责单一职责，可独立启用/禁用。

## 文件结构 / File Structure

```
src/components/editor/
├── FabricCanvas.tsx          # 入口文件，切换 minimal/full 版本
├── FabricCanvas.minimal.tsx  # 最小化调试版本
└── FabricCanvas.full.tsx     # 完整版本

src/hooks/canvas/
├── index.ts                  # 统一导出
├── useCanvasInit.ts          # 核心初始化（必需）
├── useCanvasResize.ts        # 尺寸自适应（可选）
├── useCanvasSelection.ts     # 选择事件
├── useCanvasHistory.ts       # 撤销/重做
├── useCanvasLayerSync.ts     # 图层同步
├── useCanvasThumbnail.ts     # 缩略图生成
├── useCanvasKeyboard.ts      # 键盘快捷键
├── useCanvasDrawingMode.ts   # 绘图模式
├── useCanvasPenTool.ts       # 钢笔工具
├── useCanvasPathEdit.ts      # 路径编辑
└── useCanvasZoomScaling.ts   # 控制点缩放
```

## Hook 依赖图 / Hook Dependency Graph

```
useCanvasInit (必需，必须首先调用)
    │
    ├── useCanvasResize       # 尺寸自适应（ResizeObserver）
    ├── useCanvasSelection    # 选择事件同步
    ├── useCanvasHistory      # 撤销/重做跟踪
    ├── useCanvasLayerSync    # 图层面板同步
    ├── useCanvasThumbnail    # 缩略图生成
    ├── useCanvasKeyboard     # 键盘快捷键
    ├── useCanvasDrawingMode  # 绘图模式同步
    ├── useCanvasPenTool      # 钢笔工具逻辑
    ├── useCanvasPathEdit     # 路径编辑模式
    ├── useCanvasZoomScaling  # 控制点缩放
    ├── useCanvasZoom         # 缩放控制
    └── useCanvasPan          # 平移控制
```

## 最小化版本模板 / Minimal Version Template

```tsx
"use client"

import { useEffect, useRef } from "react"
import { Canvas } from "fabric"
import { useEditorStore } from "@/store/useEditorStore"
import { useCanvasResize } from "@/hooks/canvas"

export default function FabricCanvasMinimal() {
  const containerRef = useRef<HTMLDivElement>(null!)
  const setCanvas = useEditorStore((s) => s.setCanvas)

  // 可选模块：尺寸自适应
  useCanvasResize({ containerRef })

  useEffect(() => {
    if (!containerRef.current) return

    // 动态创建 canvas 元素（React 18 严格模式兼容）
    const canvasElement = document.createElement("canvas")
    containerRef.current.appendChild(canvasElement)

    // 获取容器尺寸
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width || 1200
    const height = rect.height || 800

    // 初始化 Fabric.js Canvas
    const canvasInstance = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: "transparent",
      fireRightClick: true,
      stopContextMenu: true,
      preserveObjectStacking: true,
    })

    // 注册到 store
    setCanvas(canvasInstance)

    // 清理
    return () => {
      const wrapper = canvasElement.parentElement
      setCanvas(null)
      canvasInstance.dispose()
      if (wrapper?.classList.contains("canvas-container")) {
        wrapper.remove()
      } else if (canvasElement.parentElement) {
        canvasElement.remove()
      }
    }
  }, [setCanvas])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 [&>.canvas-container]:absolute! [&>.canvas-container]:inset-0!"
    >
      {/* Canvas 由 useEffect 动态创建 */}
    </div>
  )
}
```

## 关键机制 / Key Mechanisms

### 1. 防止 ResizeObserver 无限循环

**问题**: ResizeObserver → setDimensions → 容器高度变化 → ResizeObserver → 无限循环

**解决方案（三层防护）**:

1. **CSS**: `[&>.canvas-container]:absolute!` - 使 canvas 不影响容器尺寸
2. **代码**: 跟踪 lastWidth/lastHeight，尺寸没变就跳过
3. **防抖**: 默认 50ms 延迟合并快速调整

### 2. React 18 严格模式兼容

**问题**: 严格模式会双重挂载，Fabric.js 修改的 canvas 元素会被"污染"

**解决方案**:

- 使用 `document.createElement("canvas")` 动态创建
- 清理时完整移除 DOM 元素（包括 Fabric 创建的 wrapper）

### 3. 控制点缩放（zoom scaling）

控制点需要反向缩放以保持视觉一致性：

```typescript
cp.set({
  radius: baseRadius / zoom,
  strokeWidth: baseStrokeWidth / zoom,
})
```

## 切换版本 / Switch Version

修改 `FabricCanvas.tsx`:

```tsx
// 调试模式
export { default } from "./FabricCanvas.minimal"

// 正常模式
// export { default } from "./FabricCanvas.full"
```

## 添加新 Hook / Adding New Hook

1. 在 `src/hooks/canvas/` 创建 `useCanvasYourFeature.ts`
2. 在 `src/hooks/canvas/index.ts` 添加导出
3. 在 `FabricCanvas.minimal.tsx` 中调用（在 `useCanvasInit` 之后）

## Store 相关状态 / Store State

```typescript
// src/store/useEditorStore.ts
canvas: Canvas | null           // Fabric.js 实例
canvasContainerSize: { width, height } | null  // 容器尺寸
logicalCanvasSize: { width, height }           // 逻辑画布尺寸
zoom: number                    // 缩放级别 (0.1-5.0)
zoomMode: "fit" | "custom"      // 缩放模式
```

## 常见问题 / Common Issues

1. **Canvas 显示空白**: 检查 `setCanvas()` 是否被调用
2. **尺寸不更新**: 确认 `useCanvasResize` 已启用且容器有明确尺寸
3. **无限循环**: 确认容器有 `[&>.canvas-container]:absolute!` 类
4. **控制点太大/太小**: 检查 `useCanvasZoomScaling` 是否正确应用
