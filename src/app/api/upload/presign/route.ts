import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2 } from "@/lib/r2"

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json()

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Filename and content type are required" },
        { status: 400 }
      )
    }

    const bucketName = process.env.R2_BUCKET_NAME
    const publicDomain = process.env.R2_PUBLIC_DOMAIN

    if (!bucketName || !publicDomain) {
      console.error("R2 configuration missing")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Generate a unique file key
    const uniqueId = crypto.randomUUID()
    const extension = filename.split(".").pop()
    const key = `uploads/${uniqueId}.${extension}`

    // Create the command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    })

    // Generate presigned URL (valid for 5 minutes)
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 })

    return NextResponse.json({
      uploadUrl,
      fileUrl: `${publicDomain}/${key}`,
    })
  } catch (error) {
    console.error("Error generating presigned URL:", error)
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    )
  }
}
