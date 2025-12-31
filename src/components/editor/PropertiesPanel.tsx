"use client"

import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { ModifyCanvasCommand } from "@/lib/editor/history/commands/ModifyCanvasCommand"
import { BringToFrontCommand } from "@/lib/editor/history/commands/BringToFrontCommand"
import { SendToBackCommand } from "@/lib/editor/history/commands/SendToBackCommand"
import { useRef, useState, useEffect } from "react"
import { NumberInput } from "./properties/NumberInput"
import { Color } from "fabric"

export default function PropertiesPanel() {
  const {
    selectedObjects,
    canvas,
    history,
    activeTool,
    penToolConfig,
    setPenToolConfig,

    editingPath,
  } = useEditorStore()

  // Determine the active target object for the properties panel
  // If selecting a control point in edit mode, fall back to the editing path
  const selection = selectedObjects?.[0]

  const activeObject = selection || editingPath

  // Track initial value for slider operations to avoid spamming history
  // MUST BE HERE before any conditional returns
  const sliderStartValRef = useRef<number | null>(null)

  // Local state for opacity to support "Controlled" behavior (sync with Undo)
  // without spamming the store during drag.
  const [opacity, setOpacity] = useState(1)

  // Sync local state when active object changes (e.g. Selection change or Undo/Redo)
  useEffect(() => {
    if (activeObject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpacity(activeObject.opacity ?? 1)
    }
  }, [activeObject, activeObject?.opacity])

  if (!activeObject) {
    if (!canvas) return null

    // Canvas Properties View
    if (activeTool === "pen") {
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
                onChange={(e) =>
                  setPenToolConfig({ strokeWidth: +e.target.value })
                }
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
                    strokeLineCap: e.target.value as
                      | "butt"
                      | "round"
                      | "square",
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
                    strokeLineJoin: e.target.value as
                      | "miter"
                      | "round"
                      | "bevel",
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

    return (
      <div className="bg-background text-foreground flex h-full w-full flex-col">
        <div className="space-y-6 p-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Canvas
            </div>
          </div>

          {/* Canvas Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-muted-foreground text-[10px] uppercase">
                Width
              </label>
              <NumberInput
                value={canvas.width}
                onChange={(newWidth) => {
                  const command = new ModifyCanvasCommand(
                    canvas,
                    { width: newWidth },
                    { width: canvas.width }
                  )
                  history.execute(command)
                }}
                className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase">
                Height
              </label>
              <NumberInput
                value={canvas.height}
                onChange={(newHeight) => {
                  const command = new ModifyCanvasCommand(
                    canvas,
                    { height: newHeight },
                    { height: canvas.height }
                  )
                  history.execute(command)
                }}
                className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          {/* Canvas Background */}
          <div className="space-y-2">
            <label className="text-muted-foreground block text-xs font-medium uppercase">
              Background Color
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "#ffffff",
                "#f8f9fa",
                "#18181b", // zinc-950
                "#27272a", // zinc-800
                "#ff0000",
                "#00ff00",
                "#0000ff",
                "transparent",
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    // checks if color is transparent, use null or empty string if fabric requires it,
                    // though 'transparent' string usually works or rgba(0,0,0,0)
                    const bgVal = color === "transparent" ? "" : color
                    const command = new ModifyCanvasCommand(
                      canvas,
                      { backgroundColor: bgVal },
                      { backgroundColor: canvas.backgroundColor }
                    )
                    history.execute(command)
                  }}
                  className={`border-border h-8 w-8 rounded-full border shadow-sm transition-transform hover:scale-110 ${color === "transparent" ? "bg-muted text-muted-foreground flex items-center justify-center text-[10px]" : ""}`}
                  style={{
                    backgroundColor:
                      color !== "transparent" ? color : undefined,
                  }}
                  title={color}
                >
                  {color === "transparent" && "None"}
                </button>
              ))}
              <input
                type="color"
                className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
                value={(() => {
                  if (
                    !canvas.backgroundColor ||
                    canvas.backgroundColor === "transparent"
                  )
                    return "#ffffff"
                  if (typeof canvas.backgroundColor === "string") {
                    const hex = new Color(canvas.backgroundColor).toHex()
                    return hex.startsWith("#") ? hex : `#${hex}`
                  }
                  return "#ffffff"
                })()}
                onChange={(e) => {
                  const newHex = e.target.value
                  const currentBg = canvas.backgroundColor
                  let alpha = 1
                  if (
                    currentBg &&
                    currentBg !== "transparent" &&
                    typeof currentBg === "string"
                  ) {
                    alpha = new Color(currentBg).getAlpha()
                  }
                  const newColor = new Color(newHex)
                  newColor.setAlpha(alpha)

                  const command = new ModifyCanvasCommand(
                    canvas,
                    { backgroundColor: newColor.toRgba() },
                    { backgroundColor: canvas.backgroundColor }
                  )
                  history.execute(command)
                }}
              />
            </div>

            {/* Background Opacity Slider */}
            <div className="mt-2 flex items-center gap-2">
              <label className="text-muted-foreground w-12 text-[10px] uppercase">
                Alpha
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                className="accent-primary flex-1"
                value={(() => {
                  if (
                    !canvas.backgroundColor ||
                    canvas.backgroundColor === "transparent"
                  )
                    return 0
                  if (typeof canvas.backgroundColor === "string") {
                    return new Color(canvas.backgroundColor).getAlpha()
                  }
                  return 1
                })()}
                onChange={(e) => {
                  const newAlpha = parseFloat(e.target.value)
                  const currentBg = canvas.backgroundColor

                  // If currently transparent or not set, default to white base
                  let baseColor = new Color("#ffffff")

                  if (
                    currentBg &&
                    currentBg !== "transparent" &&
                    typeof currentBg === "string"
                  ) {
                    baseColor = new Color(currentBg)
                  }

                  baseColor.setAlpha(newAlpha)

                  const command = new ModifyCanvasCommand(
                    canvas,
                    { backgroundColor: baseColor.toRgba() },
                    { backgroundColor: canvas.backgroundColor }
                  )
                  history.execute(command)
                }}
              />
              <span className="text-muted-foreground w-8 text-right text-[10px]">
                {Math.round(
                  (() => {
                    if (
                      !canvas.backgroundColor ||
                      canvas.backgroundColor === "transparent"
                    )
                      return 0
                    if (typeof canvas.backgroundColor === "string") {
                      return new Color(canvas.backgroundColor).getAlpha()
                    }
                    return 1
                  })() * 100
                )}
                %
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!activeObject) {
    return null
  }

  // Check if it's a Path Control Point (Anchor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((activeObject as any).data?.type === "anchor") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (activeObject as any).data
    return (
      <div className="bg-background text-foreground flex h-full w-full flex-col">
        <div className="space-y-6 p-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Path Node {data.nodeIndex}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-muted-foreground text-[10px] uppercase">
                X
              </label>
              <NumberInput
                value={Math.round(activeObject.left || 0)}
                onChange={(val) => {
                  if (activeObject && canvas) {
                    const originalValue = activeObject.left
                    const command = new ModifyObjectCommand(
                      activeObject,
                      { left: val },
                      { left: originalValue }
                    )
                    history.execute(command)
                    // Trigger update immediately manually if needed,
                    // but ModifyObjectCommand triggers 'object:modified' usually?
                    // No, it sets value. We might need to fire event manually or rely on FabricCanvas listener.
                    // FabricCanvas listens to 'object:modified'. ModifyObjectCommand does NOT fire it by default?
                    // Let's check ModifyObjectCommand.
                    // Usually commands just set properties.
                    // We explicitly fire it to ensure FabricCanvas syncs the path.
                    canvas.fire("object:modified", { target: activeObject })
                  }
                }}
                className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-[10px] uppercase">
                Y
              </label>
              <NumberInput
                value={Math.round(activeObject.top || 0)}
                onChange={(val) => {
                  if (activeObject && canvas) {
                    const originalValue = activeObject.top
                    const command = new ModifyObjectCommand(
                      activeObject,
                      { top: val },
                      { top: originalValue }
                    )
                    history.execute(command)
                    canvas.fire("object:modified", { target: activeObject })
                  }
                }}
                className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <label className="text-muted-foreground block text-xs font-medium uppercase">
              Node Type
            </label>
            <div className="flex gap-2">
              {/* Check current type */}
              <>
                <button
                  onClick={() => {
                    if (canvas)
                      canvas.fire("node:mode:change", {
                        target: activeObject,
                        mode: "straight",
                      })
                  }}
                  className={`flex-1 rounded border px-2 py-2 text-[10px] font-medium transition-colors ${data.nodeMode === "straight" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border text-foreground bg-transparent"}`}
                >
                  Straight
                </button>
                <button
                  onClick={() => {
                    if (canvas)
                      canvas.fire("node:mode:change", {
                        target: activeObject,
                        mode: "mirrored",
                      })
                  }}
                  className={`flex-1 rounded border px-2 py-2 text-[10px] font-medium transition-colors ${data.nodeMode === "mirrored" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border text-foreground bg-transparent"}`}
                >
                  Mirrored
                </button>
              </>
            </div>
          </div>

          <div className="border-t pt-4">
            <button
              onClick={() => {
                if (canvas) {
                  canvas.fire("node:delete", { target: activeObject })
                }
              }}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 w-full rounded border border-transparent px-3 py-2 text-xs font-medium transition-colors"
            >
              Delete Node
            </button>
          </div>
        </div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateProperty = (key: string, value: any) => {
    if (activeObject && canvas) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalValue = activeObject.get(key as any)
      const command = new ModifyObjectCommand(
        activeObject,
        { [key]: value },
        { [key]: originalValue }
      )
      history.execute(command)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePropertyLive = (key: string, value: any) => {
    if (activeObject && canvas) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeObject.set(key as any, value)
      canvas.requestRenderAll()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentFontSize = (activeObject as any).fontSize || 20

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commitProperty = (key: string, value: any, originalValue: any) => {
    if (activeObject && canvas) {
      // If the values are different, push to history
      if (value !== originalValue) {
        const command = new ModifyObjectCommand(
          activeObject,
          { [key]: value },
          { [key]: originalValue }
        )
        history.push(command)
      }
    }
  }

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
                  <div className="flex-1">
                    <NumberInput
                      className="bg-input/50 focus:border-primary focus:ring-primary border-input text-foreground w-full rounded border p-1.5 text-sm focus:ring-1 focus:outline-none"
                      // Display effective font size: fontSize * scale
                      value={Math.round(
                        currentFontSize * (activeObject.scaleY || 1)
                      )}
                      onChange={(newSize) => {
                        if (activeObject && canvas) {
                          // When changing font size explicitly, reset scale to 1 to make fontSize the source of truth
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

                          // Execute command with multiple property changes
                          const command = new ModifyObjectCommand(
                            activeObject,
                            newState,
                            originalState
                          )
                          history.execute(command)
                        }
                      }}
                      placeholder="Size"
                    />
                  </div>
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
              const startVal = sliderStartValRef.current ?? 1 // Default to 1 if not set
              commitProperty("opacity", val, startVal)
              sliderStartValRef.current = null
            }}
            className="accent-primary w-full"
          />
        </div>

        {/* Layer Management - DIRECT ACTIONS, NOT COMMANDS YET FOR Z-INDEX */}
        {/* Note: Z-index commands are complex because sendToBack changes the whole stack order.
            For now, we'll implement simple Z-index updates without deep history tracking for stack re-ordering efficiency,
            or we can implement a specific MoveLayerCommand later.
            Let's keep them as direct actions for now but with safe checks.
        */}
        {/* Layer Management */}
        <div className="space-y-2 border-t pt-4">
          <label className="text-muted-foreground block text-xs font-medium uppercase">
            Layering
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (activeObject && canvas) {
                  const command = new BringToFrontCommand(canvas, activeObject)
                  history.execute(command)
                }
              }}
              className="hover:bg-muted border-border text-foreground flex-1 rounded border bg-transparent px-3 py-2 text-xs font-medium transition-colors"
            >
              Bring to Front
            </button>
            <button
              onClick={() => {
                if (activeObject && canvas) {
                  const command = new SendToBackCommand(canvas, activeObject)
                  history.execute(command)
                }
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
