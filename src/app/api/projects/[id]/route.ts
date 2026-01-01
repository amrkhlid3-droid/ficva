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
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params

  // Verify ownership before updating
  const [existingProject] = await db
    .select()
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

  const [updatedProject] = await db
    .update(projects)
    .set({
      ...(name && { name }),
      ...(json && { json }),
      ...(width && { width }),
      ...(height && { height }),
      ...(thumbnailUrl && { thumbnailUrl }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning()

  return NextResponse.json(updatedProject)
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

  // Verify ownership before deleting (optional but strict)
  const [project] = await db.select().from(projects).where(eq(projects.id, id))

  if (!project) {
    return new NextResponse("Not Found", { status: 404 })
  }

  if (project.userId !== userId) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  await db.delete(projects).where(eq(projects.id, id))

  return new NextResponse(null, { status: 204 })
}
