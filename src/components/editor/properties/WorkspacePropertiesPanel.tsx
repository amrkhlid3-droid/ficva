"use client"

/**
 * WorkspacePropertiesPanel - Workspace 属性面板
 *
 * 显示和编辑 Workspace 对象的属性：
 * - 宽度和高度
 * - 填充颜色（支持透明度）
 * - 预设颜色面板
 *
 * 可插拔设计：可以在 PropertiesPanel 中按需引入或移除
 */

import { useState, useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { findWorkspace, type WorkspaceObject } from "@/lib/editor/workspace"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { NumberInput } from "./NumberInput"
import { DraggableLabel } from "./DraggableLabel"
import { Color } from "fabric"

/** 主题默认填充色 */
const THEME_FILL_COLORS = {
  light: "#e5e5e5",
  dark: "#404040",
} as const

/** 获取当前主题的默认填充色 */
function getThemeFillColor(): string {
  if (typeof window === "undefined") return THEME_FILL_COLORS.light
  const isDark = document.documentElement.classList.contains("dark")
  return isDark ? THEME_FILL_COLORS.dark : THEME_FILL_COLORS.light
}

/** 从填充值获取 hex 字符串 */
function getFillHex(fill: string): string {
  if (fill === "transparent" || !fill) return ""
  try {
    const hex = new Color(fill).toHex()
    return hex.toUpperCase()
  } catch {
    return "FFFFFF"
  }
}

/** 从填充值获取透明度 */
function getFillAlpha(fill: string): number {
  if (fill === "transparent" || !fill) return 0
  try {
    return new Color(fill).getAlpha()
  } catch {
    return 1
  }
}

export function WorkspacePropertiesPanel() {
  const canvas = useEditorStore((s) => s.canvas)
  const history = useEditorStore((s) => s.history)

  // 本地状态：追踪 workspace 的属性
  const [width, setWidth] = useState(1200)
  const [height, setHeight] = useState(800)
  const [fill, setFill] = useState("transparent")
  const [followTheme, setFollowTheme] = useState(true)

  // 从 fill 状态派生 hex 和 alpha
  const fillHex = getFillHex(fill)
  const fillAlpha = getFillAlpha(fill)

  // 监听 canvas 事件，同步 workspace 属性到本地状态
  useEffect(() => {
    if (!canvas) return

    // 同步函数
    const syncFromWorkspace = () => {
      const workspace = findWorkspace(canvas)
      if (workspace) {
        setWidth(workspace.width ?? 1200)
        setHeight(workspace.height ?? 800)
        const workspaceFill = workspace.fill
        if (
          workspaceFill &&
          workspaceFill !== "transparent" &&
          typeof workspaceFill === "string"
        ) {
          setFill(workspaceFill)
        } else {
          setFill("transparent")
        }
        // 同步 followTheme 状态（undefined 视为 true，向后兼容）
        setFollowTheme((workspace as WorkspaceObject).followTheme ?? true)
      }
    }

    // 初始同步
    syncFromWorkspace()

    // 监听 object:added 事件（workspace 从 JSON 加载时触发）
    canvas.on("object:added", syncFromWorkspace)
    // 监听 object:modified 事件（用户修改时触发）
    canvas.on("object:modified", syncFromWorkspace)

    return () => {
      canvas.off("object:added", syncFromWorkspace)
      canvas.off("object:modified", syncFromWorkspace)
    }
  }, [canvas])

  if (!canvas) return null

  const workspace = findWorkspace(canvas)

  // 修改 workspace 填充颜色
  const updateWorkspaceFill = (newFill: string) => {
    if (!workspace) return

    // 用户选择自定义颜色时自动取消勾选 Follow Theme
    const props: Record<string, unknown> = { fill: newFill }
    const originalProps: Record<string, unknown> = { fill: workspace.fill }

    if ((workspace as WorkspaceObject).followTheme) {
      props.followTheme = false
      originalProps.followTheme = true
      setFollowTheme(false)
    }

    const command = new ModifyObjectCommand(workspace, props, originalProps)
    history.execute(command)
    // 立即更新本地状态以保证 UI 响应
    setFill(newFill)
  }

  // 切换 Follow Theme 状态
  const updateFollowTheme = (checked: boolean) => {
    if (!workspace) return

    if (checked) {
      // 重新启用：重置填充色为主题默认色
      const themeFill = getThemeFillColor()

      const command = new ModifyObjectCommand(
        workspace,
        { fill: themeFill, followTheme: true },
        {
          fill: workspace.fill,
          followTheme: (workspace as WorkspaceObject).followTheme,
        }
      )
      history.execute(command)
      setFill(themeFill)
    } else {
      // 禁用：仅更新标志
      const command = new ModifyObjectCommand(
        workspace,
        { followTheme: false },
        { followTheme: (workspace as WorkspaceObject).followTheme }
      )
      history.execute(command)
    }
    setFollowTheme(checked)
  }

  // 修改 workspace 尺寸
  const updateWorkspaceWidth = (newWidth: number) => {
    if (!workspace) return
    const command = new ModifyObjectCommand(
      workspace,
      { width: newWidth },
      { width: workspace.width }
    )
    history.execute(command)
    setWidth(newWidth)
  }

  const updateWorkspaceHeight = (newHeight: number) => {
    if (!workspace) return
    const command = new ModifyObjectCommand(
      workspace,
      { height: newHeight },
      { height: workspace.height }
    )
    history.execute(command)
    setHeight(newHeight)
  }

  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col">
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Workspace
          </div>
        </div>

        {/* Workspace Dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] uppercase">
              Width
            </label>
            <NumberInput
              value={width}
              onChange={updateWorkspaceWidth}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] uppercase">
              Height
            </label>
            <NumberInput
              value={height}
              onChange={updateWorkspaceHeight}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
        </div>

        {/* Workspace Background */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground block text-xs font-medium uppercase">
              Fill
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={followTheme}
                onChange={(e) => updateFollowTheme(e.target.checked)}
                className="border-input h-3 w-3 rounded"
              />
              <span className="text-muted-foreground text-[10px]">
                Follow Theme
              </span>
            </label>
          </div>

          {/* Color Picker Row */}
          <div className="flex items-center gap-3">
            {/* Color Preview & Picker */}
            <div className="relative">
              <div
                className="border-border h-8 w-8 overflow-hidden rounded border"
                style={{
                  backgroundColor: fill === "transparent" ? undefined : fill,
                  backgroundImage:
                    fill === "transparent"
                      ? "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)"
                      : "none",
                  backgroundSize: "8px 8px",
                  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                }}
              />
              <input
                type="color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={fillHex ? `#${fillHex}` : "#ffffff"}
                onChange={(e) => {
                  const newHex = e.target.value
                  // 如果当前透明度为 0，选择新颜色时自动设置为 100%
                  const alpha = fillAlpha === 0 ? 1 : fillAlpha
                  const newColor = new Color(newHex)
                  newColor.setAlpha(alpha)
                  updateWorkspaceFill(newColor.toRgba())
                }}
              />
            </div>

            {/* Hex Input */}
            <input
              type="text"
              className="bg-input/50 border-input text-foreground w-20 rounded border px-2 py-1 font-mono text-xs uppercase"
              value={fillHex}
              placeholder="None"
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9A-Fa-f]/g, "")
                if (value.length === 6) {
                  // 如果当前透明度为 0，输入颜色时自动设置为 100%
                  const alpha = fillAlpha === 0 ? 1 : fillAlpha
                  const newColor = new Color(`#${value}`)
                  newColor.setAlpha(alpha)
                  updateWorkspaceFill(newColor.toRgba())
                }
              }}
            />

            {/* Opacity Input */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                className="bg-input/50 border-input text-foreground w-14 rounded border px-2 py-1 text-center text-xs"
                value={Math.round(fillAlpha * 100)}
                onChange={(e) => {
                  const newAlpha = Math.max(
                    0,
                    Math.min(100, parseInt(e.target.value) || 0)
                  )
                  let baseColor = new Color("#ffffff")
                  if (fill && fill !== "transparent") {
                    try {
                      baseColor = new Color(fill)
                    } catch {
                      // ignore
                    }
                  }
                  baseColor.setAlpha(newAlpha / 100)
                  updateWorkspaceFill(baseColor.toRgba())
                }}
              />
              <DraggableLabel
                value={Math.round(fillAlpha * 100)}
                onChange={(newAlpha) => {
                  let baseColor = new Color("#ffffff")
                  if (fill && fill !== "transparent") {
                    try {
                      baseColor = new Color(fill)
                    } catch {
                      // ignore
                    }
                  }
                  baseColor.setAlpha(newAlpha / 100)
                  updateWorkspaceFill(baseColor.toRgba())
                }}
                min={0}
                max={100}
                className="text-muted-foreground text-xs"
              >
                %
              </DraggableLabel>
            </div>
          </div>

          {/* Preset Colors - Professional palette */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { color: "#ffffff", label: "White" },
              { color: "#f5f5f5", label: "Gray 100" },
              { color: "#e5e5e5", label: "Gray 200" },
              { color: "#d4d4d4", label: "Gray 300" },
              { color: "#a3a3a3", label: "Gray 400" },
              { color: "#737373", label: "Gray 500" },
              { color: "#525252", label: "Gray 600" },
              { color: "#404040", label: "Gray 700" },
              { color: "#262626", label: "Gray 800" },
              { color: "#171717", label: "Gray 900" },
              { color: "#000000", label: "Black" },
              { color: "transparent", label: "None" },
            ].map(({ color, label }) => (
              <button
                key={color}
                onClick={() => {
                  updateWorkspaceFill(
                    color === "transparent" ? "transparent" : color
                  )
                }}
                className={`border-border relative h-5 w-5 rounded border transition-all hover:scale-110 hover:ring-2 hover:ring-offset-1 ${
                  fill === color ? "ring-primary ring-2 ring-offset-1" : ""
                }`}
                style={{
                  backgroundColor: color !== "transparent" ? color : undefined,
                  backgroundImage:
                    color === "transparent"
                      ? "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)"
                      : "none",
                  backgroundSize: "6px 6px",
                  backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
                }}
                title={label}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
