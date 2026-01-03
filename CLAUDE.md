# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
本文件为 Claude Code 提供在此代码库中工作的指导。

## Project Overview | 项目概述

**FICVA** is a web-based vector graphics design editor, similar to Figma or Adobe XD. Users can create, edit, and manage vector designs with support for multi-page projects, path editing, asset management, and real-time auto-save.

**FICVA** 是一个基于 Web 的矢量图形设计编辑器，类似于 Figma 或 Adobe XD。用户可以创建、编辑和管理矢量设计，支持多页面项目、路径编辑、素材管理和实时自动保存。

### Core Features | 核心功能

| Feature 功能        | Description 描述                                                    |
| ------------------- | ------------------------------------------------------------------- |
| Vector Drawing      | Path editing with nodes, anchors, and bezier curves using Fabric.js |
| 矢量绘图            | 使用 Fabric.js 进行节点、锚点和贝塞尔曲线的路径编辑                 |
| Multi-page Projects | Support for multiple slides/pages per project                       |
| 多页面项目          | 支持每个项目包含多个幻灯片/页面                                     |
| Layer Management    | Drag-and-drop hierarchical layer organization                       |
| 图层管理            | 拖拽式分层图层组织                                                  |
| Zoom & Pan          | Professional canvas navigation with native Fabric.js zoom API       |
| 缩放与平移          | 使用原生 Fabric.js 缩放 API 进行专业画布导航                        |
| Asset Management    | Upload and manage design assets (S3 storage)                        |
| 素材管理            | 上传和管理设计素材（S3 存储）                                       |
| Undo/Redo           | Command pattern history system                                      |
| 撤销/重做           | 命令模式历史系统                                                    |
| Auto-save           | Debounced save to server with localStorage conflict resolution      |
| 自动保存            | 防抖保存到服务器，带 localStorage 冲突解决                          |

## Development Commands | 开发命令

```bash
# Development | 开发
bun dev                    # Start development server (primary) | 启动开发服务器（主要）
bun dev:turbo             # Start with Turbopack for faster builds | 使用 Turbopack 加速构建

# Code Quality | 代码质量
bun run lint              # Run ESLint with max warnings = 0 | 运行 ESLint，最大警告数为 0
bun run lint:fix          # Auto-fix ESLint issues | 自动修复 ESLint 问题
bun run format            # Format code with Prettier | 使用 Prettier 格式化代码
bun run format:check      # Check formatting without changes | 检查格式但不修改
bun run typecheck         # Run TypeScript type checking | 运行 TypeScript 类型检查
bun run quality           # Run all checks: lint + format:check + typecheck | 运行所有检查
bun run quality:fix       # Fix issues and run checks | 修复问题并运行检查

# Production | 生产环境
bun run build             # Create production build | 创建生产构建
bun run build:turbo       # Production build with Turbopack | 使用 Turbopack 生产构建
bun start                 # Start production server | 启动生产服务器
```

## Architecture Overview | 架构概述

This is a Next.js application using the App Router pattern with TypeScript, Tailwind CSS, and shadcn/ui components.

这是一个使用 App Router 模式的 Next.js 应用程序，采用 TypeScript、Tailwind CSS 和 shadcn/ui 组件。

### Technology Stack | 技术栈

| Layer 层级    | Technology 技术            |
| ------------- | -------------------------- |
| Framework     | Next.js 16 with App Router |
| 框架          | Next.js 16 App Router 模式 |
| Language      | TypeScript (strict mode)   |
| 语言          | TypeScript（严格模式）     |
| Canvas        | Fabric.js 7 (vector)       |
| 画布          | Fabric.js 7（矢量图形）    |
| State         | Zustand                    |
| 状态管理      | Zustand                    |
| Styling       | Tailwind CSS 4 + CSS vars  |
| 样式          | Tailwind CSS 4 + CSS 变量  |
| UI Components | shadcn/ui (45+ components) |
| UI 组件       | shadcn/ui（45+ 组件）      |
| Database      | Drizzle ORM + PostgreSQL   |
| 数据库        | Drizzle ORM + PostgreSQL   |
| Auth          | NextAuth.js 5 (beta)       |
| 认证          | NextAuth.js 5（测试版）    |
| Forms         | React Hook Form + Zod      |
| 表单          | React Hook Form + Zod      |
| File Storage  | AWS S3                     |
| 文件存储      | AWS S3                     |

### Directory Structure | 目录结构

```
src/
├── app/                       # Next.js App Router pages | 页面路由
│   ├── (auth)/               # Auth routes (login, register) | 认证路由
│   ├── (dashboard)/          # Protected dashboard routes | 受保护的仪表盘路由
│   ├── editor/[id]/          # Main editor workspace | 主编辑器工作区
│   └── api/                  # Backend API routes | 后端 API 路由
│       └── projects/         # Project CRUD endpoints | 项目 CRUD 端点
│
├── components/
│   ├── ui/                   # shadcn/ui components (45+) | shadcn/ui 组件
│   ├── editor/               # Editor-specific components | 编辑器专用组件
│   │   ├── FabricCanvas.tsx  # Core canvas with Fabric.js | 核心画布
│   │   ├── Toolbar.tsx       # Tool selection | 工具选择栏
│   │   ├── LeftSidebar.tsx   # Asset library | 素材库
│   │   ├── RightSidebar.tsx  # Properties panel | 属性面板
│   │   ├── LayersPanel.tsx   # Layer hierarchy | 图层层级
│   │   ├── ZoomControls.tsx  # Zoom/pan controls | 缩放/平移控件
│   │   └── slides/           # Multi-page management | 多页面管理
│   ├── layout/               # Header, sidebar | 页头、侧边栏
│   ├── auth/                 # Login/register forms | 登录/注册表单
│   └── dashboard/            # Home page components | 首页组件
│
├── store/
│   └── useEditorStore.ts     # Central Zustand state | 中央 Zustand 状态
│
├── lib/
│   ├── editor/               # Canvas utilities | 画布工具
│   │   ├── history/          # Undo/redo command system | 撤销/重做命令系统
│   │   ├── pathUtils.ts      # SVG path manipulation | SVG 路径操作
│   │   └── pathConverter.ts  # Path to nodes conversion | 路径到节点转换
│   ├── providers/            # Context providers | 上下文提供者
│   └── utils.ts              # Common utilities (cn helper) | 通用工具
│
├── hooks/
│   ├── useAutoSave.ts        # Auto-save with debounce | 防抖自动保存
│   ├── useCanvasZoom.ts      # Zoom functionality | 缩放功能
│   ├── useCanvasPan.ts       # Pan functionality | 平移功能
│   └── canvas/               # Modular canvas hooks | 模块化画布钩子
│
├── db/
│   ├── schema.ts             # Drizzle ORM schema | Drizzle ORM 模式
│   └── index.ts              # Database client | 数据库客户端
│
├── types/
│   └── fabric.ts             # Custom Fabric.js types | 自定义 Fabric.js 类型
│
└── utils/
    └── storage.ts            # localStorage utilities | 本地存储工具
```

## Key User Flows | 核心用户流程

### Flow 1: Create a Design | 流程 1：创建设计

When user clicks "Create a Design" button in dashboard:
当用户在仪表盘点击"创建设计"按钮时：

```
1. Button Click (header.tsx:28-46 or sidebar.tsx:34-52)
   按钮点击
   └─> POST /api/projects { name: "Untitled Design" }

2. API Handler (api/projects/route.ts:24-47)
   API 处理器
   ├─> Verify authentication (NextAuth session) | 验证认证
   ├─> Insert into database (Drizzle ORM) | 插入数据库
   │   └─> Default values: width=800, height=600, json={} | 默认值
   └─> Return { id, name, json, ... } | 返回数据

3. Redirect | 重定向
   └─> router.push(`/editor/${project.id}`)

4. Editor Initialization (see Flow 2 below)
   编辑器初始化（见下方流程 2）
```

**Key Files | 关键文件：**

- Button 按钮: `src/components/layout/header.tsx:28-46`
- API: `src/app/api/projects/route.ts:24-47`
- Schema 模式: `src/db/schema.ts:68-82`

### Flow 2: Editor & Canvas Initialization | 流程 2：编辑器与画布初始化

When editor page loads (`/editor/[id]`):
当编辑器页面加载时：

```
EditorPage Mount | 编辑器页面挂载
      │
      ├─> Effect 1: Fetch project data | 获取项目数据
      │   └─> GET /api/projects/${id}
      │   └─> setProjectData(data)
      │
      ├─> FabricCanvas Component Mount | FabricCanvas 组件挂载
      │   └─> Effect: Create Fabric.js Canvas | 创建 Fabric.js 画布
      │       ├─> new Canvas(canvasEl, { width, height, ... })
      │       ├─> Add white background Rect (logical canvas) | 添加白色背景
      │       ├─> setCanvas(canvas) -> Register to Store | 注册到 Store
      │       ├─> Bind event listeners | 绑定事件监听器
      │       └─> Setup keyboard shortcuts | 设置键盘快捷键
      │
      └─> Effect 2: Load JSON into Canvas | 加载 JSON 到画布
          └─> When both canvas + projectData ready | 当画布和数据都准备好时：
              ├─> Scenario A: Remount -> Restore from Store | 场景 A：重新挂载
              ├─> Scenario B: Multi-page -> Load with conflict resolution | 场景 B：多页面
              ├─> Scenario C: Legacy single-page -> Convert & load | 场景 C：旧版单页
              └─> Scenario D: Empty project -> Initialize defaults | 场景 D：空项目
              └─> setIsCanvasReady(true) -> Hide loading overlay | 隐藏加载遮罩
```

**Canvas Initialization Details | 画布初始化详情** (`FabricCanvas.tsx:190-419`):

```typescript
// 1. Create Fabric.js Canvas | 创建 Fabric.js 画布
const canvas = new Canvas(canvasEl.current, {
  width: containerWidth,
  height: containerHeight,
  backgroundColor: "transparent",
  fireRightClick: true,
  stopContextMenu: true,
  preserveObjectStacking: true,
})

// 2. Add logical canvas background (white design area)
// 添加逻辑画布背景（白色设计区域）
const canvasBackground = new Rect({
  width: logicalCanvasSize.width, // Default 默认: 1200
  height: logicalCanvasSize.height, // Default 默认: 800
  fill: "#ffffff",
  selectable: false,
  excludeFromExport: true,
})

// 3. Register to Store | 注册到 Store
setCanvas(canvas)

// 4. Bind events | 绑定事件: selection, object:modified, object:added, etc.
```

**Key Files | 关键文件：**

- Editor Page 编辑器页面: `src/app/editor/[id]/page.tsx`
- Canvas Component 画布组件: `src/components/editor/FabricCanvas.tsx`
- Store 状态: `src/store/useEditorStore.ts`

### Flow 3: Auto-Save | 流程 3：自动保存

Changes are automatically saved with debouncing:
更改会通过防抖自动保存：

```
User makes change | 用户进行更改
      │
      ├─> Canvas events trigger | 画布事件触发
      │   └─> syncLayers() -> Update store.layers | 更新图层
      │   └─> Debounced thumbnail generation (1s delay) | 防抖缩略图生成
      │       └─> updatePage(activePageId, { thumbnail, json })
      │
      └─> useAutoSave hook (useAutoSave.ts:23-108)
          ├─> Immediate: Save to localStorage | 立即保存到本地存储
          └─> Debounced (200ms): PATCH /api/projects/${id} | 防抖保存到服务器
              └─> { json: { pages, activePageId }, name, thumbnailUrl }
```

**Conflict Resolution | 冲突解决：**

- Compare localStorage timestamp vs server `updatedAt` | 比较本地时间戳与服务器更新时间
- If local is newer and has unsaved changes, use local data | 如果本地更新且有未保存更改，使用本地数据
- Otherwise, sync local to match server | 否则同步本地以匹配服务器

### Flow 4: Page Switching (Multi-page) | 流程 4：页面切换（多页面）

```
User clicks different page in SlideList | 用户在幻灯片列表中点击不同页面
      │
      └─> setActivePageId(newPageId)
          ├─> Save current page JSON to store | 保存当前页面 JSON 到 store
          │   └─> updatePage(oldPageId, { json: canvas.toObject() })
          │
          └─> Load new page into canvas | 加载新页面到画布
              └─> canvas.loadFromJSON(newPage.json)
              └─> fixPathObjectsAfterLoad(canvas)
              └─> syncLayers(canvas)
```

## State Management (Zustand) | 状态管理

Central store in `useEditorStore.ts` | 中央状态存储：

```typescript
interface EditorStore {
  // Canvas | 画布
  canvas: Canvas | null
  setCanvas: (canvas) => void

  // Project | 项目
  projectId: string | null
  projectName: string

  // Multi-page | 多页面
  pages: Page[] // { id, json, thumbnail }
  activePageId: string | null
  addPage: () => void
  deletePage: (id) => void
  setActivePageId: (id) => void
  updatePage: (id, updates) => void

  // Tools | 工具
  activeTool: "select" | "hand" | "draw" | "pen"
  isDrawingMode: boolean
  brushColor: string
  brushWidth: number

  // Layers | 图层
  layers: FabricObject[]
  syncLayers: (canvas) => void

  // Selection | 选择
  selectedObjects: FabricObject[]

  // History (Undo/Redo) | 历史（撤销/重做）
  history: HistoryManager
  canUndo: boolean
  canRedo: boolean

  // Zoom & Pan | 缩放与平移
  zoomLevel: number
  scrollPosition: { x; y }

  // Path Editing | 路径编辑
  editingPath: Path | null
}
```

## History System (Undo/Redo) | 历史系统（撤销/重做）

Command pattern implementation in `src/lib/editor/history/`:
命令模式实现：

```typescript
// Available commands | 可用命令:
AddObjectCommand // Add object to canvas | 添加对象到画布
RemoveObjectsCommand // Remove objects from canvas | 从画布移除对象
ModifyObjectCommand // Change object properties | 更改对象属性

// Usage | 用法:
history.push(command) // Add to history stack | 添加到历史栈
history.undo() // Revert last command | 撤销上一个命令
history.redo() // Re-apply undone command | 重做已撤销的命令
history.execute(cmd) // Execute and add to history | 执行并添加到历史
```

**Tracked Operations | 跟踪的操作：**

- Object transforms (move, scale, rotate) via `object:modified` event | 对象变换
- Delete via Backspace/Delete key | 删除操作
- Path node edits are tracked as single command on edit mode exit | 路径节点编辑

## Database Schema | 数据库模式

```typescript
// src/db/schema.ts
export const projects = pgTable("project", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  json: jsonb("json"), // { pages: [...], activePageId }
  width: integer("width").default(800),
  height: integer("height").default(600),
  thumbnailUrl: text("thumbnailUrl"),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})
```

**JSON Structure (Multi-page) | JSON 结构（多页面）：**

```json
{
  "pages": [
    {
      "id": "page-uuid-1",
      "json": {
        "version": "5.3.0",
        "objects": [...],
        "backgroundColor": "#ffffff"
      },
      "thumbnail": "data:image/png;base64,..."
    }
  ],
  "activePageId": "page-uuid-1"
}
```

## API Endpoints | API 端点

| Method 方法 | Endpoint 端点        | Description 描述              |
| ----------- | -------------------- | ----------------------------- |
| GET         | `/api/projects`      | List user's projects 列出项目 |
| POST        | `/api/projects`      | Create new project 创建项目   |
| GET         | `/api/projects/[id]` | Get project by ID 获取项目    |
| PATCH       | `/api/projects/[id]` | Update project 更新项目       |
| DELETE      | `/api/projects/[id]` | Delete project 删除项目       |

## Code Standards | 代码规范

### Formatting Rules (Prettier) | 格式化规则

- Line width 行宽: 80 characters 字符
- Indentation 缩进: 2 spaces 空格
- No semicolons 不使用分号
- Double quotes 双引号
- Trailing commas (ES5) 尾随逗号

### TypeScript Configuration | TypeScript 配置

- Strict mode enabled 启用严格模式
- Path alias 路径别名: `@/*` maps to `./src/*`
- No unused locals, parameters, or imports 不允许未使用的变量

### Git Workflow | Git 工作流

- Pre-commit hooks 预提交钩子: lint-staged (ESLint fix + Prettier)
- Commit messages 提交消息: Angular convention (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert)

### Component Patterns | 组件模式

- Use shadcn/ui components from `src/components/ui/` | 使用 shadcn/ui 组件
- Use `cn()` utility for className merging | 使用 cn() 工具合并类名
- Components support dark mode via CSS variables | 组件通过 CSS 变量支持暗色模式

## Important Implementation Details | 重要实现细节

### Next.js 16 Proxy (not Middleware) | Next.js 16 代理（非中间件）

Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`. Do NOT create `middleware.ts` files.
Next.js 16 弃用了 `middleware.ts`，改用 `proxy.ts`。不要创建 `middleware.ts` 文件。

```
src/proxy.ts  ✅ Correct | 正确
src/middleware.ts  ❌ Deprecated | 已弃用
```

The proxy file handles:
代理文件处理：

- Authentication checks (NextAuth) | 认证检查
- Device fingerprint validation | 设备指纹验证
- Protected route redirection | 受保护路由重定向

### Logical Canvas vs DOM Canvas | 逻辑画布 vs DOM 画布

- DOM canvas size = container size (fills available space) | DOM 画布大小 = 容器大小
- Logical canvas = white Rect representing design area (default 1200x800) | 逻辑画布 = 白色矩形设计区域
- Zoom/pan uses Fabric.js `viewportTransform` | 缩放/平移使用 Fabric.js 视口变换

### Path Editing Architecture | 路径编辑架构

Custom path data stored on Path objects:
自定义路径数据存储在 Path 对象上：

```typescript
interface CustomPathData {
  nodes: PathNode[] // Anchor points with handles | 带手柄的锚点
}

interface PathNode {
  anchor: { x; y } // Anchor position | 锚点位置
  handleIn: { x; y } // Bezier control point (incoming) | 入射贝塞尔控制点
  handleOut: { x; y } // Bezier control point (outgoing) | 出射贝塞尔控制点
  mode: "straight" | "mirrored" // Node type | 节点类型
}
```

### Control Point Scaling | 控制点缩放

Control points (anchors, handles) scale inversely with zoom to maintain consistent visual size:
控制点（锚点、手柄）随缩放反向缩放以保持视觉一致性：

```typescript
cp.set({
  radius: baseRadius / zoom,
  strokeWidth: baseStrokeWidth / zoom,
})
```

## Modular Canvas Hooks Architecture | 模块化画布钩子架构

The canvas initialization is split into independent, composable hooks in `src/hooks/canvas/`.
画布初始化被拆分为独立、可组合的钩子，位于 `src/hooks/canvas/`。

### Hook Dependency Graph | 钩子依赖图

```
useCanvasInit (required, must be first | 必需，必须首先调用)
    │
    ├── useCanvasSelection    # Selection events | 选择事件
    ├── useCanvasHistory      # Undo/redo tracking | 撤销/重做跟踪
    ├── useCanvasLayerSync    # Layer panel sync | 图层面板同步
    ├── useCanvasThumbnail    # Thumbnail generation | 缩略图生成
    ├── useCanvasKeyboard     # Keyboard shortcuts | 键盘快捷键
    ├── useCanvasDrawingMode  # Drawing mode sync | 绘图模式同步
    ├── useCanvasPenTool      # Pen tool logic | 钢笔工具逻辑
    ├── useCanvasPathEdit     # Path editing mode | 路径编辑模式
    ├── useCanvasZoomScaling  # Control point zoom | 控制点缩放
    ├── useCanvasZoom         # Zoom controls | 缩放控制
    └── useCanvasPan          # Pan controls | 平移控制
```

### Hook Descriptions | 钩子说明

| Hook 钩子              | Responsibility 职责                                        |
| ---------------------- | ---------------------------------------------------------- | -------------------------------- |
| `useCanvasInit`        | Create Fabric.js Canvas, add background, register to store | 创建画布，添加背景，注册到 store |
| `useCanvasSelection`   | Handle selection:created/updated/cleared events            | 处理选择事件                     |
| `useCanvasHistory`     | Track transforms for undo/redo (ModifyObjectCommand)       | 跟踪变换用于撤销/重做            |
| `useCanvasLayerSync`   | Sync object:added/removed/modified to layer panel          | 同步对象到图层面板               |
| `useCanvasThumbnail`   | Generate thumbnails and JSON snapshots (debounced)         | 生成缩略图和 JSON 快照（防抖）   |
| `useCanvasKeyboard`    | Handle Ctrl+Z, Delete, Backspace shortcuts                 | 处理键盘快捷键                   |
| `useCanvasDrawingMode` | Sync drawing mode, brush color/width to canvas             | 同步绘图模式、画笔颜色/宽度      |
| `useCanvasPenTool`     | Complete pen tool with bezier curve creation               | 完整钢笔工具与贝塞尔曲线创建     |
| `useCanvasPathEdit`    | Enter/exit edit mode, control point manipulation           | 进入/退出编辑模式，控制点操作    |
| `useCanvasZoomScaling` | Update control point sizes when zoom changes               | 缩放时更新控制点大小             |

### Usage Example | 使用示例

```tsx
function FabricCanvas() {
  const containerRef = useRef<HTMLDivElement>(null!)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Core initialization (required) | 核心初始化（必需）
  useCanvasInit({ containerRef, canvasRef })

  // Optional modules - enable/disable as needed
  // 可选模块 - 根据需要启用/禁用
  useCanvasSelection()
  useCanvasHistory()
  useCanvasLayerSync()
  useCanvasThumbnail()
  useCanvasKeyboard()
  useCanvasDrawingMode()
  useCanvasPenTool()

  // Path editing with refs for zoom scaling
  // 路径编辑，带用于缩放的 refs
  const { editingPathRef, controlsRef } = useCanvasPathEdit()
  useCanvasZoomScaling({ controlsRef, editingPathRef })

  // Zoom and pan | 缩放和平移
  useCanvasZoom(containerRef)
  useCanvasPan()

  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}
```

### Disabling Features | 禁用功能

To disable a feature, simply remove the corresponding hook call:
要禁用某功能，只需移除相应的钩子调用：

```tsx
// Remove these to disable features | 移除这些以禁用功能:
// useCanvasHistory()     // No undo/redo | 无撤销/重做
// useCanvasPenTool()     // No pen tool | 无钢笔工具
// useCanvasPathEdit()    // No path editing | 无路径编辑
```

## Task Completion Requirements | 任务完成要求

- After completing any task, ALWAYS run `bun run quality:fix` first
- 完成任何任务后，始终先运行 `bun run quality:fix`
- Then run `bun run quality` to ensure all checks pass
- 然后运行 `bun run quality` 确保所有检查通过
- Only proceed with commits after both commands succeed
- 只有在两个命令都成功后才进行提交

## Git Commit Rules | Git 提交规则

- NEVER include machine-generated suffixes or indicators
- 永远不要包含机器生成的后缀或标识
- Do NOT add "Generated with Claude Code" markers
- 不要添加"Generated with Claude Code"标记
- Do NOT add "Co-Authored-By: Claude" attribution
- 不要添加"Co-Authored-By: Claude"署名
- Keep commit messages clean and professional
- 保持提交消息简洁专业
