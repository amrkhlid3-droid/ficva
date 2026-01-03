"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, ImageIcon, FileJson, FileCode } from "lucide-react"
import { useEditorStore } from "@/store/useEditorStore"
import {
  exportWorkspace,
  type ExportFormat,
} from "@/lib/editor/export/exportWorkspace"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FORMAT_OPTIONS: {
  value: ExportFormat
  label: string
  icon: React.ReactNode
  description: string
}[] = [
  {
    value: "png",
    label: "PNG",
    icon: <ImageIcon className="h-4 w-4" />,
    description: "Best for web, supports transparency",
  },
  {
    value: "jpeg",
    label: "JPG",
    icon: <ImageIcon className="h-4 w-4" />,
    description: "Smaller file size, no transparency",
  },
  {
    value: "svg",
    label: "SVG",
    icon: <FileCode className="h-4 w-4" />,
    description: "Vector format, scalable",
  },
  {
    value: "json",
    label: "JSON",
    icon: <FileJson className="h-4 w-4" />,
    description: "Fabric.js project data",
  },
]

const RESOLUTION_OPTIONS = [
  { value: "1", label: "1x (Standard)" },
  { value: "2", label: "2x (Retina)" },
  { value: "3", label: "3x (High DPI)" },
  { value: "4", label: "4x (Ultra HD)" },
]

/**
 * 高级导出对话框
 *
 * 提供多格式导出选项：
 * - PNG: 支持透明背景
 * - JPEG: 压缩图片
 * - SVG: 矢量格式
 * - JSON: 项目数据
 *
 * 模块化设计：可选模块，不启用时 Header 直接调用 exportWorkspace
 */
export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const canvas = useEditorStore((s) => s.canvas)
  const projectName = useEditorStore((s) => s.projectName)

  const [format, setFormat] = useState<ExportFormat>("png")
  const [transparent, setTransparent] = useState(false)
  const [multiplier, setMultiplier] = useState("2")
  const [filename, setFilename] = useState(
    projectName?.replace(/\s+/g, "-").toLowerCase() || "design-export"
  )
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = () => {
    if (!canvas) return

    setIsExporting(true)

    // 使用 setTimeout 让 UI 更新显示 loading 状态
    setTimeout(() => {
      try {
        exportWorkspace(canvas, {
          format,
          transparent: format === "png" ? transparent : false,
          multiplier: parseFloat(multiplier),
          quality: 1,
          filename,
        })
      } finally {
        setIsExporting(false)
        onOpenChange(false)
      }
    }, 50)
  }

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === format)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Design
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Format</Label>
            <div className="grid grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={format === option.value ? "default" : "outline"}
                  className="flex h-auto flex-col items-center gap-1 py-3"
                  onClick={() => setFormat(option.value)}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </Button>
              ))}
            </div>
            {selectedFormat && (
              <p className="text-muted-foreground text-xs">
                {selectedFormat.description}
              </p>
            )}
          </div>

          {/* PNG Transparent Option */}
          {format === "png" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="transparent"
                checked={transparent}
                onCheckedChange={(checked) => setTransparent(checked === true)}
              />
              <Label htmlFor="transparent" className="cursor-pointer text-sm">
                Transparent background
              </Label>
            </div>
          )}

          {/* Resolution (for image formats) */}
          {(format === "png" || format === "jpeg") && (
            <div className="space-y-2">
              <Label>Resolution</Label>
              <Select value={multiplier} onValueChange={setMultiplier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filename */}
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <div className="flex items-center gap-2">
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="design-export"
              />
              <span className="text-muted-foreground text-sm">
                .{format === "jpeg" ? "jpg" : format}
              </span>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleExport}
          disabled={!canvas || isExporting}
        >
          {isExporting ? (
            <>Exporting...</>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
