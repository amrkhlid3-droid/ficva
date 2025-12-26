"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { register } from "@/actions/auth"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { registerSchema } from "@/lib/schemas"
import { PasswordStrength } from "@/components/auth/password-strength"
import { Social } from "@/components/auth/social"

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())

    try {
      // Client-side validation
      const validatedFields = registerSchema.safeParse(data)

      if (!validatedFields.success) {
        setError(validatedFields.error?.issues[0]?.message || "Invalid input")
        setLoading(false)
        return
      }

      const result = await register(formData)

      if (result?.error) {
        setError(result.error)
      } else {
        router.push("/login")
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-muted/50 flex min-h-screen w-full items-center justify-center p-4">
      <div className="bg-card w-full max-w-md space-y-8 rounded-lg border p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-muted-foreground">
            Enter your email to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readonly")}
            />
          </div>
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
              onChange={(e) => setPassword(e.target.value)}
              readOnly
              onFocus={(e) => e.target.removeAttribute("readonly")}
            />
            {password && <PasswordStrength password={password} />}
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              autoComplete="new-password"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readonly")}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
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
          Already have an account?{" "}
          <a href="/login" className="font-medium underline underline-offset-4">
            Sign in
          </a>
        </div>
      </div>
    </div>
  )
}
