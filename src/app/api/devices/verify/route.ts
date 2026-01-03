import { auth } from "@/auth"
import { db } from "@/db"
import { userDevices } from "@/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

/**
 * POST /api/devices/verify - 验证设备指纹是否已注册
 * Body: { fingerprintHash: string }
 *
 * 返回:
 * - valid: true  - 设备已注册，允许访问
 * - valid: false - 设备未注册，需要重新登录
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { fingerprintHash } = body

    if (!fingerprintHash) {
      return NextResponse.json(
        { error: "Missing fingerprintHash" },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // 查找该用户的所有设备
    const devices = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))

    // 检查当前指纹是否在已注册设备中
    const matchedDevice = devices.find(
      (d) => d.fingerprintHash === fingerprintHash
    )

    if (matchedDevice) {
      // 更新最后活跃时间
      await db
        .update(userDevices)
        .set({ lastActiveAt: new Date() })
        .where(eq(userDevices.id, matchedDevice.id))

      return NextResponse.json({
        valid: true,
        deviceId: matchedDevice.id,
        deviceName: matchedDevice.deviceName,
      })
    }

    // 设备未注册
    return NextResponse.json({
      valid: false,
      reason: "Device not registered",
    })
  } catch (error) {
    console.error("[API] Failed to verify device:", error)
    return NextResponse.json(
      { error: "Failed to verify device" },
      { status: 500 }
    )
  }
}
