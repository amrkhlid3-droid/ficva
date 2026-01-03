import { auth } from "@/auth"
import { NextResponse } from "next/server"

/**
 * 设备指纹验证代理（原 middleware.ts）
 *
 * 安全策略：
 * 1. 服务端检查：验证 device-fingerprint Cookie 存在性
 *    - 如果用户已登录但没有指纹 Cookie → 可能是 session 劫持
 *
 * 2. 客户端检查（在 SessionProvider 中）：验证指纹核心特征匹配
 *    - WebGL、Canvas 等特征只能在客户端获取
 *    - 如果核心特征不匹配 → 自动登出
 *
 * 这种分层设计既保证了安全性，又避免了误判：
 * - 攻击者只复制 JWT 而没有 Cookie → 服务端拦截
 * - 攻击者复制所有内容但在不同浏览器 → 客户端拦截
 *
 * 注意：设备指纹验证目前仅在客户端进行（useSessionGuard）
 * 服务端不强制要求指纹，以避免老用户（没有指纹）被锁定
 */

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  const isLoggedIn = !!session?.user
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
  const isPublicRoute =
    nextUrl.pathname === "/login" ||
    nextUrl.pathname === "/register" ||
    nextUrl.pathname.startsWith("/images") ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/favicon.ico")

  // 允许认证相关路由
  if (isApiAuthRoute) {
    return NextResponse.next()
  }

  const isOnDashboard = !isPublicRoute

  console.log(
    `[Proxy] Path: ${nextUrl.pathname}, User: ${!!session?.user}, IsDashboard: ${isOnDashboard}`
  )

  // 受保护路由需要登录
  if (isOnDashboard) {
    if (isLoggedIn) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // 已登录用户访问登录/注册页面，重定向到首页
  if (
    isLoggedIn &&
    (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")
  ) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
}
