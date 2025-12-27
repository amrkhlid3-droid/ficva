"use client"

import { useEffect, useState } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { FabricImage } from "fabric"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"
import { Loader2, Trash2 } from "lucide-react"
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
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { SortableAssetItem } from "@/components/editor/SortableAssetItem"

interface Asset {
  key: string
  url: string
  lastModified: string
}

export default function AssetLibrary({ refreshKey }: { refreshKey?: number }) {
  const { canvas, history } = useEditorStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [addingImage, setAddingImage] = useState<string | null>(null)
  const [deletingImage, setDeletingImage] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    fetchAssets()
  }, [refreshKey])

  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/assets")
      if (res.ok) {
        const data = await res.json()
        const fetchedAssets: Asset[] = data.files
        const savedOrder = localStorage.getItem("ficva-asset-order")
        if (savedOrder) {
          try {
            const order: string[] = JSON.parse(savedOrder)
            fetchedAssets.sort((a, b) => {
              const indexA = order.indexOf(a.key)
              const indexB = order.indexOf(b.key)
              if (indexA === -1 && indexB === -1) return 0
              if (indexA === -1) return -1
              if (indexB === -1) return 1
              return indexA - indexB
            })
          } catch (e) {
            console.error("Failed to parse saved order", e)
          }
        }
        setAssets(fetchedAssets)
      }
    } catch (error) {
      console.error("Failed to fetch assets", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setAssets((items) => {
        const oldIndex = items.findIndex((i) => i.key === active.id)
        const newIndex = items.findIndex((i) => i.key === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        localStorage.setItem(
          "ficva-asset-order",
          JSON.stringify(newItems.map((item) => item.key))
        )
        return newItems
      })
    }
  }

  const deleteAsset = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation() // Prevent adding to canvas
    if (!confirm("Are you sure you want to delete this image?")) return

    setDeletingImage(key)
    try {
      const res = await fetch("/api/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })

      if (res.ok) {
        setAssets((prev) => {
          const newItems = prev.filter((a) => a.key !== key)
          localStorage.setItem(
            "ficva-asset-order",
            JSON.stringify(newItems.map((item) => item.key))
          )
          return newItems
        })
      } else {
        alert("Failed to delete image")
      }
    } catch (error) {
      console.error("Failed to delete asset", error)
      alert("Error deleting asset")
    } finally {
      setDeletingImage(null)
    }
  }

  const addImageToCanvas = async (url: string) => {
    if (!canvas || addingImage || deletingImage) return

    setAddingImage(url)
    try {
      let img: FabricImage

      try {
        // First attempt: Load directly (uses browser cache)
        img = await FabricImage.fromURL(url, {
          crossOrigin: "anonymous",
        })
      } catch (firstError) {
        console.warn(
          "Details: Image load failed, retrying with cache bust...",
          firstError
        )
        // Second attempt: Cache bust if first fails
        const separator = url.includes("?") ? "&" : "?"
        // Use a stable cache bust key ("1") instead of a timestamp.
        // This ensures that if the fallback URL is fetched once, it can be cached by the browser
        // for subsequent accesses, unlike a timestamp which forces a new fetch every time.
        const cacheBustedUrl = `${url}${separator}retry=1`
        img = await FabricImage.fromURL(cacheBustedUrl, {
          crossOrigin: "anonymous",
        })
      }

      img.set({
        left: 100,
        top: 100,
      })

      // Scale down if too big
      if (img.width && img.width > 400) {
        img.scaleToWidth(400)
      }

      // canvas.add(img)
      // canvas.setActiveObject(img)
      // canvas.requestRenderAll()

      // Add to history
      const command = new AddObjectCommand(canvas, img)
      history.execute(command)
    } catch (finalError) {
      console.error("Failed to load image after retry:", finalError)
    } finally {
      setAddingImage(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No images found
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={assets.map((a) => a.key)}
        strategy={rectSortingStrategy}
      >
        <div className="grid w-full max-w-full grid-cols-2 gap-2 overflow-hidden p-2">
          {assets.map((asset) => (
            <SortableAssetItem key={asset.key} id={asset.key}>
              <div
                className="group relative cursor-pointer overflow-hidden rounded-md border border-gray-200 bg-white transition-colors hover:border-blue-400"
                onClick={() => addImageToCanvas(asset.url)}
              >
                <img
                  src={asset.url}
                  alt="Asset"
                  className="aspect-square h-full w-full object-cover"
                  loading="lazy"
                />

                {/* Delete Button - Visible on Hover */}
                {/* Stop propagation for drag */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => deleteAsset(e, asset.key)}
                  className="absolute top-1 right-1 hidden rounded-full bg-red-500 p-1.5 text-white shadow-sm transition-opacity group-hover:block hover:bg-red-600"
                  title="Delete"
                >
                  {deletingImage === asset.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>

                {addingImage === asset.url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
            </SortableAssetItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
