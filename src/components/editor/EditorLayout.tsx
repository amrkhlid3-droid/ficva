/**
 * EditorLayout - 编辑器布局组件
 *
 * 职责：
 * - 纯展示组件，负责渲染编辑器的整体布局
 * - 显示加载遮罩
 * - 组织各个子组件的位置
 *
 * 设计原则：
 * - 无副作用：不处理业务逻辑，只负责渲染
 * - 接收 props：通过 props 控制显示状态
 * - 可测试：输入确定则输出确定
 *
 * 布局结构：
 * ┌─────────────────────────────────────────────┐
 * │                   Header                    │
 * ├────┬──────────┬────────────────────┬────────┤
 * │    │          │                    │        │
 * │ T  │   Left   │      Canvas        │ Right  │
 * │ o  │  Sidebar │                    │Sidebar │
 * │ o  │          │                    │        │
 * │ l  │          ├────────────────────┤        │
 * │ b  │          │    SlideList       │        │
 * │ a  │          │                    │        │
 * │ r  │          │                    │        │
 * └────┴──────────┴────────────────────┴────────┘
 */

import Toolbar from "@/components/editor/Toolbar"
import Header from "@/components/editor/Header"
import FabricCanvas from "@/components/editor/FabricCanvas"
import RightSidebar from "@/components/editor/RightSidebar"
import LeftSidebar from "@/components/editor/LeftSidebar"
import ContextMenu from "@/components/editor/ContextMenu"
import SlideList from "@/components/editor/slides/SlideList"
import { useEditorStore } from "@/store/useEditorStore"

export interface EditorLayoutProps {
  /** 是否正在加载项目数据 */
  isLoading: boolean
  /** 画布是否已就绪 */
  isCanvasReady: boolean
}

/**
 * 加载遮罩组件
 */
function LoadingOverlay() {
  return (
    <div className="bg-background absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center">
      <div className="relative h-16 w-16">
        {/* 双层动画效果：外层 ping + 内层 pulse */}
        <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20"></div>
        <div className="absolute inset-2 animate-pulse rounded-full bg-blue-600"></div>
      </div>
      <p className="text-muted-foreground mt-4 animate-pulse font-medium">
        Loading Editor...
      </p>
    </div>
  )
}

/**
 * 编辑器布局组件
 *
 * @param props - 布局属性
 * @returns 编辑器布局 JSX
 */
export function EditorLayout({ isLoading, isCanvasReady }: EditorLayoutProps) {
  // 从 Store 获取侧边栏状态
  // 为什么在这里读取而不是通过 props 传递？
  // - activeSidebar 是 UI 状态，与布局紧密相关
  // - 避免在 page.tsx 中添加不必要的依赖
  const activeSidebar = useEditorStore((state) => state.activeSidebar)

  // 是否显示加载遮罩：项目数据未加载完成 或 画布未就绪
  const showLoadingOverlay = isLoading || !isCanvasReady

  return (
    <div className="bg-background text-foreground relative flex h-screen flex-col">
      {/* 加载遮罩层 */}
      {showLoadingOverlay && <LoadingOverlay />}

      {/* 顶部导航栏：包含项目名称、保存状态、导出按钮等 */}
      <Header />

      {/* 主工作区：使用 Flexbox 实现三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/*
          左侧工具栏：固定宽度的工具条
          包含选择、手形、绘图、钢笔等工具
        */}
        <Toolbar />

        {/*
          左侧边栏：可折叠，固定宽度 75 (约300px)
          条件渲染：只有当 activeSidebar 不是 "none" 时显示
          包含素材库、图层面板等
        */}
        {activeSidebar !== "none" && (
          <div className="bg-background flex w-75 flex-col border-r">
            <LeftSidebar />
          </div>
        )}

        {/*
          中央画布区域：flex-1 自动填充剩余空间
          min-w-0 防止 flex 子元素溢出
        */}
        <main className="bg-muted/30 relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/*
            画布容器
            invisible 类在画布未就绪时隐藏内容但保持布局空间
            为什么不用 hidden？保持布局稳定，避免加载完成时的布局跳动
          */}
          <div
            className={`relative flex-1 ${!isCanvasReady ? "invisible" : ""}`}
          >
            <FabricCanvas />
            <ContextMenu />
          </div>
          {/*
            底部幻灯片列表：固定高度 128px (h-32)
            shrink-0 防止被压缩
          */}
          <div className="bg-background h-32 shrink-0 border-t">
            <SlideList />
          </div>
        </main>

        {/*
          右侧边栏：固定宽度 75 (约300px)
          包含属性面板、样式设置等
        */}
        <div className="bg-background flex w-75 flex-col border-l">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
