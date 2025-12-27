import { useEditorStore } from "@/store/useEditorStore"
import { Box } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { SortableLayerItem } from "./SortableLayerItem"
import { ReorderCommand } from "@/lib/editor/history/commands/ReorderCommand"

export default function LayersPanel() {
  const { layers, canvas, selectedObjects, syncLayers, history } = useEditorStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const toggleVisibility = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const obj = layers[index]
    if (!obj) return

    // Direct modification for now - TODO: Command
    obj.visible = !obj.visible

    if (!obj.visible) {
      canvas?.discardActiveObject()
    }

    canvas?.requestRenderAll()
    syncLayers()
  }

  const toggleLock = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    const obj = layers[index]
    if (!obj) return

    const isLocked = !obj.selectable

    obj.set({
        lockMovementX: !isLocked,
        lockMovementY: !isLocked,
        lockRotation: !isLocked,
        lockScalingX: !isLocked,
        lockScalingY: !isLocked,
        selectable: !isLocked,
        evented: !isLocked
    })

    if (!obj.selectable) {
        canvas?.discardActiveObject()
    }

    canvas?.requestRenderAll()
    syncLayers()
  }

  const selectLayer = (index: number) => {
    const obj = layers[index]
    if (!obj || !obj.selectable) return

    canvas?.setActiveObject(obj)
    canvas?.requestRenderAll()
  }

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (active.id !== over?.id && canvas) {
          // Find visual indices
          const oldIndex = layers.findIndex(l => (l as any).id === active.id)
          const newIndex = layers.findIndex(l => (l as any).id === over?.id)

          if (oldIndex === -1 || newIndex === -1) return

          // Convert to Fabric Indices (0 = bottom, layers is reversed)
          const count = layers.length
          const oldFabricIndex = count - 1 - oldIndex
          const newFabricIndex = count - 1 - newIndex

          const obj = layers[oldIndex]
          if (!obj) return

          // Optimistic update? No, let syncLayers handle it via command execution?
          // Command execution fires 'modified' which calls syncLayers.
          // But reordering is instant.

          const command = new ReorderCommand(canvas, obj, oldFabricIndex, newFabricIndex)
          history.execute(command)
          // syncLayers() is called by the event in command
      }
  }

  if (layers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-gray-400">
        <Box className="mb-2 h-12 w-12 opacity-20" />
        <p className="text-sm">No layers yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={layers.map(l => (l as any).id)}
          strategy={verticalListSortingStrategy}
        >
          {layers.map((obj, i) => {
              const id = (obj as any).id
              if (!id) return null // Should not happen given store sync

              const isSelected = selectedObjects.includes(obj)

              return (
                  <SortableLayerItem
                    key={id}
                    id={id}
                    obj={obj}
                    isSelected={isSelected}
                    onSelect={() => selectLayer(i)}
                    onToggleVisibility={(e) => toggleVisibility(e, i)}
                    onToggleLock={(e) => toggleLock(e, i)}
                  />
              )
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
