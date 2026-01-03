"use client"

/**
 * ObjectPropertiesPanel - 对象属性面板
 *
 * 显示和编辑普通对象（非路径节点）的属性：
 * - 位置（X/Y）
 * - 尺寸（W/H）
 * - 文字属性（字体、大小、粗体、斜体）
 * - 填充颜色
 * - 描边颜色和宽度
 * - 不透明度
 * - 图层排序
 *
 * 可插拔设计：可以在 PropertiesPanel 中按需引入或移除
 */

import { useRef, useState, useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { BringToFrontCommand } from "@/lib/editor/history/commands/BringToFrontCommand"
import { SendToBackCommand } from "@/lib/editor/history/commands/SendToBackCommand"
import { NumberInput } from "./NumberInput"
import type { FabricObject } from "fabric"

export function ObjectPropertiesPanel() {
  const canvas = useEditorStore((s) => s.canvas)
  const history = useEditorStore((s) => s.history)
  const selectedObjects = useEditorStore((s) => s.selectedObjects)
  const editingPath = useEditorStore((s) => s.editingPath)

  const selection = selectedObjects?.[0]
  const activeObject = (selection || editingPath) as FabricObject | null

  // Track initial value for slider operations to avoid spamming history
  const sliderStartValRef = useRef<number | null>(null)

  // Local state for opacity to support "Controlled" behavior (sync with Undo)
  const [opacity, setOpacity] = useState(1)

  // Sync local state when active object changes
  useEffect(() => {
    if (activeObject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpacity(activeObject.opacity ?? 1)
    }
  }, [activeObject, activeObject?.opacity])

  if (!activeObject || !canvas) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateProperty = (key: string, value: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalValue = activeObject.get(key as any)
    const command = new ModifyObjectCommand(
      activeObject,
      { [key]: value },
      { [key]: originalValue }
    )
    history.execute(command)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePropertyLive = (key: string, value: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeObject.set(key as any, value)
    canvas.requestRenderAll()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commitProperty = (key: string, value: any, originalValue: any) => {
    if (value !== originalValue) {
      const command = new ModifyObjectCommand(
        activeObject,
        { [key]: value },
        { [key]: originalValue }
      )
      history.push(command)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentFontSize = (activeObject as any).fontSize || 20

  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col">
      <div className="space-y-6 p-4">
        {/* Layer Info */}
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {activeObject.type} Layer
          </div>
          <div className="text-muted-foreground text-xs">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}#
            {(activeObject as any).name || "unnamed"}
          </div>
        </div>

        {/* Geometry Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] uppercase">
              X
            </label>
            <NumberInput
              value={Math.round(activeObject.left || 0)}
              onChange={(val) => updateProperty("left", val)}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] uppercase">
              Y
            </label>
            <NumberInput
              value={Math.round(activeObject.top || 0)}
              onChange={(val) => updateProperty("top", val)}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] uppercase">
              W
            </label>
            <NumberInput
              value={Math.round(
                (activeObject.width || 0) * (activeObject.scaleX || 1)
              )}
              onChange={(newWidth) => {
                if (activeObject.width) {
                  updateProperty("scaleX", newWidth / activeObject.width)
                }
              }}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] uppercase">
              H
            </label>
            <NumberInput
              value={Math.round(
                (activeObject.height || 0) * (activeObject.scaleY || 1)
              )}
              onChange={(newHeight) => {
                if (activeObject.height) {
                  updateProperty("scaleY", newHeight / activeObject.height)
                }
              }}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
            />
          </div>
        </div>

        {/* Text Properties Section */}
        {activeObject.type === "i-text" && (
          <div className="mb-4 space-y-4 border-b pb-4">
            <label className="text-muted-foreground block text-xs font-medium uppercase">
              Typography
            </label>
            <div className="space-y-3">
              {/* Font Family */}
              <div>
                <select
                  className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  value={(activeObject as any).fontFamily || "Arial"}
                  onChange={(e) => updateProperty("fontFamily", e.target.value)}
                >
                  {[
                    "Arial",
                    "Helvetica",
                    "Times New Roman",
                    "Courier New",
                    "Verdana",
                    "Georgia",
                  ].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size & Weight */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <NumberInput
                    className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
                    value={Math.round(
                      currentFontSize * (activeObject.scaleY || 1)
                    )}
                    onChange={(newSize) => {
                      const originalState = {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        fontSize: (activeObject as any).fontSize,
                        scaleX: activeObject.scaleX,
                        scaleY: activeObject.scaleY,
                      }
                      const newState = {
                        fontSize: newSize,
                        scaleX: 1,
                        scaleY: 1,
                      }
                      const command = new ModifyObjectCommand(
                        activeObject,
                        newState,
                        originalState
                      )
                      history.execute(command)
                    }}
                    placeholder="Size"
                  />
                </div>
                <button
                  onClick={() =>
                    updateProperty(
                      "fontWeight",
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (activeObject as any).fontWeight === "bold"
                        ? "normal"
                        : "bold"
                    )
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  className={`border-input text-foreground rounded border px-3 py-1 ${(activeObject as any).fontWeight === "bold" ? "bg-muted font-bold" : "hover:bg-muted bg-transparent"}`}
                >
                  B
                </button>
                <button
                  onClick={() =>
                    updateProperty(
                      "fontStyle",
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (activeObject as any).fontStyle === "italic"
                        ? "normal"
                        : "italic"
                    )
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  className={`border-input text-foreground rounded border px-3 py-1 italic ${(activeObject as any).fontStyle === "italic" ? "bg-muted" : "hover:bg-muted bg-transparent"}`}
                >
                  I
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fill Color Section */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Fill Color
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              "#ff0000",
              "#00ff00",
              "#0000ff",
              "#ffff00",
              "#000000",
              "#ffffff",
              "transparent",
            ].map((color) => (
              <button
                key={color}
                onClick={() => updateProperty("fill", color)}
                className={`border-border h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-110 ${color === "transparent" ? "bg-muted text-muted-foreground flex items-center justify-center text-[10px]" : ""}`}
                style={{
                  backgroundColor: color !== "transparent" ? color : undefined,
                }}
                title={color}
              >
                {color === "transparent" && "None"}
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Section */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Stroke
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
              value={(activeObject.stroke as string) || "#000000"}
              onChange={(e) => updateProperty("stroke", e.target.value)}
            />
            <NumberInput
              value={activeObject.strokeWidth || 0}
              onChange={(val) => updateProperty("strokeWidth", val)}
              className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-20 rounded border px-2 py-1 text-sm focus:ring-1 focus:outline-none"
              placeholder="Width"
            />
          </div>
        </div>

        {/* Opacity Section */}
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Opacity
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={opacity}
            onMouseDown={() => {
              sliderStartValRef.current = activeObject.opacity || 1
            }}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setOpacity(val)
              updatePropertyLive("opacity", val)
            }}
            onMouseUp={(e) => {
              const val = parseFloat(e.currentTarget.value)
              const startVal = sliderStartValRef.current ?? 1
              commitProperty("opacity", val, startVal)
              sliderStartValRef.current = null
            }}
            className="accent-primary w-full"
          />
        </div>

        {/* Layer Management */}
        <div className="space-y-2 border-t pt-4">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Layering
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const command = new BringToFrontCommand(canvas, activeObject)
                history.execute(command)
              }}
              className="hover:bg-muted border-border text-foreground flex-1 rounded border bg-transparent px-3 py-2 text-xs font-medium transition-colors"
            >
              Bring to Front
            </button>
            <button
              onClick={() => {
                const command = new SendToBackCommand(canvas, activeObject)
                history.execute(command)
              }}
              className="hover:bg-muted border-border text-foreground flex-1 rounded border bg-transparent px-3 py-2 text-xs font-medium transition-colors"
            >
              Send to Back
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="border-t pt-4">
          <pre className="text-muted-foreground overflow-auto text-[10px]">
            {selectedObjects.length} object(s) selected
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(activeObject as any).isGhost ? " (Ghost Path)" : ""}
          </pre>
        </div>
      </div>
    </div>
  )
}
