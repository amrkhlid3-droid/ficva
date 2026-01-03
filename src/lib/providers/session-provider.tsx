"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { useSessionGuard } from "@/hooks/useSessionGuard"
import { initDebugUtils } from "@/lib/editor/utils/debug"
import { useEffect } from "react"

function SessionGuardWrapper({ children }: { children: React.ReactNode }) {
  // 初始化调试工具（确保在任何页面都能看到调试日志）
  useEffect(() => {
    initDebugUtils()
  }, [])

  useSessionGuard()
  return <>{children}</>
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionGuardWrapper>{children}</SessionGuardWrapper>
    </NextAuthSessionProvider>
  )
}
