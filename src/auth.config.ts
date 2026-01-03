import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  // 方案 2：短有效期 Token
  session: {
    strategy: "jwt",
    maxAge: 60 * 20, // 20 分钟过期（之前是默认 30 天）
    updateAge: 60 * 15, // 每 15 分钟刷新 token
  },
  callbacks: {
    jwt({ token, user }) {
      // When user signs in, add their info to the token
      if (user) {
        token.id = user.id
        token.image = user.image
        // 记录登录时间
        token.loginAt = Date.now()
      }
      return token
    },
    session({ session, token }) {
      // Add user info from token to session
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.image = token.image as string | null
      }
      return session
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig
