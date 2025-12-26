import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { HeroSection } from "@/components/dashboard/hero-section"
import { RecentDesigns } from "@/components/dashboard/recent-designs"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function DashboardPage() {
  return (
    <div className="bg-background flex h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <ScrollArea className="flex-1">
          <main className="mb-10 flex-1 space-y-8 p-8 md:p-12">
            <HeroSection />
            <RecentDesigns />
          </main>
        </ScrollArea>
      </div>
    </div>
  )
}
