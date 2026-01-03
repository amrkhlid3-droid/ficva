"use client"

/**
 * PenToolPropertiesPanel - 钢笔工具属性面板
 *
 * 显示和编辑钢笔工具的配置：
 * - 描边颜色
 * - 描边宽度
 * - 线条样式（实线/虚线/点线）
 * - 线端样式
 * - 线条连接样式
 *
 * 可插拔设计：可以在 PropertiesPanel 中按需引入或移除
 */

import { useEditorStore } from "@/store/useEditorStore"

export function PenToolPropertiesPanel() {
  const penToolConfig = useEditorStore((s) => s.penToolConfig)
  const setPenToolConfig = useEditorStore((s) => s.setPenToolConfig)

  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col">
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Pen Tool Settings
          </div>
        </div>

        {/* Stroke Color */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Stroke Color
          </label>
          <input
            type="color"
            value={penToolConfig.stroke}
            onChange={(e) => setPenToolConfig({ stroke: e.target.value })}
            className="border-border h-10 w-full cursor-pointer rounded border"
          />
        </div>

        {/* Stroke Width */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground text-xs font-medium uppercase">
              Stroke Width
            </label>
            <span className="text-muted-foreground text-xs">
              {penToolConfig.strokeWidth}px
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={penToolConfig.strokeWidth}
            onChange={(e) => setPenToolConfig({ strokeWidth: +e.target.value })}
            className="w-full"
          />
        </div>

        {/* Line Style */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Line Style
          </label>
          <select
            value={penToolConfig.strokeDashArray ? "dashed" : "solid"}
            onChange={(e) => {
              const value = e.target.value
              if (value === "solid") {
                setPenToolConfig({ strokeDashArray: null })
              } else if (value === "dashed") {
                setPenToolConfig({ strokeDashArray: [10, 5] })
              } else if (value === "dotted") {
                setPenToolConfig({ strokeDashArray: [2, 3] })
              }
            }}
            className="bg-input border-border text-foreground w-full rounded border px-3 py-2 text-sm"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>

        {/* Line Cap */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Line Cap
          </label>
          <select
            value={penToolConfig.strokeLineCap}
            onChange={(e) =>
              setPenToolConfig({
                strokeLineCap: e.target.value as "butt" | "round" | "square",
              })
            }
            className="bg-input border-border text-foreground w-full rounded border px-3 py-2 text-sm"
          >
            <option value="butt">Butt</option>
            <option value="round">Round</option>
            <option value="square">Square</option>
          </select>
        </div>

        {/* Line Join */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Line Join
          </label>
          <select
            value={penToolConfig.strokeLineJoin}
            onChange={(e) =>
              setPenToolConfig({
                strokeLineJoin: e.target.value as "miter" | "round" | "bevel",
              })
            }
            className="bg-input border-border text-foreground w-full rounded border px-3 py-2 text-sm"
          >
            <option value="miter">Miter</option>
            <option value="round">Round</option>
            <option value="bevel">Bevel</option>
          </select>
        </div>
      </div>
    </div>
  )
}
