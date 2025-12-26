import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

async function checkUser() {
  const email = "abc@gmail.com"
  const password = "123"

  console.log(`Checking user: ${email}`)

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (!user) {
    console.log("User not found in database.")
    return
  }

  console.log("User found:", user)

  if (!user.password) {
    console.log("User has no password.")
    return
  }

  const match = await bcrypt.compare(password, user.password)
  console.log(`Password match for '${password}': ${match}`)
}

checkUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
