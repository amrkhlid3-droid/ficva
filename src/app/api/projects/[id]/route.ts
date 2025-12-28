import { auth } from "@/auth"
import { db } from "@/db"
import { projects } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === "development") {
    userId = "9df4aef9-8ab3-4689-99f4-97d33d327e37"
  }

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
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === "development") {
    userId = "9df4aef9-8ab3-4689-99f4-97d33d327e37"
  }

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params
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
    .where(eq(projects.id, id)) // Add strict ownership check here if needed in query or separate check
    .returning()

  return NextResponse.json(updatedProject)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === "development") {
    userId = "9df4aef9-8ab3-4689-99f4-97d33d327e37"
  }

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
