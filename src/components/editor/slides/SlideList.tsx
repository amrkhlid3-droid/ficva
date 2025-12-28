"use client"

import { Plus } from "lucide-react"
import { useEditorStore } from "@/store/useEditorStore"
import { SlideThumbnail } from "./SlideThumbnail"
import { cn } from "@/lib/utils"

export default function SlideList() {
  const { pages, activePageId, setActivePage, addPage, removePage } =
    useEditorStore()

  return (
    <div className="bg-muted/40 flex h-full w-full items-center gap-4 overflow-x-auto border-t p-4">
      {/* Slide List */}
      <div className="flex h-full items-center gap-4">
        {pages.map((page, index) => (
          <div key={page.id} className="h-full">
            <SlideThumbnail
              id={page.id}
              index={index}
              thumbnail={page.thumbnail}
              isActive={page.id === activePageId}
              onClick={() => setActivePage(page.id)}
              onDelete={(e) => {
                e.stopPropagation()
                removePage(page.id)
              }}
            />
          </div>
        ))}

        {/* Add New Slide Button */}
        <button
          onClick={() => addPage()}
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
      </div>
    </div>
  )
}
