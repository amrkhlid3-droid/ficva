import { db } from "../src/db"
import { users } from "../src/db/schema"
import { sql } from "drizzle-orm"

async function verify() {
  console.log("🔍 Verifying test data persistence...")
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users)
    const count = result[0]?.count ?? 0
    console.log(`✅ Found ${count} users in the database.`)
    if (Number(count) > 0) {
      console.log("🎉 Data persistence verification successful!")
    } else {
      console.log("⚠️ No users found. Did the tests create any data?")
    }
    process.exit(0)
  } catch (err) {
    console.error("❌ Error verifying database:", err)
    process.exit(1)
  }
}

verify()
