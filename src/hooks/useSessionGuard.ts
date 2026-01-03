"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useRef } from "react"
import {
  getActiveUserId,
  setActiveUserId,
  clearAllProjectCache,
  migrateOldStorageData,
} from "@/utils/storage"
import {
  verifyDeviceWithServer,
  registerDevice,
} from "@/lib/auth/deviceFingerprint"
import { debugSessionGuard as debug } from "@/lib/editor/utils/debug"

const BROADCAST_CHANNEL_NAME = "ficva-auth"

interface BroadcastMessage {
  type: "USER_LOGIN" | "USER_LOGOUT"
  userId: string
  timestamp: number
}

/**
 * useSessionGuard - 会话安全守卫 Hook
 *
 * 【核心职责】
 * 1. 检测用户切换，清理旧用户的本地缓存
 * 2. 通过 BroadcastChannel 跨标签页同步登录状态
 * 3. 当其他标签页登录不同账户时，当前标签页自动登出
 * 4. 迁移旧版本的 localStorage 数据格式
 * 5. 服务端设备指纹验证（设备必须在数据库中注册）
 *
 * 【安全保障】
 * - 防止同一浏览器多账户数据混淆
 * - 防止用户 A 的缓存数据被用户 B 读取
 * - 确保单浏览器单活跃账户
 * - 检测并阻止 Session 劫持（通过服务端设备指纹验证）
 * - 每个用户最多 5 台设备
 *
 * @example
 * ```tsx
 * // 在 layout 或 SessionProvider 中使用
 * function Layout({ children }) {
 *   useSessionGuard()
 *   return <>{children}</>
 * }
 * ```
 */
export function useSessionGuard() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const channelRef = useRef<BroadcastChannel | null>(null)
  const lastBroadcastTimeRef = useRef<number>(0)
  const fingerprintCheckedRef = useRef<boolean>(false)

  // Effect 1: 处理用户切换和数据迁移
  useEffect(() => {
    if (status === "loading") return
    if (!userId) return

    const previousUserId = getActiveUserId()

    // 检测用户切换
    if (previousUserId && previousUserId !== userId) {
      debug.warn("User switched detected", {
        from: previousUserId,
        to: userId,
      })
      // 清理所有项目缓存，防止数据泄漏
      clearAllProjectCache()
      debug.info("Cleared all project cache due to user switch")
    }

    // 更新当前活跃用户
    setActiveUserId(userId)
    debug.info("Active user set", { userId })

    // 迁移旧版本数据（如果有）
    migrateOldStorageData(userId)
  }, [userId, status])

  // Effect 2: 服务端设备指纹验证
  // 验证当前设备是否在服务器的已授权设备列表中
  useEffect(() => {
    if (status === "loading") return
    if (!userId) {
      // 用户未登录，重置检查标志
      fingerprintCheckedRef.current = false
      debug.info("User not logged in, reset fingerprint check flag")
      return
    }
    // 每个 session 只检查一次，避免重复检查
    if (fingerprintCheckedRef.current) {
      debug.info("Fingerprint already verified this session, skipping")
      return
    }

    async function verifyDevice() {
      debug.group("Device Fingerprint Verification")
      debug.time("Verification Duration")
      debug.info("Starting device verification with server...", { userId })

      const result = await verifyDeviceWithServer()

      if (result.valid) {
        debug.success("Device verified successfully", {
          deviceId: result.deviceId,
          deviceName: result.deviceName,
        })
        debug.health("healthy", "Device is registered and valid")
        fingerprintCheckedRef.current = true
        debug.timeEnd("Verification Duration")
        debug.groupEnd()
        return
      }

      // 设备未注册，尝试注册（可能是 OAuth 登录或新设备）
      debug.scenario(
        "DEVICE_NOT_REGISTERED",
        "Device not found in server, attempting to register..."
      )
      debug.info("Verification failed, trying to register device", {
        reason: result.reason,
      })

      const registerResult = await registerDevice()

      if (registerResult.success) {
        debug.success("Device registered successfully", {
          isNewDevice: registerResult.isNewDevice,
          deviceId: registerResult.deviceId,
        })
        debug.health(
          "healthy",
          registerResult.isNewDevice
            ? "New device registered"
            : "Existing device updated"
        )
        fingerprintCheckedRef.current = true
        debug.timeEnd("Verification Duration")
        debug.groupEnd()
        return
      }

      // 注册失败，可能是设备数量超限或其他错误
      debug.error("Failed to register device", {
        error: registerResult.error,
      })
      debug.scenario(
        "SECURITY_VIOLATION",
        "Possible session hijacking detected - signing out user"
      )
      debug.health("error", `Registration failed: ${registerResult.error}`)

      // 清理所有本地数据
      debug.warn("Clearing all local data before sign out")
      clearAllProjectCache()
      localStorage.clear()

      debug.timeEnd("Verification Duration")
      debug.groupEnd()

      // 登出用户
      signOut({ redirect: true, callbackUrl: "/login" })
    }

    verifyDevice()
  }, [userId, status])

  // Effect 3: BroadcastChannel 跨标签页同步
  useEffect(() => {
    if (status === "loading") return
    if (typeof window === "undefined") return
    if (!("BroadcastChannel" in window)) {
      debug.warn("BroadcastChannel not supported in this browser")
      return
    }

    // 创建广播频道
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channelRef.current = channel
    debug.info("BroadcastChannel created", {
      channelName: BROADCAST_CHANNEL_NAME,
    })

    // 监听其他标签页的消息
    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data
      debug.info("Received broadcast message", message)

      if (message.type === "USER_LOGIN") {
        // 其他标签页登录了不同用户
        if (userId && message.userId !== userId) {
          debug.scenario(
            "CROSS_TAB_LOGIN",
            `Another tab logged in as different user: ${message.userId}`
          )
          debug.warn("Signing out current user due to cross-tab login", {
            currentUser: userId,
            newUser: message.userId,
          })

          // 先清理本地缓存
          clearAllProjectCache()

          // 登出当前用户并跳转到登录页
          signOut({ redirect: true, callbackUrl: "/login" })
        }
      } else if (message.type === "USER_LOGOUT") {
        // 其他标签页登出了，如果是当前用户则也登出
        if (userId && message.userId === userId) {
          debug.scenario("CROSS_TAB_LOGOUT", "User logged out from another tab")
          debug.info("Signing out due to cross-tab logout")
          signOut({ redirect: true, callbackUrl: "/login" })
        }
      }
    }

    // 当前用户登录时，广播给其他标签页
    if (userId) {
      const now = Date.now()
      // 防抖：避免短时间内重复广播
      if (now - lastBroadcastTimeRef.current > 1000) {
        lastBroadcastTimeRef.current = now
        const message: BroadcastMessage = {
          type: "USER_LOGIN",
          userId,
          timestamp: now,
        }
        channel.postMessage(message)
        debug.info("Broadcast login message sent", { userId })
      }
    }

    // Cleanup
    return () => {
      channel.close()
      channelRef.current = null
      debug.info("BroadcastChannel closed")
    }
  }, [userId, status])

  // 返回当前用户 ID，方便外部使用
  return { userId, isAuthenticated: !!userId }
}

/**
 * 广播用户登出事件
 * 在手动登出时调用，通知其他标签页
 */
export function broadcastLogout(userId: string) {
  if (typeof window === "undefined") return
  if (!("BroadcastChannel" in window)) return

  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    const message: BroadcastMessage = {
      type: "USER_LOGOUT",
      userId,
      timestamp: Date.now(),
    }
    channel.postMessage(message)
    channel.close()
    debug.info("Broadcast logout message sent", { userId })
  } catch (e) {
    debug.error("Failed to broadcast logout", { error: e })
  }
}
