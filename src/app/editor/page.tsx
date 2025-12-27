import Toolbar from "@/components/editor/Toolbar"
import Header from "@/components/editor/Header"
import FabricCanvas from "@/components/editor/FabricCanvas"
import RightSidebar from "@/components/editor/RightSidebar"
import ContextMenu from "@/components/editor/ContextMenu"

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
          <ContextMenu />
        </main>

        {/* Right Sidebar: Properties Panel & Layers */}
        <RightSidebar />
      </div>
    </div>
  )
}
