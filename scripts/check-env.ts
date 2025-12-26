import "dotenv/config"

console.log("Checking DATABASE_URL...")
if (process.env.DATABASE_URL) {
  console.log(
    "DATABASE_URL is set (Length: " + process.env.DATABASE_URL.length + ")"
  )
} else {
  console.log("DATABASE_URL is NOT set")
}
