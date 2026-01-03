/**
 * 设备指纹工具
 *
 * 用于生成和验证设备指纹，防止 Session 劫持攻击。
 * 采用分层验证策略：
 *
 * 核心特征（必须完全匹配）：
 * - WebGL 渲染器: 显卡型号，几乎不会变化
 * - Canvas 指纹: 浏览器渲染差异，非常稳定
 * - CPU 核心数: 硬件特征，不会变化
 * - 内存大小: 硬件特征，不会变化
 * - 触摸点数: 设备类型，不会变化
 *
 * 辅助特征（允许少量变化）：
 * - User-Agent: 浏览器更新会变
 * - 语言设置: 用户可能修改
 * - 屏幕分辨率: 外接显示器会变
 * - 时区: 旅行时会变
 * - 平台: 不会变
 */

import { debugSessionGuard as debug } from "@/lib/editor/utils/debug"

const FINGERPRINT_COOKIE_NAME = "device-fingerprint"

/**
 * 获取 WebGL 渲染器信息
 * 不同显卡/驱动会返回不同的渲染器字符串
 */
function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement("canvas")
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    if (!gl) return "no-webgl"

    const debugInfo = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_debug_renderer_info"
    )
    if (!debugInfo) return "no-debug-info"

    const renderer = (gl as WebGLRenderingContext).getParameter(
      debugInfo.UNMASKED_RENDERER_WEBGL
    )
    const vendor = (gl as WebGLRenderingContext).getParameter(
      debugInfo.UNMASKED_VENDOR_WEBGL
    )

    return `${vendor}|${renderer}`
  } catch {
    return "webgl-error"
  }
}

/**
 * 生成 Canvas 指纹
 * 不同浏览器/系统渲染同一内容会产生微小差异
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext("2d")
    if (!ctx) return "no-canvas"

    // 绘制一些文本和图形
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillStyle = "#f60"
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = "#069"
    ctx.fillText("FICVA Fingerprint", 2, 15)
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)"
    ctx.fillText("FICVA Fingerprint", 4, 17)

    // 返回 canvas 数据的哈希（取部分字符避免过长）
    const dataUrl = canvas.toDataURL()
    return dataUrl.slice(-50)
  } catch {
    return "canvas-error"
  }
}

/**
 * 提取浏览器类型（忽略版本号）
 * "Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36" -> "Chrome"
 */
function getBrowserType(): string {
  const ua = navigator.userAgent
  if (ua.includes("Firefox")) return "Firefox"
  if (ua.includes("Edg")) return "Edge"
  if (ua.includes("Chrome")) return "Chrome"
  if (ua.includes("Safari")) return "Safari"
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera"
  return "Unknown"
}

/**
 * 提取操作系统类型（忽略具体版本）
 */
function getOSType(): string {
  const ua = navigator.userAgent
  if (ua.includes("Windows")) return "Windows"
  if (ua.includes("Mac OS")) return "MacOS"
  if (ua.includes("Linux")) return "Linux"
  if (ua.includes("Android")) return "Android"
  if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
    return "iOS"
  return "Unknown"
}

/**
 * 设备指纹数据结构
 */
interface FingerprintData {
  // 核心特征 - 必须完全匹配
  core: {
    webglRenderer: string
    canvasFingerprint: string
    cpuCores: number
    deviceMemory: number
    maxTouchPoints: number
    browserType: string
    osType: string
  }
  // 辅助特征 - 用于增强识别，允许部分变化
  auxiliary: {
    language: string
    screenResolution: string
    colorDepth: number
    pixelRatio: number
    timezone: string
    platform: string
  }
}

/**
 * 收集设备指纹数据
 */
function collectFingerprintData(): FingerprintData | null {
  if (typeof window === "undefined") {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceMemory = (navigator as any).deviceMemory || 0

  return {
    core: {
      webglRenderer: getWebGLRenderer(),
      canvasFingerprint: getCanvasFingerprint(),
      cpuCores: navigator.hardwareConcurrency || 0,
      deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      browserType: getBrowserType(),
      osType: getOSType(),
    },
    auxiliary: {
      language: navigator.language || "",
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      // navigator.platform 已弃用但仍可用
      platform: navigator.platform || "",
    },
  }
}

/**
 * 生成设备指纹（用于存储到 Cookie）
 * 格式: core指纹::auxiliary指纹
 */
export function generateDeviceFingerprint(): string {
  const data = collectFingerprintData()
  if (!data) return ""

  // 分别编码核心和辅助特征
  const coreString = JSON.stringify(data.core)
  const auxiliaryString = JSON.stringify(data.auxiliary)

  // 使用 :: 分隔，便于服务端解析
  const combined = `${btoa(encodeURIComponent(coreString))}::${btoa(encodeURIComponent(auxiliaryString))}`

  return combined
}

/**
 * 解析设备指纹
 */
export function parseDeviceFingerprint(
  fingerprint: string
): FingerprintData | null {
  try {
    const [corePart, auxiliaryPart] = fingerprint.split("::")
    if (!corePart || !auxiliaryPart) return null

    const core = JSON.parse(decodeURIComponent(atob(corePart)))
    const auxiliary = JSON.parse(decodeURIComponent(atob(auxiliaryPart)))

    return { core, auxiliary }
  } catch {
    return null
  }
}

/**
 * 比较两个指纹是否匹配
 * 核心特征必须完全匹配，辅助特征允许部分变化
 *
 * @returns 匹配结果和详细信息
 */
export function compareFingerprints(
  stored: string,
  current: string
): { match: boolean; reason?: string } {
  const storedData = parseDeviceFingerprint(stored)
  const currentData = parseDeviceFingerprint(current)

  if (!storedData || !currentData) {
    return { match: false, reason: "无法解析指纹" }
  }

  // 检查核心特征 - 必须完全匹配
  const coreKeys = Object.keys(
    storedData.core
  ) as (keyof typeof storedData.core)[]
  for (const key of coreKeys) {
    if (storedData.core[key] !== currentData.core[key]) {
      return {
        match: false,
        reason: `核心特征不匹配: ${key} (${storedData.core[key]} != ${currentData.core[key]})`,
      }
    }
  }

  // 核心特征匹配，检查辅助特征（仅记录，不阻止）
  const auxiliaryMismatches: string[] = []
  const auxKeys = Object.keys(
    storedData.auxiliary
  ) as (keyof typeof storedData.auxiliary)[]
  for (const key of auxKeys) {
    if (storedData.auxiliary[key] !== currentData.auxiliary[key]) {
      auxiliaryMismatches.push(key)
    }
  }

  if (auxiliaryMismatches.length > 0) {
    console.log(
      `[DeviceFingerprint] 辅助特征变化: ${auxiliaryMismatches.join(", ")}`
    )
  }

  return { match: true }
}

/**
 * 设置设备指纹 Cookie
 * 在登录成功后调用
 */
export function setDeviceFingerprintCookie(): void {
  if (typeof window === "undefined") {
    return
  }

  const fingerprint = generateDeviceFingerprint()

  // 设置 HttpOnly 为 false 以便 JavaScript 可以读取（用于调试）
  // 但 Secure 和 SameSite 保持安全设置
  document.cookie = `${FINGERPRINT_COOKIE_NAME}=${fingerprint}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`

  console.log("[DeviceFingerprint] Cookie set successfully")
}

/**
 * 获取当前设备指纹 Cookie
 */
export function getDeviceFingerprintCookie(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const cookies = document.cookie.split(";")
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=")
    if (name === FINGERPRINT_COOKIE_NAME) {
      return value ?? null
    }
  }

  return null
}

/**
 * 清除设备指纹 Cookie
 * 在登出时调用
 */
export function clearDeviceFingerprintCookie(): void {
  if (typeof window === "undefined") {
    return
  }

  document.cookie = `${FINGERPRINT_COOKIE_NAME}=; path=/; max-age=0`
  console.log("[DeviceFingerprint] Cookie cleared")
}

/**
 * 验证设备指纹是否匹配
 * 用于客户端自检
 */
export function verifyDeviceFingerprint(): boolean {
  const storedFingerprint = getDeviceFingerprintCookie()
  if (!storedFingerprint) {
    return true // 没有存储的指纹，视为新设备
  }

  const currentFingerprint = generateDeviceFingerprint()
  return storedFingerprint === currentFingerprint
}

/**
 * 生成核心指纹的哈希值
 * 用于服务端存储和比较（只使用核心特征）
 */
export async function generateFingerprintHash(): Promise<string> {
  debug.group("Fingerprint Hash Generation")
  debug.time("Hash Generation")

  const data = collectFingerprintData()
  if (!data) {
    debug.warn("Failed to collect fingerprint data (SSR environment?)")
    debug.groupEnd()
    return ""
  }

  // 只使用核心特征生成哈希
  const coreString = JSON.stringify(data.core)
  debug.info("Core fingerprint data collected", data.core)

  // 使用 Web Crypto API 生成 SHA-256 哈希
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(coreString)
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer)

  // 转换为十六进制字符串
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

  debug.success("Fingerprint hash generated", {
    hashPreview: `${hashHex.slice(0, 16)}...${hashHex.slice(-8)}`,
    hashLength: hashHex.length,
  })
  debug.timeEnd("Hash Generation")
  debug.groupEnd()

  return hashHex
}

/**
 * 获取设备名称（用于显示）
 * 格式: "Chrome on MacOS"
 */
export function getDeviceName(): string {
  const data = collectFingerprintData()
  if (!data) return "Unknown Device"

  return `${data.core.browserType} on ${data.core.osType}`
}

/**
 * 注册当前设备到服务器
 * 在登录成功后调用
 */
export async function registerDevice(): Promise<{
  success: boolean
  isNewDevice: boolean
  deviceId?: string
  error?: string
}> {
  debug.group("Device Registration")
  debug.time("Registration API Call")

  try {
    const fingerprintHash = await generateFingerprintHash()
    const deviceName = getDeviceName()

    debug.info("Sending registration request", {
      deviceName,
      hashPreview: `${fingerprintHash.slice(0, 16)}...`,
    })

    const response = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprintHash, deviceName }),
    })

    debug.timeEnd("Registration API Call")

    if (!response.ok) {
      const error = await response.json()
      debug.error("Registration API returned error", {
        status: response.status,
        error: error.error,
      })
      debug.groupEnd()
      return { success: false, isNewDevice: false, error: error.error }
    }

    const result = await response.json()
    debug.success("Device registered successfully", {
      isNewDevice: result.isNewDevice,
      deviceId: result.deviceId,
    })
    debug.groupEnd()

    return {
      success: true,
      isNewDevice: result.isNewDevice,
      deviceId: result.deviceId,
    }
  } catch (error) {
    debug.timeEnd("Registration API Call")
    debug.error("Registration failed with exception", { error })
    debug.groupEnd()
    return {
      success: false,
      isNewDevice: false,
      error: "Network error",
    }
  }
}

/**
 * 验证当前设备是否已在服务器注册
 */
export async function verifyDeviceWithServer(): Promise<{
  valid: boolean
  deviceId?: string
  deviceName?: string
  reason?: string
}> {
  debug.group("Device Verification with Server")
  debug.time("Verification API Call")

  try {
    const fingerprintHash = await generateFingerprintHash()

    debug.info("Sending verification request", {
      hashPreview: `${fingerprintHash.slice(0, 16)}...`,
    })

    const response = await fetch("/api/devices/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprintHash }),
    })

    debug.timeEnd("Verification API Call")

    if (!response.ok) {
      debug.error("Verification API returned error", {
        status: response.status,
      })
      debug.groupEnd()
      return { valid: false, reason: "Server error" }
    }

    const result = await response.json()

    if (result.valid) {
      debug.success("Device verification passed", {
        deviceId: result.deviceId,
        deviceName: result.deviceName,
      })
    } else {
      debug.warn("Device verification failed", {
        reason: result.reason,
      })
    }

    debug.groupEnd()
    return result
  } catch (error) {
    debug.timeEnd("Verification API Call")
    debug.error("Verification failed with exception", { error })
    debug.groupEnd()
    return { valid: false, reason: "Network error" }
  }
}
