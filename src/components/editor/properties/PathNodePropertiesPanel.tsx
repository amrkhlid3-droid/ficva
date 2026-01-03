"use client"

/**
 * PathNodePropertiesPanel - 路径节点属性面板
 *
 * 显示和编辑路径控制点（锚点）的属性：
 * - X/Y 坐标
 * - 节点类型（直线/镜像）
 * - 删除节点
 *
 * 可插拔设计：可以在 PropertiesPanel 中按需引入或移除
 */

import { useEditorStore } from "@/store/useEditorStore"
import { ModifyObjectCommand } from "@/lib/editor/history/commands/ModifyObjectCommand"
import { NumberInput } from "./NumberInput"
import type { FabricObject } from "fabric"

interface PathNodeData {
  type: "anchor"
  nodeIndex: number
  nodeMode: "straight" | "mirrored"
}

export function PathNodePropertiesPanel() {
  const canvas = useEditorStore((s) => s.canvas)
  const history = useEditorStore((s) => s.history)
  const selectedObjects = useEditorStore((s) => s.selectedObjects)
  const editingPath = useEditorStore((s) => s.editingPath)

  const selection = selectedObjects?.[0]
  const activeObject = selection || editingPath

  if (!activeObject || !canvas) return null

  // 验证是否为路径锚点
  const data = (activeObject as FabricObject & { data?: PathNodeData }).data
  if (data?.type !== "anchor") return null

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
                const originalValue = activeObject.left
                const command = new ModifyObjectCommand(
                  activeObject,
                  { left: val },
                  { left: originalValue }
                )
                history.execute(command)
                canvas.fire("object:modified", { target: activeObject })
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
                const originalValue = activeObject.top
                const command = new ModifyObjectCommand(
                  activeObject,
                  { top: val },
                  { top: originalValue }
                )
                history.execute(command)
                canvas.fire("object:modified", { target: activeObject })
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
            <button
              onClick={() => {
                canvas.fire("node:mode:change", {
                  target: activeObject,
                  mode: "straight",
                })
              }}
              className={`flex-1 rounded border px-2 py-2 text-[10px] font-medium transition-colors ${
                data.nodeMode === "straight"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted border-border text-foreground bg-transparent"
              }`}
            >
              Straight
            </button>
            <button
              onClick={() => {
                canvas.fire("node:mode:change", {
                  target: activeObject,
                  mode: "mirrored",
                })
              }}
              className={`flex-1 rounded border px-2 py-2 text-[10px] font-medium transition-colors ${
                data.nodeMode === "mirrored"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted border-border text-foreground bg-transparent"
              }`}
            >
              Mirrored
            </button>
          </div>
        </div>

        <div className="border-t pt-4">
          <button
            onClick={() => {
              canvas.fire("node:delete", { target: activeObject })
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
