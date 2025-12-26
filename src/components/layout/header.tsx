"use client"

import { Search, Bell, HelpCircle, Monitor, LogOut, User } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Header() {
  const { data: session } = useSession()
  const user = session?.user

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="ring-background hover:ring-primary ml-2 h-9 w-9 cursor-pointer ring-2 transition-shadow">
              <AvatarImage src={user?.image || ""} alt={user?.name || "User"} />
              <AvatarFallback>
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "CN"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm leading-none font-medium">
                  {user?.name || "User"}
                </p>
                <p className="text-muted-foreground text-xs leading-none">
                  {user?.email || "user@example.com"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
