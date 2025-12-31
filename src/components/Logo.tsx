"use client"

import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  showTitle?: boolean
  size?: "sm" | "md" | "lg"
}

export function Logo({ className, showTitle = true, size = "md" }: LogoProps) {
  const sizes = {
    sm: { width: 24, height: 24, textSize: "text-lg" },
    md: { width: 32, height: 32, textSize: "text-xl" },
    lg: { width: 48, height: 48, textSize: "text-2xl" },
  }

  const { width, height, textSize } = sizes[size]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ width, height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="Ficva Logo"
          className="h-full w-full object-contain"
          width={width}
          height={height}
        />
      </div>
      {showTitle && (
        <span
          className={cn(
            "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text font-bold text-transparent dark:from-blue-400 dark:to-purple-400",
            textSize
          )}
        >
          Ficva
        </span>
      )}
    </div>
  )
}
