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

const ZOOM_PRESETS = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400, 500]

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomChange: (zoom: number) => void
  onZoomToFit: () => void
}

export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onZoomToFit,
}: ZoomControlsProps) {
  const displayZoom = Math.round(zoom * 100)

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
            max={500}
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
                disabled={zoom >= 5}
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
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onZoomToFit}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Fit to screen (Ctrl+0)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
