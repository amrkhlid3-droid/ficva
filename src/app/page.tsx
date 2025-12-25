import Link from "next/link"

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Link
        href="https://topcoderfullstack.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-primary text-4xl font-bold tracking-tight transition-colors sm:text-6xl lg:text-7xl"
      >
        TOPCODER FULLSTACK
      </Link>
    </div>
  )
}
