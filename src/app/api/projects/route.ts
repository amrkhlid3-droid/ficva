import { auth } from "@/auth"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  // 只选择列表需要的字段，排除大型 json 字段以提高性能
  const userProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      thumbnailUrl: projects.thumbnailUrl,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))

  return NextResponse.json(userProjects)
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const body = await req.json()
  const { name, width, height } = body

  const [project] = await db
    .insert(projects)
    .values({
      name: name || "Untitled Design",
      width: width || 800,
      height: height || 600,
      userId: userId,
      json: {}, // Empty canvas initially
    })
    .returning()

  return NextResponse.json(project)
}
