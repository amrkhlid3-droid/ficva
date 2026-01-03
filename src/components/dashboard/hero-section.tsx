"use client"

import {
  FileText,
  Presentation,
  Image as ImageIcon,
  Video,
  Grid,
  PenTool,
} from "lucide-react"

export function HeroSection() {
  const quickActions = [
    {
      label: "Doc",
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      label: "Whiteboard",
      icon: PenTool,
      color: "text-orange-500",
      bg: "bg-orange-100 dark:bg-orange-900/20",
    },
    {
      label: "Presentation",
      icon: Presentation,
      color: "text-yellow-500",
      bg: "bg-yellow-100 dark:bg-yellow-900/20",
    },
    {
      label: "Social Media",
      icon: ImageIcon,
      color: "text-pink-500",
      bg: "bg-pink-100 dark:bg-pink-900/20",
    },
    {
      label: "Video",
      icon: Video,
      color: "text-purple-500",
      bg: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      label: "Websites",
      icon: Grid,
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-900/20",
    },
  ]

  return (
    <div className="w-full space-y-8 py-8 text-center">
      <h1 className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl dark:from-blue-400 dark:to-purple-400">
        What will you design today?
      </h1>

      <div className="flex flex-wrap justify-center gap-4 px-4">
        {quickActions.map((action) => (
          <div
            key={action.label}
            className="group flex cursor-pointer flex-col items-center gap-2"
          >
            <div
              className={`rounded-2xl p-4 ${action.bg} transition-transform group-hover:scale-105 group-hover:shadow-lg`}
            >
              <action.icon className={`h-8 w-8 ${action.color}`} />
            </div>
            <span className="text-muted-foreground group-hover:text-foreground text-sm font-medium transition-colors">
              {action.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
