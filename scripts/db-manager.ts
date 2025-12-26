import { db } from "../src/db"
import { sql } from "drizzle-orm"

async function clean() {
  console.log("🧹 Cleaning test database...")
  // Using CASCADE to handle foreign key constraints automatically
  await db.execute(
    sql`TRUNCATE TABLE "user", "account", "session", "verificationToken" CASCADE`
  )
  console.log("✨ Database cleaned.")
}

async function seed() {
  console.log("🌱 Seeding database...")
  // Add seed logic here as needed
  console.log("✅ Seeding completed.")
}

async function main() {
  try {
    await clean()
    await seed()
    process.exit(0)
  } catch (err) {
    console.error("❌ Error managing database:", err)
    process.exit(1)
  }
}

main()
