"use client"

import { Search, Bell, HelpCircle, Monitor } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Header() {
  return (
    <header className="bg-background flex h-16 items-center gap-4 border-b px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-xl">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            type="search"
            placeholder="Search your content, Canva's templates, and more"
            className="bg-secondary focus-visible:bg-background focus-visible:ring-primary focus-visible:border-primary w-full rounded-md border-transparent pl-9 transition-all md:w-[300px] lg:w-[400px] xl:w-[500px]"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Monitor className="h-5 w-5" />
          <span className="sr-only">Download App</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button className="ml-2 bg-gradient-to-r from-blue-600 to-purple-600 font-semibold text-white transition-opacity hover:opacity-90">
          Create a design
        </Button>
        <Avatar className="ring-background hover:ring-primary ml-2 h-9 w-9 cursor-pointer ring-2 transition-shadow">
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
