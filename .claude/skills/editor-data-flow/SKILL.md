---
name: editor-data-flow
description: 编辑器数据流与初始化流程指南。当需要：理解项目加载流程、调试数据初始化问题、追踪 Store 状态变化、或理解 React Strict Mode 行为时使用此 skill。
---

# 编辑器数据流与初始化流程 / Editor Data Flow & Initialization

## 概述 / Overview

FICVA 编辑器采用多层数据管理架构，涉及 API、Zustand Store、LocalStorage 和 Canvas 之间的协调。本文档详细说明数据如何从服务器流向画布，以及各种场景下的初始化行为。

## 数据层架构 / Data Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         数据层级                                 │
├─────────────────────────────────────────────────────────────────┤
│  L1 - Zustand Store (内存)                                      │
│  └─ 最快访问，但刷新即失                                         │
│                                                                 │
│  L2 - LocalStorage (本地存储)                                   │
│  └─ 快速，可离线恢复，用于冲突检测                               │
│                                                                 │
│  L3 - Server/Database (远程)                                    │
│  └─ 最可靠，需要网络                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 核心文件 / Key Files

| 文件                                         | 职责                                       |
| -------------------------------------------- | ------------------------------------------ |
| `src/app/editor/[id]/page.tsx`               | 编辑器主页面，协调数据获取和初始化         |
| `src/store/useEditorStore.ts`                | Zustand 状态管理，包含 pages、projectId 等 |
| `src/hooks/useProjectDataFetch.ts`           | 从服务器获取项目数据                       |
| `src/hooks/useCanvasDataLoad.ts`             | 将 Store 数据加载到 Canvas                 |
| `src/hooks/useAutoSave.ts`                   | 自动保存到 LocalStorage 和服务器           |
| `src/hooks/canvas/useInitialCanvasSave.ts`   | 新项目首次保存 Canvas JSON                 |
| `src/lib/editor/utils/conflictResolution.ts` | 本地/服务器数据冲突解决                    |

## 完整初始化流程 / Complete Initialization Flow

### 场景 1: 从 Dashboard 创建新项目

```
用户点击 "Create Design"
        │
        ▼
POST /api/projects → 返回 { id: "abc", json: {} }
        │
        ▼
router.push('/editor/abc')
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  EditorPage 组件挂载                                           │
│                                                               │
│  初始 Store 状态:                                              │
│  { projectId: null, pages: [], canvas: null }                 │
│                                                               │
│  1. useProjectDataFetch 开始请求 (异步)                        │
│  2. 渲染 EditorLayout → FabricCanvas                          │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  FabricCanvas.minimal 组件挂载                                 │
│                                                               │
│  useEffect 执行:                                               │
│  1. new Canvas(...) 创建 Fabric.js 实例                        │
│  2. setCanvas(canvasInstance) 注册到 Store                     │
│         │                                                     │
│         ▼                                                     │
│  setCanvas 内部触发:                                           │
│  if (pages.length === 0) {                                    │
│    set({                                                      │
│      pages: [{ id: "default-page", json: null }],             │
│      activePageId: "default-page"                             │
│    })                                                         │
│  }                                                            │
│                                                               │
│  此时 Store: { pages.length: 1, projectId: null }             │
└───────────────────────────────────────────────────────────────┘
        │
        │ API 请求完成，projectData 返回
        ▼
┌───────────────────────────────────────────────────────────────┐
│  冲突解决 Effect (page.tsx)                                    │
│                                                               │
│  判断条件:                                                     │
│  - storeProjectId (null) !== projectData.id ("abc")           │
│  - → 执行 FIRST_LOAD 场景                                     │
│                                                               │
│  执行步骤:                                                     │
│  1. 从 LocalStorage 加载本地数据（用于冲突比较）                │
│  2. resolveConflict() 决定使用本地或服务器数据                  │
│  3. 更新 Store: { projectId: "abc", pages: [...] }            │
│  4. 如果使用服务器数据，同步到 LocalStorage                     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  useCanvasDataLoad Effect                                      │
│                                                               │
│  检测到 activePageId 变化:                                     │
│  1. 查找当前页面的 JSON                                        │
│  2. 如果 JSON 为空 → EMPTY_PAGE 场景，标记 isCanvasReady       │
│  3. 如果 JSON 有数据 → 加载到 Canvas                           │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  useInitialCanvasSave Effect                                   │
│                                                               │
│  检测到 isCanvasReady = true 且页面 JSON 为空:                  │
│  1. canvas.toObject() 生成 JSON                                │
│  2. canvas.toDataURL() 生成缩略图                              │
│  3. updatePage() 保存到 Store                                  │
│  4. 这会触发 useAutoSave 保存到服务器                          │
└───────────────────────────────────────────────────────────────┘
```

### 场景 2: 从一个项目切换到另一个项目

```
当前状态: 编辑项目 A
        │
        ▼
用户点击 "Create Design" 或打开项目 B
        │
        ▼
router.push('/editor/B')
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  EditorPage 渲染（URL 是项目 B，Store 还是项目 A）              │
│                                                               │
│  Store 状态:                                                  │
│  - storeProjectId: 'A'                                        │
│  - pages: [项目 A 的页面数据]                                  │
│  - canvas: <复用的 Canvas 实例>                                │
└───────────────────────────────────────────────────────────────┘
        │
        │ API 返回项目 B 的数据
        ▼
┌───────────────────────────────────────────────────────────────┐
│  冲突解决 Effect                                               │
│                                                               │
│  判断条件:                                                     │
│  - storeProjectId ('A') !== projectData.id ('B')              │
│  - → 执行 FIRST_LOAD 场景                                     │
│                                                               │
│  更新 Store 为项目 B 的数据                                    │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  useInitialCanvasSave Effect                                   │
│                                                               │
│  检测到 projectId 变化:                                        │
│  - 重置 hasTriggeredRef = false                               │
│  - 允许为新项目执行初始保存                                     │
└───────────────────────────────────────────────────────────────┘
```

### 场景 3: React Strict Mode 重复执行

```
React Strict Mode 下的 Effect 执行顺序:
─────────────────────────────────────────────────────────

[第一次执行 Effect]
        │
        ▼
冲突解决 → 更新 Store → isInitializedRef = true
        │
        ▼
[Strict Mode cleanup]
        │
        ▼
[第二次执行 Effect]
        │
        ▼
检测到:
- storeProjectId === projectData.id ✅
- pages.length > 0 ✅
        │
        ▼
→ REMOUNT 场景，跳过冲突解决
```

**关键点**：

- 第一次 Effect 已经更新了 Store
- 第二次 Effect 检测到 Store 已有当前项目数据
- 正确跳过重复的冲突解决逻辑

## 场景判断逻辑 / Scenario Detection Logic

在 `page.tsx` 的冲突解决 Effect 中：

```typescript
// 场景 1: REMOUNT - 重新挂载
// Store 已有当前项目数据，跳过冲突解决
if (storeProjectId === projectData.id && pages.length > 0) {
  // → 直接使用 Store 数据
  return
}

// 场景 2-4: FIRST_LOAD - 首次加载或切换项目
// 需要执行完整的冲突解决流程
```

## 冲突解决策略 / Conflict Resolution Strategy

```typescript
// 在 conflictResolution.ts 中

interface ResolveResult {
  source: "server" | "local"
  pages: Page[]
  activePageId: string
  projectName: string
  shouldSyncToLocal: boolean
}

// 决策逻辑:
// 1. 如果没有本地数据 → 使用服务器数据
// 2. 如果本地没有未保存更改 → 使用服务器数据
// 3. 如果本地有未保存更改且时间戳更新 → 使用本地数据
// 4. 否则 → 使用服务器数据
```

## 自动保存流程 / Auto Save Flow

```
用户操作 (拖动、编辑等)
        │
        ▼
Canvas 事件触发 → updatePage() 更新 Store
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  useAutoSave Effect 触发                                       │
│                                                               │
│  步骤 1: 立即保存到 LocalStorage (L2)                          │
│  └─ 使用 lastLocalSaveTimeRef 防止 Strict Mode 重复保存        │
│                                                               │
│  步骤 2: 防抖保存到服务器 (200ms)                              │
│  └─ 使用 debounceTimerRef，多次操作合并为一次请求              │
└───────────────────────────────────────────────────────────────┘
```

## React Strict Mode 注意事项 / React Strict Mode Considerations

### 问题

React Strict Mode 会同步执行 Effect 两次：

1. 第一次执行 (setup)
2. cleanup
3. 第二次执行 (setup)

这可能导致：

- 重复的 API 请求
- 重复的 LocalStorage 写入
- Timer 冲突

### 解决方案

1. **使用 Ref 记录上次执行时间**

```typescript
const lastLocalSaveTimeRef = useRef<number>(0)

useEffect(() => {
  const now = Date.now()
  if (now - lastLocalSaveTimeRef.current < 100) {
    return // 跳过重复调用
  }
  lastLocalSaveTimeRef.current = now
  // 执行保存...
}, [deps])
```

2. **使用唯一 Timer ID**

```typescript
const timerId = `LocalStorage Save ${Date.now()}`
debug.time(timerId)
// ...
debug.timeEnd(timerId)
```

3. **使用 Ref 标记初始化状态**

```typescript
const isInitializedRef = useRef(false)

useEffect(() => {
  if (isInitializedRef.current) return
  isInitializedRef.current = true
  // 执行初始化...
}, [deps])
```

## 调试技巧 / Debugging Tips

### 开启完整调试

```javascript
__FICVA_DEBUG_UTILS__.enableAll()
```

### 只看数据流相关

```javascript
__FICVA_DEBUG_UTILS__.enable()
__FICVA_DEBUG_UTILS__.enableModule("projectDataFetch")
__FICVA_DEBUG_UTILS__.enableModule("conflictResolution")
__FICVA_DEBUG_UTILS__.enableModule("canvasDataLoad")
__FICVA_DEBUG_UTILS__.enableModule("editorPage")
```

### 关键日志标识

| 标识                        | 含义                       |
| --------------------------- | -------------------------- |
| `📍 Scenario: REMOUNT`      | 检测到重新挂载，跳过初始化 |
| `📍 Scenario: FIRST_LOAD`   | 首次加载，执行完整初始化   |
| `📍 Scenario: EMPTY_PAGE`   | 空页面，无需加载 JSON      |
| `📍 Scenario: INITIAL_SAVE` | 新项目首次保存             |

## 常见问题排查 / Troubleshooting

### Q: 为什么看到 REMOUNT 但我是新创建的项目？

A: 可能原因：

1. 之前已经有项目在编辑器中打开（Store 残留数据）
2. React Strict Mode 的第二次 Effect 执行
3. 热更新 (HMR) 导致组件重新挂载

检查方法：查看 debug 日志中 `storeProjectId` 和 `projectData.id` 是否一致。

### Q: 为什么 LocalStorage 被保存了两次？

A: React Strict Mode 下 Effect 会执行两次。解决方案已实现：使用 `lastLocalSaveTimeRef` 检测并跳过 100ms 内的重复调用。

### Q: 为什么切换项目后画布没有更新？

A: 检查以下几点：

1. `storeProjectId` 是否已更新
2. `useCanvasDataLoad` 是否检测到页面变化
3. Canvas 的 `loadFromJSON` 是否成功执行

## 相关 Skill

- `debug-system`: 调试系统使用指南
- `fabric-canvas`: Canvas 初始化和 Hook 架构
