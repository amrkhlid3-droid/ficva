"use client"

import Image from "next/image"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RecentDesigns() {
  const designs = [
    {
      title: "Project Proposal",
      type: "Presentation",
      image: "/images/project-proposal.png",
      date: "Edited 2 mins ago",
    },
    {
      title: "Instagram Post",
      type: "Social Media",
      image: "/images/instagram-post.png",
      date: "Edited 1 hour ago",
    },
    {
      title: "Weekly Report",
      type: "Document",
      image: "/images/weekly-report.png",
      date: "Edited yesterday",
    },
    {
      title: "Team Brainstorm",
      type: "Whiteboard",
      image: "/images/team-brainstorm.png",
      date: "Edited 2 days ago",
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="px-1 text-2xl font-bold">Recent designs</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {designs.map((design, i) => (
          <div
            key={i}
            className="group bg-card relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={design.image}
                alt={design.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-full shadow-sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-3">
              <h3 className="truncate font-semibold">{design.title}</h3>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">{design.type}</p>
                <p className="text-muted-foreground text-xs">{design.date}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
