import { cn } from "@/lib/utils"
// import Image from "next/image" // Thumbnails are base64 string, can use img tag
import { Trash2 } from "lucide-react"

interface SlideThumbnailProps {
  id: string
  index: number
  thumbnail?: string
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

export function SlideThumbnail({
  index,
  thumbnail,
  isActive,
  onClick,
  onDelete,
}: SlideThumbnailProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group hover:ring-primary/50 relative flex aspect-[4/3] h-full cursor-pointer flex-col overflow-hidden rounded-md border-2 bg-white transition-all hover:ring-2",
        isActive ? "border-primary ring-primary ring-2" : "border-transparent"
      )}
    >
      {/* Thumbnail Image */}
      <div className="relative flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={`Slide ${index + 1}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
            Empty
          </div>
        )}
      </div>

      {/* Page Number Badge */}
      <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-sm bg-black/50 text-[10px] text-white backdrop-blur-sm">
        {index + 1}
      </div>

      {/* Hover Actions */}
      <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onDelete}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm p-1"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
