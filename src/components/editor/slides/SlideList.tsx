"use client"

import { Plus } from "lucide-react"
import { useEditorStore } from "@/store/useEditorStore"
import { SlideThumbnail } from "./SlideThumbnail"
import { SortableSlideItem } from "./SortableSlideItem"
import { cn } from "@/lib/utils"
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export default function SlideList() {
  const {
    pages,
    activePageId,
    setActivePage,
    addPage,
    removePage,
    duplicatePage,
    reorderPages,
  } = useEditorStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex((p) => p.id === active.id)
      const newIndex = pages.findIndex((p) => p.id === over.id)
      reorderPages(oldIndex, newIndex)
    }
  }

  return (
    <div className="bg-background flex h-32 w-full flex-col border-t">
      <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pages.map((p) => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            {pages.map((page, index) => (
              <SortableSlideItem key={page.id} id={page.id}>
                <div className="aspect-[4/3] h-full">
                  <SlideThumbnail
                    id={page.id}
                    index={index}
                    thumbnail={page.thumbnail}
                    isActive={activePageId === page.id}
                    onClick={() => setActivePage(page.id)}
                    onDelete={(e) => {
                      e.stopPropagation()
                      removePage(page.id)
                    }}
                  />
                </div>
              </SortableSlideItem>
            ))}
          </SortableContext>
        </DndContext>

        {/* Add New Slide Button */}
        {/* Add New Slide Button */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "group border-muted-foreground/25 bg-background hover:border-primary flex aspect-[4/3] h-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900"
              )}
            >
              <div className="bg-muted group-hover:bg-primary group-hover:text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-muted-foreground group-hover:text-primary mt-2 text-xs font-medium">
                Add Page
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-48 p-2">
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => addPage()}
              >
                <Plus className="h-4 w-4" />
                Blank Page
              </Button>
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => activePageId && duplicatePage(activePageId)}
                disabled={!activePageId}
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                  >
                    <path
                      d="M3.5 2C3.22386 2 3 2.22386 3 2.5V11.5C3 11.7761 3.22386 12 3.5 12H9.5C9.77614 12 10 11.7761 10 11.5V2.5C10 2.22386 9.77614 2 9.5 2H3.5ZM2 2.5C2 1.67157 2.67157 1 3.5 1H9.5C10.3284 1 11 1.67157 11 2.5V11.5C11 12.3284 10.3284 13 9.5 13H3.5C2.67157 13 2 12.3284 2 11.5V2.5ZM5.5 14H12.5C12.7761 14 13 13.7761 13 13.5V4.5C13 4.22386 12.7761 4 12.5 4H10.5V5H12V13H5.5V14Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  Duplicate Page
                </div>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
