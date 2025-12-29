"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, FileImage, Trash2, Pencil } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Project {
  id: string
  name: string
  thumbnailUrl: string | null
  updatedAt: string
}

export function RecentDesigns() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Failed to fetch projects", error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id))
      }
    } catch (error) {
      console.error("Failed to delete project", error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="px-1 text-2xl font-bold">Recent designs</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted h-48 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="px-1 text-2xl font-bold">Recent designs</h2>
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t created any designs yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="px-1 text-2xl font-bold">Recent designs</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => router.push(`/editor/${project.id}`)}
            className="group bg-card relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="bg-muted relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden">
              {project.thumbnailUrl ? (
                <ProjectThumbnail project={project} />
              ) : (
                <FileImage className="h-12 w-12 text-gray-300" />
              )}

              <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={() => router.push(`/editor/${project.id}`)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/50"
                      onClick={() => deleteProject(project.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="p-3">
              <h3 className="truncate font-semibold">{project.name}</h3>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">Design</p>
                <p className="text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(project.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectThumbnail({ project }: { project: Project }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      <div
        className={`absolute inset-0 bg-zinc-200 dark:bg-zinc-800 ${loaded ? "hidden" : "block animate-pulse"}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={project.thumbnailUrl!}
        alt={project.name}
        className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </>
  )
}
