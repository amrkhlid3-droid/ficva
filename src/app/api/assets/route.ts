import { NextResponse, NextRequest } from "next/server"
import { ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { r2 } from "@/lib/r2"

export async function GET() {
  try {
    const bucketName = process.env.R2_BUCKET_NAME
    const publicDomain = process.env.R2_PUBLIC_DOMAIN

    if (!bucketName || !publicDomain) {
      console.error("R2 configuration missing")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: "uploads/", // Only list files in uploads folder
    })

    const { Contents } = await r2.send(command)

    // Transform S3 response to simple file list
    const files = (Contents || [])
      .filter((item) => item.Key && item.Size && item.Size > 0)
      .map((item) => ({
        key: item.Key,
        url: `${publicDomain}/${item.Key}`,
        lastModified: item.LastModified,
        size: item.Size,
      }))
      // Sort by newest first
      .sort((a, b) => {
        const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0
        const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0
        return timeB - timeA
      })

    return NextResponse.json({ files })
  } catch (error) {
    console.error("Error listing R2 objects:", error)
    return NextResponse.json(
      { error: "Failed to list assets" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json()

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 })
    }

    const bucketName = process.env.R2_BUCKET_NAME
    if (!bucketName) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })

    await r2.send(command)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting asset:", error)
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    )
  }
}
