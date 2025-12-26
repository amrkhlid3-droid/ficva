"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  FolderOpen,
  MonitorPlay,
  Settings,
  Plus,
  Home,
  Star,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type SidebarProps = React.HTMLAttributes<HTMLDivElement>

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  const items = [
    {
      title: "Home",
      icon: Home,
      href: "/",
      isActive: pathname === "/",
    },
    {
      title: "Projects",
      icon: FolderOpen,
      href: "/projects",
      isActive: pathname === "/projects",
    },
    {
      title: "Templates",
      icon: LayoutGrid,
      href: "/templates",
      isActive: pathname === "/templates",
    },
    {
      title: "Brand",
      icon: Star,
      href: "/brand",
    },
    {
      title: "Apps",
      icon: MonitorPlay,
      href: "/apps",
    },
  ]

  return (
    <div
      className={cn(
        "bg-sidebar hidden h-screen w-64 border-r pb-12 md:block",
        className
      )}
    >
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="mb-6 flex items-center gap-2 px-4">
            <div className="flex size-8 items-center justify-center rounded bg-gradient-to-br from-blue-400 to-purple-600 text-xl font-bold text-white">
              F
            </div>
            <h2 className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent dark:from-blue-400 dark:to-purple-400">
              Ficva
            </h2>
          </div>
          <div className="mb-4 px-3">
            <Button className="bg-primary hover:bg-primary/90 w-full justify-start gap-2 text-white shadow-md">
              <Plus className="size-4" />
              Create a design
            </Button>
          </div>
          <div className="space-y-1">
            {items.map((item) => (
              <Button
                key={item.href}
                variant={item.isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 px-4 font-medium",
                  item.isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                )}
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <Separator className="mx-4 w-auto opacity-50" />
        <div className="px-3 py-2">
          <h3 className="text-muted-foreground mb-2 px-4 text-xs font-semibold tracking-wider uppercase">
            Your Content
          </h3>
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 text-sm font-normal"
            >
              <FolderOpen className="h-4 w-4" />
              All projects
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 text-sm font-normal"
            >
              <Trash2 className="h-4 w-4" />
              Trash
            </Button>
          </div>
        </div>
        <div className="mt-auto px-3 py-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-4 text-sm font-normal"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
