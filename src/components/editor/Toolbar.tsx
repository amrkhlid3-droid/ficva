"use client"

import { useRef, useState } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { Rect, Circle, IText, Triangle, Line, Path } from "fabric"
import {
  Square,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  Minus,
  ArrowRight,
  Image as ImageIcon,
  Type,
  LayoutGrid,
  MousePointer2,
  Pencil,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddObjectCommand } from "@/lib/editor/history/commands/AddObjectCommand"

export default function Toolbar() {
  const {
    canvas,
    history,
    activeSidebar,
    setActiveSidebar,
    activeTool,
    setActiveTool,
  } = useEditorStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  // --- Shape Helpers ---
  const addShape = (
    type: "rect" | "circle" | "triangle" | "line" | "arrow"
  ) => {
    if (!canvas) return
    let object

    const center = canvas.getCenterPoint()
    // Add some random offset so they don't stack perfectly
    const offset = Math.random() * 20 - 10
    const left = center.x + offset
    const top = center.y + offset

    switch (type) {
      case "rect":
        object = new Rect({
          left,
          top,
          fill: "#ff0000",
          width: 100,
          height: 100,
        })
        break
      case "circle":
        object = new Circle({ left, top, fill: "#00ff00", radius: 50 })
        break
      case "triangle":
        object = new Triangle({
          left,
          top,
          fill: "#0000ff",
          width: 100,
          height: 100,
        })
        break
      case "line":
        object = new Line([0, 0, 100, 0], {
          left,
          top,
          stroke: "#000000",
          strokeWidth: 4,
        })
        break
      case "arrow":
        // Simple arrow path
        object = new Path("M 0 0 L 100 0 M 90 -5 L 100 0 L 90 5", {
          left,
          top,
          stroke: "#000000",
          strokeWidth: 4,
          fill: "",
          strokeLineCap: "round",
          strokeLineJoin: "round",
        })
        break
    }

    if (object) {
      const command = new AddObjectCommand(canvas, object)
      history.execute(command)
    }
  }

  // --- Text Helpers ---
  const addText = (style: "heading" | "subheading" | "body") => {
    if (!canvas) return

    // Default options
    let textContent = "Text"
    let fontSize = 40
    let fontWeight: string | number = "normal"

    switch (style) {
      case "heading":
        fontSize = 64
        fontWeight = "bold"
        textContent = "Heading"
        break
      case "subheading":
        fontSize = 48
        fontWeight = 600
        textContent = "Subheading"
        break
      case "body":
        fontSize = 24
        fontWeight = "normal"
        textContent = "Body Text"
        break
    }

    const text = new IText(textContent, {
      left: 100,
      top: 200,
      fontFamily: "Inter, sans-serif",
      fill: "#333333",
      fontSize,
      fontWeight,
    })
    const command = new AddObjectCommand(canvas, text)
    history.execute(command)
  }

  // --- Upload Helper ---
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

        if (!response.ok)
          throw new Error(`Failed to get presigned URL for ${file.name}`)

        const { uploadUrl } = await response.json()

        // 2. Upload to R2 via Presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        })

        if (!uploadResponse.ok)
          throw new Error(`Upload failed for ${file.name}`)
      })

      await Promise.all(uploadPromises)

      // 3. Success: Open assets sidebar
      setActiveSidebar("assets")

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

  // --- Components ---
  const ToolButton = ({
    onClick,
    icon: Icon,
    label,
    active = false,
    disabled = false,
    className,
  }: {
    onClick?: () => void
    icon: React.ElementType
    label: string
    active?: boolean
    disabled?: boolean
    className?: string
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
            active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
        >
          <Icon className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="border-zinc-700 bg-zinc-800 text-white"
      >
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <aside className="bg-background z-10 flex h-full w-16 flex-col border-r">
      <TooltipProvider>
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Select Tool */}
          <ToolButton
            onClick={() => setActiveTool("select")}
            icon={MousePointer2}
            label="Select"
            active={activeTool === "select"}
          />

          {/* Pen Tool */}
          <ToolButton
            onClick={() =>
              setActiveTool(activeTool === "pen" ? "select" : "pen")
            }
            icon={Pencil}
            label="Pen Tool"
            active={activeTool === "pen"}
          />

          <div className="bg-border h-px w-8" />

          {/* Shapes Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <ToolButton icon={Square} label="Shapes" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem onClick={() => addShape("rect")}>
                <Square className="mr-2 h-4 w-4" /> Rectangle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addShape("circle")}>
                <CircleIcon className="mr-2 h-4 w-4" /> Circle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addShape("triangle")}>
                <TriangleIcon className="mr-2 h-4 w-4" /> Triangle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addShape("line")}>
                <Minus className="mr-2 h-4 w-4" /> Line
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addShape("arrow")}>
                <ArrowRight className="mr-2 h-4 w-4" /> Arrow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Text Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <ToolButton icon={Type} label="Text" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem onClick={() => addText("heading")}>
                <span className="text-xl font-bold">Heading</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addText("subheading")}>
                <span className="text-lg font-semibold">Subheading</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addText("body")}>
                <span className="text-sm">Body Text</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="bg-border h-px w-8" />

          {/* Assets & Upload */}
          <ToolButton
            onClick={() =>
              setActiveSidebar(activeSidebar === "assets" ? "none" : "assets")
            }
            icon={LayoutGrid}
            label="Assets"
            active={activeSidebar === "assets"}
          />
          <ToolButton
            onClick={() => fileInputRef.current?.click()}
            icon={ImageIcon}
            label={isUploading ? "Uploading..." : "Upload Image"}
            disabled={isUploading}
          />
        </div>
      </TooltipProvider>

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
