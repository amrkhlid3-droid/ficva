"use client"

import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { useRef, useState, useEffect } from "react"

export default function PropertiesPanel() {
  const { selectedObjects, canvas, history } = useEditorStore()

  // Track initial value for slider operations to avoid spamming history
  // MUST BE HERE before any conditional returns
  const sliderStartValRef = useRef<number | null>(null)

  // Local state for opacity to support "Controlled" behavior (sync with Undo)
  // without spamming the store during drag.
  const [opacity, setOpacity] = useState(1)

  // Sync local state when active object changes (e.g. Selection change or Undo/Redo)
  const activeObjectRef = selectedObjects?.[0]
  useEffect(() => {
    if (activeObjectRef) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpacity(activeObjectRef.opacity ?? 1)
    }
  }, [activeObjectRef, activeObjectRef?.opacity])

  if (!selectedObjects || selectedObjects.length === 0) {
    return (
      <aside className="z-10 flex h-full w-72 flex-col border-l bg-gray-50/50 bg-white">
        <div className="border-b bg-white p-4">
          <h3 className="font-semibold text-gray-700">Properties</h3>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          Select an object to edit
        </div>
      </aside>
    )
  }

  // Handle single object selection for MVP
  const activeObject = selectedObjects[0]

  if (!activeObject) {
    return null
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
    <aside className="z-10 flex h-full w-72 flex-col border-l bg-white">
      <div className="border-b p-4">
        <h3 className="font-semibold text-gray-700">Properties</h3>
      </div>

      <div className="space-y-6 p-4">
        {/* Layer Info */}
        <div className="text-xs font-medium tracking-wider text-gray-500 uppercase">
          {activeObject.type} Layer
        </div>

        {/* Text Properties Section */}
        {activeObject.type === "i-text" && (
          <div className="mb-4 space-y-4 border-b border-gray-100 pb-4">
            <label className="block text-sm font-medium text-gray-700">
              Typography
            </label>
            <div className="space-y-3">
              {/* Font Family */}
              <div>
                <select
                  className="w-full rounded border border-gray-300 bg-white p-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
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
                  <input
                    type="number"
                    className="w-full rounded border border-gray-300 bg-white p-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    // Display effective font size: fontSize * scale
                    value={Math.round(
                      currentFontSize * (activeObject.scaleY || 1)
                    )}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value)
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
                  className={`rounded border border-gray-300 px-3 py-1 text-gray-900 ${(activeObject as any).fontWeight === "bold" ? "bg-gray-200 font-bold" : "bg-white"}`}
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
                  className={`rounded border border-gray-300 px-3 py-1 text-gray-900 italic ${(activeObject as any).fontStyle === "italic" ? "bg-gray-200" : "bg-white"}`}
                >
                  I
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fill Color Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
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
                className={`h-8 w-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-110 ${color === "transparent" ? "flex items-center justify-center bg-gray-100 text-[10px] text-gray-400" : ""}`}
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
          <label className="block text-sm font-medium text-gray-700">
            Stroke
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
              value={(activeObject.stroke as string) || "#000000"}
              onChange={(e) => updateProperty("stroke", e.target.value)}
            />
            <input
              type="number"
              min="0"
              max="20"
              value={activeObject.strokeWidth || 0}
              onChange={(e) =>
                updateProperty("strokeWidth", parseInt(e.target.value))
              }
              className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="Width"
            />
          </div>
        </div>

        {/* Opacity Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
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
            className="w-full accent-blue-600"
          />
        </div>

        {/* Layer Management - DIRECT ACTIONS, NOT COMMANDS YET FOR Z-INDEX */}
        {/* Note: Z-index commands are complex because sendToBack changes the whole stack order.
            For now, we'll implement simple Z-index updates without deep history tracking for stack re-ordering efficiency,
            or we can implement a specific MoveLayerCommand later.
            Let's keep them as direct actions for now but with safe checks.
        */}
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700">
            Layering
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (activeObject && canvas) {
                  canvas.bringObjectToFront(activeObject)
                  canvas.requestRenderAll()
                  // TODO: Implement BringToFrontCommand
                }
              }}
              className="flex-1 rounded bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Bring to Front
            </button>
            <button
              onClick={() => {
                if (activeObject && canvas) {
                  canvas.sendObjectToBack(activeObject)
                  canvas.requestRenderAll()
                  // TODO: Implement SendToBackCommand
                }
              }}
              className="flex-1 rounded bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Send to Back
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="border-t border-gray-100 pt-4">
          <pre className="overflow-auto text-[10px] text-gray-400">
            {selectedObjects.length} object(s) selected
          </pre>
        </div>
      </div>
    </aside>
  )
}
