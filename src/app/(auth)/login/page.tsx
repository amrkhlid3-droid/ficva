"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Social } from "@/components/auth/social"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { registerDevice } from "@/lib/auth/deviceFingerprint"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        console.error("Login failed:", result.error)
        setError("Invalid credentials")
      } else {
        // 登录成功，注册设备到服务器
        await registerDevice()
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      console.error("Login Exception:", error)
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-muted/50 flex min-h-screen w-full items-center justify-center p-4">
      <div className="bg-card w-full max-w-md space-y-8 rounded-lg border p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              // Prevent autofill hack
              readOnly
              onFocus={(e) => e.target.removeAttribute("readonly")}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="new-password"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readonly")}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-4">
          <div className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase">
            Or continue with
          </span>
          <div className="bg-border h-px flex-1" />
        </div>

        <Social />

        <div className="text-center text-sm">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="font-medium underline underline-offset-4"
          >
            Sign up
          </a>
        </div>
      </div>
    </div>
  )
}
