"use client"

import { useState } from "react"
import { Layers, Settings2 } from "lucide-react"
import PropertiesPanel from "./PropertiesPanel"
import LayersPanel from "./LayersPanel"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function RightSidebar() {
  const [activeTab, setActiveTab] = useState("properties")

  return (
    <aside className="bg-background z-10 flex h-full w-full flex-col border-l">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col"
      >
        <div className="border-b px-2 py-2">
          <TabsList className="bg-muted grid w-full grid-cols-2">
            <TabsTrigger
              value="properties"
              className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Properties
            </TabsTrigger>
            <TabsTrigger
              value="layers"
              className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              Layers
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="bg-background relative flex-1 overflow-auto">
          <TabsContent
            value="properties"
            className="absolute inset-0 m-0 h-full w-full flex-col overflow-auto border-none outline-none data-[state=active]:flex"
          >
            <PropertiesPanel />
          </TabsContent>
          <TabsContent
            value="layers"
            className="absolute inset-0 m-0 h-full w-full flex-col overflow-auto border-none outline-none data-[state=active]:flex"
          >
            <LayersPanel />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}
