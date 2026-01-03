import { auth } from "@/auth"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const [project] = await db.select().from(projects).where(eq(projects.id, id))

  if (!project) {
    return new NextResponse("Not Found", { status: 404 })
  }

  // Optional: check ownership?
  // currently only listing user's projects, but direct access might need check
  if (project.userId !== userId) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  return NextResponse.json(project)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params

    // Verify ownership before updating - only fetch userId for performance
    const [existingProject] = await db
      .select({ userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, id))

    if (!existingProject) {
      return new NextResponse("Not Found", { status: 404 })
    }

    if (existingProject.userId !== userId) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    const body = await req.json()
    const { name, json, width, height, thumbnailUrl } = body

    // Update without returning full data - client doesn't need the response body
    await db
      .update(projects)
      .set({
        ...(name && { name }),
        ...(json && { json }),
        ...(width && { width }),
        ...(height && { height }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))

    // Return minimal response - just indicate success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error)
    return new NextResponse(
      JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params

  // Verify ownership before deleting - only fetch userId for performance
  const [project] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, id))

  if (!project) {
    return new NextResponse("Not Found", { status: 404 })
  }

  if (project.userId !== userId) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  await db.delete(projects).where(eq(projects.id, id))

  return new NextResponse(null, { status: 204 })
}
