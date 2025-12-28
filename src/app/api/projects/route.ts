import { auth } from "@/auth"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  let userId = session?.user?.id

  // Fallback for development/testing if auth is broken
  if (!userId && process.env.NODE_ENV === "development") {
    userId = "9df4aef9-8ab3-4689-99f4-97d33d327e37" // Test User
  }

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))

  return NextResponse.json(userProjects)
}

export async function POST(req: Request) {
  const session = await auth()
  let userId = session?.user?.id

  // Fallback for development
  if (!userId && process.env.NODE_ENV === "development") {
    userId = "9df4aef9-8ab3-4689-99f4-97d33d327e37"
  }

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
