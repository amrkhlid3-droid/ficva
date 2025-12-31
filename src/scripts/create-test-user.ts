import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

async function main() {
  const email = "test@example.com"
  const password = "password"
  const hashedPassword = await bcrypt.hash(password, 10)

  let [user] = await db.select().from(users).where(eq(users.email, email))

  if (!user) {
    console.log("Creating test user...")
    const [newUser] = await db
      .insert(users)
      .values({
        name: "Test User",
        email: email,
        image: "",
        password: hashedPassword,
      })
      .returning()
    if (!newUser) {
      throw new Error("Failed to create user")
    }
    user = newUser
  } else {
    // Ensure password is set
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email))
  }

  console.log(`TEST_USER_ID=${user.id}`)
  process.exit(0)
}

main()
