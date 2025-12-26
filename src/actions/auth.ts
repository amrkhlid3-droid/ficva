"use server"

import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

import { registerSchema } from "@/lib/schemas"

export async function register(formData: FormData) {
  const data = Object.fromEntries(formData.entries())
  const validatedFields = registerSchema.safeParse(data)

  if (!validatedFields.success) {
    return {
      error: validatedFields.error?.issues[0]?.message || "Invalid input",
    }
  }

  const { name, email, password } = validatedFields.data

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (existingUser) {
    return { error: "User already exists" }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create user
  await db.insert(users).values({
    name,
    email,
    password: hashedPassword,
  })

  // Auto-login after registration
  // await signIn("credentials", { email, password, redirectTo: "/" })
  return { success: true }
}
