---
name: debug-system
description: FICVA 调试系统使用指南。当需要：调试模块加载问题、查看数据流向、追踪场景分支、或为新模块添加调试日志时使用此 skill。
---

# FICVA 调试系统 / Debug System

## 概述 / Overview

FICVA 使用双层调试标志系统，支持全局开关和模块级开关。只有当**两者同时开启**时，才会输出调试信息。

## 快速开始 / Quick Start

在浏览器控制台运行：

```javascript
// 开启所有调试
__FICVA_DEBUG_UTILS__.enableAll()

// 查看当前状态
__FICVA_DEBUG_UTILS__.status()

// 关闭所有调试
__FICVA_DEBUG_UTILS__.disableAll()
```

## 文件结构 / File Structure

```
src/lib/editor/utils/
└── debug.ts              # 调试配置模块

使用调试的模块：
├── src/hooks/useProjectDataFetch.ts    # 项目数据获取
├── src/hooks/useCanvasDataLoad.ts      # 画布数据加载
├── src/hooks/useAutoSave.ts            # 自动保存
├── src/lib/editor/utils/conflictResolution.ts  # 冲突解决
├── src/app/editor/[id]/page.tsx        # 编辑器主页面
└── src/components/editor/FabricCanvas.minimal.tsx  # 最小化画布组件
```

## 可用模块 / Available Modules

| 模块 Module           | 用途 Purpose            | 输出内容 Output                             |
| --------------------- | ----------------------- | ------------------------------------------- |
| `projectDataFetch`    | 项目数据获取            | API 请求、响应数据、JSON 结构分析           |
| `conflictResolution`  | 本地/服务器数据冲突解决 | 时间戳比较、决策过程、数据来源              |
| `canvasDataLoad`      | 画布数据加载            | 加载状态、对象列表、加载耗时                |
| `editorPage`          | 编辑器页面协调          | 生命周期、模块协调、健康状态总览            |
| `fabricCanvasMinimal` | FabricCanvas.minimal    | 画布初始化、尺寸、选项、清理过程            |
| `autoSave`            | 自动保存                | 保存触发、防抖状态、LocalStorage/服务器同步 |

## 控制台命令 / Console Commands

```javascript
// 全局控制
__FICVA_DEBUG_UTILS__.enable() // 开启全局调试
__FICVA_DEBUG_UTILS__.disable() // 关闭全局调试

// 模块控制
__FICVA_DEBUG_UTILS__.enableModule("projectDataFetch") // 开启指定模块
__FICVA_DEBUG_UTILS__.disableModule("conflictResolution") // 关闭指定模块

// 批量操作
__FICVA_DEBUG_UTILS__.enableAll() // 开启全局 + 所有模块
__FICVA_DEBUG_UTILS__.disableAll() // 关闭全局 + 所有模块

// 状态查看
__FICVA_DEBUG_UTILS__.status() // 显示当前配置状态
```

## 手动配置 / Manual Configuration

也可以直接设置全局变量：

```javascript
// 全局开关
window.__FICVA_DEBUG__ = true

// 模块开关
window.__FICVA_DEBUG_MODULES__ = {
  projectDataFetch: true,
  conflictResolution: true,
  canvasDataLoad: false,
  editorPage: true,
  fabricCanvasMinimal: true,
  autoSave: true,
}
```

## 调试输出说明 / Debug Output Guide

### 日志级别 / Log Levels

| 方法 Method | 样式 Style   | 用途 Usage    |
| ----------- | ------------ | ------------- |
| `info()`    | 蓝色 Blue    | 常规信息      |
| `warn()`    | 橙色 Orange  | 警告信息      |
| `error()`   | 红色 Red     | 错误信息      |
| `success()` | 绿色 Green   | 成功/完成状态 |
| `group()`   | 紫色 Purple  | 开始日志分组  |
| `table()`   | 默认 Default | 表格数据      |

### 特殊方法 / Special Methods

```javascript
// 场景追踪 - 标识当前执行的代码分支
debug.scenario("MULTI_PAGE", "Server data contains pages array")

// 健康状态 - 显示模块运行状况
debug.health("healthy", "Data loaded successfully") // 💚
debug.health("warning", "Using fallback data") // 💛
debug.health("error", "Failed to load") // 💔

// 状态变化 - 追踪状态更新
debug.stateChange("activePageId", oldValue, newValue)

// 计时器 - 测量执行时间
debug.time("Canvas Load")
// ... 执行代码
debug.timeEnd("Canvas Load")
```

## 为新模块添加调试 / Adding Debug to New Module

### 步骤 1: 注册模块类型

编辑 `src/lib/editor/utils/debug.ts`:

```typescript
// 添加新模块到类型定义
export type DebugModule =
  | "projectDataFetch"
  | "conflictResolution"
  | "canvasDataLoad"
  | "editorPage"
  | "fabricCanvasMinimal"
  | "autoSave"
  | "yourNewModule" // 新增

// 添加默认配置
const defaultModuleConfig: ModuleDebugConfig = {
  projectDataFetch: false,
  conflictResolution: false,
  canvasDataLoad: false,
  editorPage: false,
  fabricCanvasMinimal: false,
  autoSave: false,
  yourNewModule: false, // 新增
}

// 添加显示名称
const moduleDisplayNames: Record<DebugModule, string> = {
  projectDataFetch: "📡 ProjectDataFetch",
  conflictResolution: "⚔️ ConflictResolution",
  canvasDataLoad: "🎨 CanvasDataLoad",
  editorPage: "📄 EditorPage",
  fabricCanvasMinimal: "🖼️ FabricCanvasMinimal",
  autoSave: "💾 AutoSave",
  yourNewModule: "🔧 YourNewModule", // 新增（选择合适的 emoji）
}

// 创建并导出 logger 实例
export const debugFabricCanvasMinimal = createModuleLogger(
  "fabricCanvasMinimal"
)
export const debugAutoSave = createModuleLogger("autoSave")
export const debugYourNewModule = createModuleLogger("yourNewModule")
```

### 步骤 2: 在模块中使用

```typescript
import { debugYourNewModule as debug } from "@/lib/editor/utils/debug"

export function yourFunction() {
  debug.group("yourFunction")
  debug.info("Starting execution", { param1, param2 })

  try {
    // 业务逻辑
    debug.scenario("SCENARIO_A", "Handling case A")

    // ... 执行代码

    debug.success("Operation completed", { result })
    debug.health("healthy", "Function executed successfully")
  } catch (error) {
    debug.error("Operation failed", { error: error.message })
    debug.health("error", `Failed: ${error.message}`)
  }

  debug.groupEnd()
}
```

## 调试场景示例 / Debug Scenario Examples

### 场景 1: 调试项目加载问题

```javascript
// 只开启数据获取和冲突解决
__FICVA_DEBUG_UTILS__.enable()
__FICVA_DEBUG_UTILS__.enableModule("projectDataFetch")
__FICVA_DEBUG_UTILS__.enableModule("conflictResolution")
```

输出示例：

```
📡 ProjectDataFetch Effect triggered { projectId: "xxx" }
📡 ProjectDataFetch Fetch Duration: 234ms
📡 ProjectDataFetch JSON structure: Multi-page { pageCount: 3 }
⚔️ ConflictResolution Comparing timestamps { serverTime, localTime, difference }
⚔️ ConflictResolution Decision: Using SERVER data
```

### 场景 2: 调试画布加载问题

```javascript
__FICVA_DEBUG_UTILS__.enable()
__FICVA_DEBUG_UTILS__.enableModule("canvasDataLoad")
```

输出示例：

```
🎨 CanvasDataLoad Loading page: page-uuid-1
🎨 CanvasDataLoad Objects to load:
┌─────────┬──────────┬───────────┬─────────┐
│ (index) │   type   │   name    │ visible │
├─────────┼──────────┼───────────┼─────────┤
│    0    │  'rect'  │  'bg'     │  true   │
│    1    │  'path'  │  'logo'   │  true   │
└─────────┴──────────┴───────────┴─────────┘
🎨 CanvasDataLoad Canvas Load Duration: 156ms
🎨 CanvasDataLoad ✅ Canvas loaded with 2 objects
```

### 场景 3: 调试 FabricCanvas.minimal 初始化

```javascript
__FICVA_DEBUG_UTILS__.enable()
__FICVA_DEBUG_UTILS__.enableModule("fabricCanvasMinimal")
```

输出示例：

```
🖼️ FabricCanvasMinimal Canvas Initialization
🖼️ FabricCanvasMinimal Starting canvas initialization
🖼️ FabricCanvasMinimal Canvas element created and appended to container
🖼️ FabricCanvasMinimal Container dimensions { width: 1200, height: 800 }
🖼️ FabricCanvasMinimal Fabric.js Canvas Creation: 12.5ms
🖼️ FabricCanvasMinimal Canvas options { backgroundColor: "transparent", ... }
🖼️ FabricCanvasMinimal ✅ Canvas registered to store
🖼️ FabricCanvasMinimal Health: 💚 Canvas initialized successfully
```

### 场景 4: 调试自动保存

```javascript
__FICVA_DEBUG_UTILS__.enable()
__FICVA_DEBUG_UTILS__.enableModule("autoSave")
```

输出示例：

```
💾 AutoSave Auto Save Triggered
💾 AutoSave Data changed, preparing to save { projectId: "xxx", pageCount: 2 }
💾 AutoSave LocalStorage Save: 2.5ms
💾 AutoSave ✅ Saved to LocalStorage { projectId: "xxx", unsavedChanges: true }
💾 AutoSave Debounce timer set (200ms)
💾 AutoSave Debounce timer fired (200ms elapsed)
💾 AutoSave Sending PATCH request to server
💾 AutoSave Server Save: 156ms
💾 AutoSave ✅ Server save successful { status: 200 }
💾 AutoSave Health: 💚 All data synced to server
```

### 场景 5: 查看整体健康状态

```javascript
__FICVA_DEBUG_UTILS__.enable()
__FICVA_DEBUG_UTILS__.enableModule("editorPage")
```

输出示例：

```
📄 EditorPage Health Status Overview
┌─────────────────────┬───────────┬─────────────────┐
│      (index)        │  status   │     detail      │
├─────────────────────┼───────────┼─────────────────┤
│  projectDataFetch   │ 'healthy' │      'OK'       │
│ conflictResolution  │ 'healthy' │   'Resolved'    │
│   canvasDataLoad    │ 'healthy' │    'Ready'      │
│      overall        │ 'healthy' │                 │
└─────────────────────┴───────────┴─────────────────┘
```

## API 参考 / API Reference

### createModuleLogger(module: DebugModule)

创建模块专用的 logger 实例：

```typescript
const debug = createModuleLogger("myModule")

debug.info(message, data?)      // 信息日志
debug.warn(message, data?)      // 警告日志
debug.error(message, data?)     // 错误日志
debug.success(message, data?)   // 成功日志
debug.group(title)              // 开始分组
debug.groupEnd()                // 结束分组
debug.table(data)               // 表格输出
debug.time(label)               // 开始计时
debug.timeEnd(label)            // 结束计时
debug.health(status, details)   // 健康状态
debug.scenario(name, desc)      // 场景标识
debug.stateChange(name, old, new) // 状态变化
```

### 全局函数 / Global Functions

```typescript
isDebugEnabled(): boolean           // 检查全局调试是否开启
isModuleDebugEnabled(module): boolean  // 检查模块调试是否开启
setDebugEnabled(enabled): void      // 设置全局调试开关
setModuleDebug(module, enabled): void  // 设置模块调试开关
initDebugUtils(): void              // 初始化调试工具（注册到 window）
```

## 注意事项 / Notes

1. **生产环境**: 调试日志在生产环境默认关闭，不会影响性能
2. **SSR 兼容**: 所有 window 访问都有 `typeof window === "undefined"` 检查
3. **双重条件**: 必须同时开启全局和模块开关才能看到日志
4. **持久化**: 调试状态不会持久化，刷新页面后需重新开启
