# FabricCanvas Hooks 详细参考

## useCanvasInit

**职责**: 创建 Fabric.js Canvas 实例并注册到 store

**文件**: `src/hooks/canvas/useCanvasInit.ts`

**参数**:

```typescript
interface CanvasInitOptions {
  containerRef: React.RefObject<HTMLDivElement>
}
```

**关键逻辑**:

- 动态创建 `<canvas>` 元素（React 18 严格模式兼容）
- 获取容器尺寸初始化 canvas
- 创建逻辑画布背景（可选的白色 Rect）
- 调用 `setCanvas(canvasInstance)` 注册到 store
- 清理时调用 `dispose()` 并移除 DOM

---

## useCanvasResize

**职责**: 监听容器尺寸变化，自动调整 canvas 尺寸

**文件**: `src/hooks/canvas/useCanvasResize.ts`

**参数**:

```typescript
interface CanvasResizeOptions {
  containerRef: React.RefObject<HTMLDivElement>
  debounceMs?: number // 默认 50ms
}
```

**关键逻辑**:

- 使用 ResizeObserver 监听容器
- 防抖处理合并快速调整
- 跳过尺寸未变的情况（防止无限循环）
- 调用 `canvas.setDimensions()` 和 `requestRenderAll()`

---

## useCanvasSelection

**职责**: 同步选择事件到 store

**文件**: `src/hooks/canvas/useCanvasSelection.ts`

**监听事件**:

- `selection:created`
- `selection:updated`
- `selection:cleared`

---

## useCanvasHistory

**职责**: 跟踪对象变换用于撤销/重做

**文件**: `src/hooks/canvas/useCanvasHistory.ts`

**监听事件**:

- `object:modified` - 记录变换前后状态
- 创建 `ModifyObjectCommand` 添加到历史栈

---

## useCanvasLayerSync

**职责**: 同步 canvas 对象到图层面板

**文件**: `src/hooks/canvas/useCanvasLayerSync.ts`

**监听事件**:

- `object:added`
- `object:removed`
- `object:modified`

**过滤**: 排除 `isCanvasBackground` 标记的对象

---

## useCanvasThumbnail

**职责**: 生成页面缩略图和 JSON 快照

**文件**: `src/hooks/canvas/useCanvasThumbnail.ts`

**参数**:

```typescript
interface ThumbnailOptions {
  debounceMs?: number // 默认 1000ms
}
```

---

## useCanvasKeyboard

**职责**: 处理键盘快捷键

**文件**: `src/hooks/canvas/useCanvasKeyboard.ts`

**快捷键**:

- `Ctrl+Z` / `Cmd+Z` - 撤销
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` - 重做
- `Delete` / `Backspace` - 删除选中对象

---

## useCanvasDrawingMode

**职责**: 同步绘图模式、画笔颜色/宽度

**文件**: `src/hooks/canvas/useCanvasDrawingMode.ts`

---

## useCanvasPenTool

**职责**: 钢笔工具逻辑，创建贝塞尔曲线路径

**文件**: `src/hooks/canvas/useCanvasPenTool.ts`

---

## useCanvasPathEdit

**职责**: 路径编辑模式，控制点操作

**文件**: `src/hooks/canvas/useCanvasPathEdit.ts`

**返回**:

```typescript
interface PathEditRefs {
  editingPathRef: React.MutableRefObject<Path | null>
  controlsRef: React.MutableRefObject<FabricObject[]>
}
```

---

## useCanvasZoomScaling

**职责**: 缩放时更新控制点大小

**文件**: `src/hooks/canvas/useCanvasZoomScaling.ts`

**参数**:

```typescript
interface ZoomScalingOptions {
  controlsRef: React.MutableRefObject<FabricObject[]>
  editingPathRef: React.MutableRefObject<Path | null>
}
```

**关键逻辑**:

```typescript
const baseRadius = data.type === "anchor" ? 5 : 3
cp.set({
  radius: baseRadius / zoom,
  strokeWidth: baseStrokeWidth / zoom,
})
```

---

## useCanvasZoom

**职责**: 缩放控制（完整版）

**文件**: `src/hooks/useCanvasZoom.ts`

**返回**:

```typescript
{
  zoom: number
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: () => void
  centerAndZoom: (level: number) => void
}
```

---

## useCanvasPan

**职责**: 平移控制

**文件**: `src/hooks/useCanvasPan.ts`

**返回**:

```typescript
{
  isPanning: boolean
}
```
