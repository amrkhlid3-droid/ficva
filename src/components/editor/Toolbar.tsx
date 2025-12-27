"use client"

import { useRef, useState } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { Rect, Circle, IText } from "fabric"
import {
  Square,
  Circle as CircleIcon,
  Image as ImageIcon,
  Type,
  LayoutGrid,
  ChevronLeft
} from "lucide-react"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"
import AssetLibrary from "@/components/editor/AssetLibrary"

export default function Toolbar() {
  const { canvas, history } = useEditorStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAssets, setShowAssets] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const addRectangle = () => {
    // ... (unchanged)
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
    // ... (unchanged)
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

  const addText = () => {
    // ... (unchanged)
    if (!canvas) return
    const text = new IText("Hello Text", {
      left: 100,
      top: 200,
      fontFamily: "Arial",
      fill: "#333333",
      fontSize: 36,
    })
    const command = new AddObjectCommand(canvas, text)
    history.execute(command)
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // 1. Get Presigned URL
        const response = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        })

        if (!response.ok) throw new Error(`Failed to get presigned URL for ${file.name}`)

        const { uploadUrl } = await response.json()

        // 2. Upload to R2 via Presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        })

        if (!uploadResponse.ok) throw new Error(`Upload failed for ${file.name}`)
      })

      await Promise.all(uploadPromises)

      // 3. Success: Refresh library and show it
      setRefreshKey((prev) => prev + 1)
      setShowAssets(true)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Failed to upload images", error)
      alert("Some images failed to upload. Please check console.")
    } finally {
      setIsUploading(false)
    }
  }

  if (showAssets) {
    return (
      <aside className="z-10 flex h-full w-72 flex-col border-r bg-white">
        <div className="flex items-center gap-2 border-b p-4">
          <button
            onClick={() => setShowAssets(false)}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h3 className="font-semibold text-gray-700">My Uploads</h3>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <AssetLibrary refreshKey={refreshKey} />
        </div>
        <div className="border-t p-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload New"}</span>
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleUploadImage}
        />
      </aside>
    )
  }

  return (
    <aside className="z-10 flex h-full w-72 flex-col border-r bg-white">
      <div className="border-b p-4">
        <h3 className="font-semibold text-gray-700">Tools</h3>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {/* ... shapes buttons ... */}
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
          onClick={addText}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-blue-400 hover:bg-gray-100"
        >
          <Type className="h-5 w-5" />
          <span>Add Text</span>
        </button>

        <div className="my-2 border-t border-gray-100"></div>

        <button
          onClick={() => setShowAssets(true)}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-blue-400 hover:bg-gray-100"
        >
          <LayoutGrid className="h-5 w-5" />
          <span>My Uploads</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:border-blue-400 hover:bg-gray-100 disabled:opacity-50"
        >
          {isUploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
          <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleUploadImage}
        />
      </div>
    </aside>
  )
}
