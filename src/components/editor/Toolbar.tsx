"use client"

import { useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { Rect, Circle, FabricImage } from "fabric"
import { Square, Circle as CircleIcon, Image as ImageIcon } from "lucide-react"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"

export default function Toolbar() {
  const { canvas, history } = useEditorStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addRectangle = () => {
    if (!canvas) return

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: "#ff0000",
      width: 100,
      height: 100,
    })

    const command = new AddObjectCommand(canvas, rect)
    history.execute(command)
  }

  const addCircle = () => {
    if (!canvas) return

    const circle = new Circle({
      left: 250,
      top: 100,
      fill: "#00ff00",
      radius: 50,
    })

    const command = new AddObjectCommand(canvas, circle)
    history.execute(command)
  }

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !canvas) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      if (dataUrl) {
        try {
          const img = await FabricImage.fromURL(dataUrl)
          img.set({
            left: 100,
            top: 100,
            scaleX: 0.5,
            scaleY: 0.5,
          })

          const command = new AddObjectCommand(canvas, img)
          history.execute(command)

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        } catch (error) {
          console.error("Failed to load image", error)
        }
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <aside className="z-10 flex h-full w-72 flex-col border-r bg-white">
      <div className="border-b p-4">
        <h3 className="font-semibold text-gray-700">Tools</h3>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <button
          onClick={addRectangle}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-blue-400 hover:bg-gray-100"
        >
          <Square className="h-5 w-5" />
          <span>Add Rectangle</span>
        </button>

        <button
          onClick={addCircle}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-blue-400 hover:bg-gray-100"
        >
          <CircleIcon className="h-5 w-5" />
          <span>Add Circle</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-blue-400 hover:bg-gray-100"
        >
          <ImageIcon className="h-5 w-5" />
          <span>Upload Image</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleUploadImage}
        />
      </div>
    </aside>
  )
}
