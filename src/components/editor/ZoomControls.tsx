"use client"

import { Minus, Plus, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const ZOOM_PRESETS = [
  10, 25, 50, 75, 100, 125, 150, 200, 300, 400, 500, 800, 1000,
]

interface ZoomControlsProps {
  zoom: number
  /** 当前缩放模式 */
  zoomMode?: "fit" | "100%" | "focus" | "custom"
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomChange: (zoom: number) => void
  onZoomToFit: () => void
}

export default function ZoomControls({
  zoom,
  zoomMode = "custom",
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onZoomToFit,
}: ZoomControlsProps) {
  const displayZoom = Math.round(zoom * 100)
  const isFitMode = zoomMode === "fit"

  const handleSliderChange = (value: number[]) => {
    const newZoom = (value[0] ?? 100) / 100
    onZoomChange(newZoom)
  }

  const handlePresetClick = (preset: number) => {
    onZoomChange(preset / 100)
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="bg-background/95 flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm">
        <TooltipProvider delayDuration={300}>
          {/* Zoom Out */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onZoomOut}
                disabled={zoom <= 0.1}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Zoom out (Ctrl+-)</p>
            </TooltipContent>
          </Tooltip>

          {/* Slider */}
          <Slider
            value={[displayZoom]}
            min={10}
            max={1000}
            step={5}
            className="w-32"
            onValueChange={handleSliderChange}
          />

          {/* Zoom In */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onZoomIn}
                disabled={zoom >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Zoom in (Ctrl++)</p>
            </TooltipContent>
          </Tooltip>

          {/* Zoom Percentage with Dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="min-w-14 px-2">
                {displayZoom}%
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-24 p-1" align="center" side="top">
              <div className="flex flex-col">
                {ZOOM_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    variant={displayZoom === preset ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 justify-start px-2"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset}%
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Fit to Screen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isFitMode ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-7 w-7",
                  isFitMode && "bg-primary text-primary-foreground"
                )}
                onClick={onZoomToFit}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Fit to screen (Shift+1)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
