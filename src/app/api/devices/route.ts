import { auth } from "@/auth"
import { db } from "@/db"
import { userDevices } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { NextResponse } from "next/server"

const MAX_DEVICES = 5

/**
 * GET /api/devices - 获取用户的所有设备
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const devices = await db
      .select({
        id: userDevices.id,
        deviceName: userDevices.deviceName,
        lastActiveAt: userDevices.lastActiveAt,
        createdAt: userDevices.createdAt,
      })
      .from(userDevices)
      .where(eq(userDevices.userId, session.user.id))
      .orderBy(desc(userDevices.lastActiveAt))

    return NextResponse.json({ devices })
  } catch (error) {
    console.error("[API] Failed to get devices:", error)
    return NextResponse.json(
      { error: "Failed to get devices" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/devices - 注册新设备（登录时调用）
 * Body: { fingerprintHash: string, deviceName: string }
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { fingerprintHash, deviceName } = body

    if (!fingerprintHash || !deviceName) {
      return NextResponse.json(
        { error: "Missing fingerprintHash or deviceName" },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // 检查该指纹是否已存在
    const existingDevice = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .then((devices) =>
        devices.find((d) => d.fingerprintHash === fingerprintHash)
      )

    if (existingDevice) {
      // 设备已存在，更新最后活跃时间
      await db
        .update(userDevices)
        .set({ lastActiveAt: new Date() })
        .where(eq(userDevices.id, existingDevice.id))

      return NextResponse.json({
        success: true,
        isNewDevice: false,
        deviceId: existingDevice.id,
      })
    }

    // 检查设备数量限制
    const deviceCount = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .then((devices) => devices.length)

    if (deviceCount >= MAX_DEVICES) {
      // 删除最旧的设备
      const oldestDevice = await db
        .select()
        .from(userDevices)
        .where(eq(userDevices.userId, userId))
        .orderBy(userDevices.lastActiveAt)
        .limit(1)
        .then((devices) => devices[0])

      if (oldestDevice) {
        await db.delete(userDevices).where(eq(userDevices.id, oldestDevice.id))
      }
    }

    // 添加新设备
    const result = await db
      .insert(userDevices)
      .values({
        userId,
        fingerprintHash,
        deviceName,
      })
      .returning()

    const newDevice = result[0]
    if (!newDevice) {
      return NextResponse.json(
        { error: "Failed to create device" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      isNewDevice: true,
      deviceId: newDevice.id,
    })
  } catch (error) {
    console.error("[API] Failed to register device:", error)
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/devices - 删除指定设备
 * Body: { deviceId: string }
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { deviceId } = body

    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 })
    }

    // 确保只能删除自己的设备
    const device = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.id, deviceId))
      .then((devices) => devices[0])

    if (!device || device.userId !== session.user.id) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    await db.delete(userDevices).where(eq(userDevices.id, deviceId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Failed to delete device:", error)
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    )
  }
}
