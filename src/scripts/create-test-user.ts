import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

async function main() {
  const email = "test@example.com"

  let [user] = await db.select().from(users).where(eq(users.email, email))

  if (!user) {
    console.log("Creating test user...")
    const [newUser] = await db
      .insert(users)
      .values({
        name: "Test User",
        email: email,
        image: "",
      })
      .returning()
    if (!newUser) {
      throw new Error("Failed to create user")
    }
    user = newUser
  }

  if (!user) {
    throw new Error("User not found")
  }

  console.log(`TEST_USER_ID=${user.id}`)
  process.exit(0)
}

main()
