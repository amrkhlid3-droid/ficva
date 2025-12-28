import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type as TypeIcon,
  Square,
  Circle,
} from "lucide-react"
import { FabricObject } from "fabric"

interface SortableLayerItemProps {
  id: string
  obj: FabricObject
  isSelected: boolean
  onSelect: () => void
  onToggleVisibility: (e: React.MouseEvent) => void
  onToggleLock: (e: React.MouseEvent) => void
}

export function SortableLayerItem({
  id,
  obj,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
}: SortableLayerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
    opacity: isDragging ? 0.5 : 1,
  }

  // Determine Icon based on type
  const getIcon = () => {
    switch (obj.type) {
      case "i-text":
        return <TypeIcon className="h-4 w-4" />
      case "rect":
        return <Square className="h-4 w-4" />
      case "circle":
        return <Circle className="h-4 w-4" />
      default:
        return <Square className="h-4 w-4" /> // Fallback
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const label = (obj as any).name || obj.type || "Object"
  const isLocked = !obj.selectable
  const isVisible = obj.visible

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between rounded-md border p-2 text-sm transition-colors ${
        isSelected
          ? "border-blue-600 bg-blue-900/30 text-blue-100"
          : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-zinc-500 hover:text-zinc-300"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Type Icon */}
        <div className="text-zinc-500">{getIcon()}</div>

        {/* Label */}
        <span className="truncate font-medium">{label}</span>
      </div>

      <div
        className="flex items-center gap-1 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 data-[selected=true]:opacity-100"
        data-selected={isSelected}
      >
        <button
          onClick={onToggleLock}
          className={`rounded p-1 ${isLocked ? "text-red-500" : "hover:bg-zinc-700 hover:text-white"}`}
          title={isLocked ? "Unlock" : "Lock"}
        >
          {isLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={onToggleVisibility}
          className={`rounded p-1 ${!isVisible ? "text-zinc-600" : "hover:bg-zinc-700 hover:text-white"}`}
          title={isVisible ? "Hide" : "Show"}
        >
          {isVisible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}
