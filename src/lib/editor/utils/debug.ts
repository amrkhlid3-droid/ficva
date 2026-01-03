/**
 * Debug 配置模块
 *
 * 提供统一的调试日志系统，支持：
 * - 全局开关：控制所有模块的调试输出
 * - 模块级开关：精细控制每个模块的调试输出
 * - 只有当全局开关和模块开关同时开启时，才输出调试信息
 *
 * 使用方式：
 * 1. 在浏览器控制台设置：
 *    - window.__FICVA_DEBUG__ = true  // 开启全局调试
 *    - window.__FICVA_DEBUG_MODULES__ = { projectDataFetch: true, conflictResolution: true }
 *
 * 2. 或在代码中调用：
 *    - setDebugEnabled(true)
 *    - setModuleDebug('projectDataFetch', true)
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 可调试的模块列表
 */
export type DebugModule =
  | "projectDataFetch" // 项目数据获取
  | "conflictResolution" // 冲突解决
  | "canvasDataLoad" // 画布数据加载
  | "editorPage" // 编辑器页面
  | "fabricCanvasMinimal" // FabricCanvas.minimal 组件
  | "autoSave" // 自动保存
  | "initialCanvasSave" // 初始化完成后首次保存
  | "sessionGuard" // 会话守卫与设备指纹验证

/**
 * 模块调试配置
 */
export type ModuleDebugConfig = {
  [K in DebugModule]?: boolean
}

/**
 * 调试日志级别
 */
export type LogLevel = "info" | "warn" | "error" | "success" | "group"

// ============================================================================
// 全局变量声明（用于浏览器控制台访问）
// ============================================================================

declare global {
  interface Window {
    /** 全局调试开关 */
    __FICVA_DEBUG__?: boolean
    /** 模块级调试开关 */
    __FICVA_DEBUG_MODULES__?: ModuleDebugConfig
    /** 调试工具函数 */
    __FICVA_DEBUG_UTILS__?: {
      enable: () => void
      disable: () => void
      enableModule: (module: DebugModule) => void
      disableModule: (module: DebugModule) => void
      enableAll: () => void
      disableAll: () => void
      status: () => void
    }
  }
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 默认模块调试配置
 * 开发环境默认开启，生产环境默认关闭
 */
const defaultModuleConfig: ModuleDebugConfig = {
  projectDataFetch: true,
  conflictResolution: true,
  canvasDataLoad: true,
  editorPage: true,
  fabricCanvasMinimal: true,
  autoSave: true,
  initialCanvasSave: true,
  sessionGuard: true,
}

/**
 * 默认全局调试开关
 * 开发环境默认开启
 */
const DEFAULT_DEBUG_ENABLED = true

/**
 * 模块显示名称映射
 */
const moduleDisplayNames: Record<DebugModule, string> = {
  projectDataFetch: "📡 ProjectDataFetch",
  conflictResolution: "⚔️ ConflictResolution",
  canvasDataLoad: "🎨 CanvasDataLoad",
  editorPage: "📄 EditorPage",
  fabricCanvasMinimal: "🖼️ FabricCanvasMinimal",
  autoSave: "💾 AutoSave",
  initialCanvasSave: "🚀 InitialCanvasSave",
  sessionGuard: "🔐 SessionGuard",
}

/**
 * 日志级别对应的样式
 */
const logStyles: Record<LogLevel, string> = {
  info: "color: #3b82f6; font-weight: bold;",
  warn: "color: #f59e0b; font-weight: bold;",
  error: "color: #ef4444; font-weight: bold;",
  success: "color: #10b981; font-weight: bold;",
  group: "color: #8b5cf6; font-weight: bold; font-size: 12px;",
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 检查全局调试是否开启
 * 如果 window.__FICVA_DEBUG__ 未设置，使用默认值 DEFAULT_DEBUG_ENABLED
 */
export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  // 如果未初始化，使用默认值
  if (window.__FICVA_DEBUG__ === undefined) {
    return DEFAULT_DEBUG_ENABLED
  }
  return window.__FICVA_DEBUG__ === true
}

/**
 * 检查特定模块的调试是否开启
 * 需要同时满足：全局开启 + 模块开启
 */
export function isModuleDebugEnabled(module: DebugModule): boolean {
  if (!isDebugEnabled()) return false
  if (typeof window === "undefined") return false

  const moduleConfig = window.__FICVA_DEBUG_MODULES__ || defaultModuleConfig
  return moduleConfig[module] === true
}

/**
 * 设置全局调试开关
 */
export function setDebugEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  window.__FICVA_DEBUG__ = enabled

  if (enabled) {
    console.log(
      "%c🔧 FICVA Debug Mode ENABLED",
      "color: #10b981; font-weight: bold; font-size: 14px;"
    )
    console.log("Use window.__FICVA_DEBUG_UTILS__.status() to see config")
  } else {
    console.log(
      "%c🔧 FICVA Debug Mode DISABLED",
      "color: #6b7280; font-weight: bold; font-size: 14px;"
    )
  }
}

/**
 * 设置特定模块的调试开关
 */
export function setModuleDebug(module: DebugModule, enabled: boolean): void {
  if (typeof window === "undefined") return

  if (!window.__FICVA_DEBUG_MODULES__) {
    window.__FICVA_DEBUG_MODULES__ = { ...defaultModuleConfig }
  }

  window.__FICVA_DEBUG_MODULES__[module] = enabled

  const status = enabled ? "ENABLED ✅" : "DISABLED ❌"
  console.log(
    `%c${moduleDisplayNames[module]} Debug: ${status}`,
    enabled ? "color: #10b981;" : "color: #6b7280;"
  )
}

// ============================================================================
// 调试日志输出函数
// ============================================================================

/**
 * 创建模块专用的调试日志器
 */
export function createModuleLogger(module: DebugModule) {
  const prefix = moduleDisplayNames[module]

  return {
    /**
     * 输出信息级别日志
     */
    info: (message: string, data?: unknown) => {
      if (!isModuleDebugEnabled(module)) return
      console.log(`%c${prefix}`, logStyles.info, message, data ?? "")
    },

    /**
     * 输出警告级别日志
     */
    warn: (message: string, data?: unknown) => {
      if (!isModuleDebugEnabled(module)) return
      console.warn(`%c${prefix}`, logStyles.warn, message, data ?? "")
    },

    /**
     * 输出错误级别日志
     */
    error: (message: string, data?: unknown) => {
      if (!isModuleDebugEnabled(module)) return
      console.error(`%c${prefix}`, logStyles.error, message, data ?? "")
    },

    /**
     * 输出成功级别日志
     */
    success: (message: string, data?: unknown) => {
      if (!isModuleDebugEnabled(module)) return
      console.log(`%c${prefix} ✅`, logStyles.success, message, data ?? "")
    },

    /**
     * 开始一个日志分组
     */
    group: (title: string) => {
      if (!isModuleDebugEnabled(module)) return
      console.group(`%c${prefix} ${title}`, logStyles.group)
    },

    /**
     * 结束日志分组
     */
    groupEnd: () => {
      if (!isModuleDebugEnabled(module)) return
      console.groupEnd()
    },

    /**
     * 输出表格数据
     */
    table: (data: unknown) => {
      if (!isModuleDebugEnabled(module)) return
      console.table(data)
    },

    /**
     * 输出时间戳
     */
    time: (label: string) => {
      if (!isModuleDebugEnabled(module)) return
      console.time(`${prefix} ${label}`)
    },

    /**
     * 结束时间戳
     */
    timeEnd: (label: string) => {
      if (!isModuleDebugEnabled(module)) return
      console.timeEnd(`${prefix} ${label}`)
    },

    /**
     * 输出健康状态报告
     */
    health: (status: "healthy" | "warning" | "error", details: string) => {
      if (!isModuleDebugEnabled(module)) return

      const statusEmoji =
        status === "healthy" ? "💚" : status === "warning" ? "💛" : "💔"
      const style =
        status === "healthy"
          ? logStyles.success
          : status === "warning"
            ? logStyles.warn
            : logStyles.error

      console.log(`%c${prefix} Health: ${statusEmoji}`, style, details)
    },

    /**
     * 输出场景信息
     */
    scenario: (name: string, description: string) => {
      if (!isModuleDebugEnabled(module)) return
      console.log(
        `%c${prefix} 📍 Scenario: ${name}`,
        "color: #a855f7; font-weight: bold;",
        `\n   ${description}`
      )
    },

    /**
     * 输出状态变化
     */
    stateChange: (stateName: string, oldValue: unknown, newValue: unknown) => {
      if (!isModuleDebugEnabled(module)) return
      console.log(
        `%c${prefix} State Change: ${stateName}`,
        "color: #06b6d4; font-weight: bold;",
        { from: oldValue, to: newValue }
      )
    },
  }
}

// ============================================================================
// 初始化调试工具
// ============================================================================

/**
 * 初始化全局调试工具
 * 在浏览器控制台提供便捷的调试命令
 */
export function initDebugUtils(): void {
  if (typeof window === "undefined") return

  // 初始化全局调试开关（如果未设置）
  if (window.__FICVA_DEBUG__ === undefined) {
    window.__FICVA_DEBUG__ = DEFAULT_DEBUG_ENABLED
  }

  // 初始化模块调试配置（如果未设置）
  if (!window.__FICVA_DEBUG_MODULES__) {
    window.__FICVA_DEBUG_MODULES__ = { ...defaultModuleConfig }
  }

  // 注册调试工具函数
  window.__FICVA_DEBUG_UTILS__ = {
    enable: () => setDebugEnabled(true),
    disable: () => setDebugEnabled(false),
    enableModule: (module: DebugModule) => setModuleDebug(module, true),
    disableModule: (module: DebugModule) => setModuleDebug(module, false),
    enableAll: () => {
      setDebugEnabled(true)
      Object.keys(defaultModuleConfig).forEach((module) => {
        setModuleDebug(module as DebugModule, true)
      })
    },
    disableAll: () => {
      setDebugEnabled(false)
      Object.keys(defaultModuleConfig).forEach((module) => {
        setModuleDebug(module as DebugModule, false)
      })
    },
    status: () => {
      console.log("\n")
      console.log(
        "%c🔧 FICVA Debug Status",
        "color: #8b5cf6; font-weight: bold; font-size: 16px;"
      )
      console.log("─".repeat(50))
      console.log(
        `Global Debug: ${isDebugEnabled() ? "✅ ENABLED" : "❌ DISABLED"}`
      )
      console.log("\nModule Status:")
      Object.entries(window.__FICVA_DEBUG_MODULES__ || {}).forEach(
        ([module, enabled]) => {
          const displayName = moduleDisplayNames[module as DebugModule]
          const status = enabled ? "✅ ON" : "❌ OFF"
          const effective =
            isDebugEnabled() && enabled ? "(active)" : "(inactive)"
          console.log(`  ${displayName}: ${status} ${effective}`)
        }
      )
      console.log("\n💡 Quick Commands:")
      console.log("  __FICVA_DEBUG_UTILS__.enable()        - Enable global")
      console.log("  __FICVA_DEBUG_UTILS__.enableAll()     - Enable all")
      console.log(
        "  __FICVA_DEBUG_UTILS__.enableModule('editorPage') - Enable module"
      )
      console.log("─".repeat(50))
      console.log("\n")
    },
  }

  // 输出初始化信息
  console.log(
    "%c🔧 FICVA Debug Utils Initialized",
    "color: #6b7280; font-size: 11px;"
  )
  console.log(
    "%c   Use __FICVA_DEBUG_UTILS__.status() to see options",
    "color: #6b7280; font-size: 10px;"
  )
}

// ============================================================================
// 模块专用日志器实例
// ============================================================================

export const debugProjectDataFetch = createModuleLogger("projectDataFetch")
export const debugConflictResolution = createModuleLogger("conflictResolution")
export const debugCanvasDataLoad = createModuleLogger("canvasDataLoad")
export const debugEditorPage = createModuleLogger("editorPage")
export const debugFabricCanvasMinimal = createModuleLogger(
  "fabricCanvasMinimal"
)
export const debugAutoSave = createModuleLogger("autoSave")
export const debugInitialCanvasSave = createModuleLogger("initialCanvasSave")
export const debugSessionGuard = createModuleLogger("sessionGuard")
