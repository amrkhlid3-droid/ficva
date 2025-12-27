import Toolbar from "@/components/editor/Toolbar"
import Header from "@/components/editor/Header"
import FabricCanvas from "@/components/editor/FabricCanvas"
import PropertiesPanel from "@/components/editor/PropertiesPanel"

export default function EditorPage() {
  return (
    <div className="flex h-screen flex-col">
      {/* Header / Toolbar (Sandwich Top Layer) */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Sandwich Left Layer) */}
        <Toolbar />

        {/* Middle Layer: Canvas */}
        <main className="relative flex-1 bg-gray-50">
          <FabricCanvas />
        </main>

        {/* Right Sidebar: Properties Panel */}
        <PropertiesPanel />
      </div>
    </div>
  )
}
