# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
bun dev                    # Start development server (primary)
bun dev:turbo             # Start with Turbopack for faster builds

# Code Quality
bun run lint              # Run ESLint with max warnings = 0
bun run lint:fix          # Auto-fix ESLint issues
bun run format            # Format code with Prettier
bun run format:check      # Check formatting without changes
bun run typecheck         # Run TypeScript type checking
bun run quality           # Run all checks: lint + format:check + typecheck
bun run quality:fix       # Fix issues and run checks: lint:fix + format + typecheck

# Production
bun run build             # Create production build
bun run build:turbo       # Production build with Turbopack
bun start                 # Start production server
```

## Architecture Overview

This is a Next.js latest application using the App Router pattern with TypeScript, Tailwind CSS, and shadcn/ui components. The project is configured for Supabase integration and uses Drizzle ORM for database operations.

### Key Directories

- `src/app/` - Next.js App Router pages and layouts
- `src/components/ui/` - shadcn/ui components (45+ pre-built components)
- `src/lib/` - Utilities and providers (theme, utils)
- `src/hooks/` - Custom React hooks

### Technology Stack

- **Framework**: Next.js with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS with CSS variables
- **UI Library**: shadcn/ui (New York style)
- **Database**: Supabase with Drizzle ORM
- **Forms**: React Hook Form + Zod validation
- **Dark Mode**: next-themes provider

## Code Standards

### Formatting Rules (enforced via Prettier)

- Line width: 80 characters
- Indentation: 2 spaces
- No semicolons
- Double quotes
- Trailing commas (ES5)

### TypeScript Configuration

- Strict mode enabled with all safety checks
- Path alias: `@/*` maps to `./src/*`
- No unused locals, parameters, or imports allowed
- Exact optional property types enforced

### Git Workflow

- Pre-commit hooks run lint-staged (ESLint fix + Prettier)
- Commit messages must follow Angular convention (enforced by commitlint)
- Valid commit types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

### Component Patterns

- Use existing shadcn/ui components from `src/components/ui/`
- Follow the established component structure when creating new components
- Utilize the `cn()` utility from `src/lib/utils.ts` for className merging
- Components support dark mode via CSS variables

## Important Notes

- Primary package manager is Bun, but npm/yarn/pnpm are also configured
- No test framework is currently set up
- Font optimization uses Geist font family via next/font
- All linting must pass with zero warnings for commits to succeed

## Task Completion Requirements

- After completing any task, ALWAYS run `bun run quality:fix` first to auto-fix any issues
- Then run `bun run quality` to ensure all checks pass
- Only proceed with commits after both commands succeed without errors
- When generating commit messages, DO NOT include any machine-generated suffixes or indicators

## Git Commit Rules

- NEVER include machine-generated suffixes or indicators in commit messages
- Do NOT add "🤖 Generated with Claude Code" or similar markers
- Do NOT add "Co-Authored-By: Claude" or any bot attribution
- Keep commit messages clean and professional without any automation indicators
