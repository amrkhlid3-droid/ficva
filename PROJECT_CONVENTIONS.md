# Project Conventions / 项目公约

## Communication & Documentation / 沟通与文档

- **Bilingual Requirement (双语要求)**: All commit messages, test descriptions, and important documentation changes MUST be in both English and Chinese.
  - Format: `English Text / 中文文本`
  - Scope: Git commits, E2E test names, code comments for complex logic.

## Testing / 测试

- **Parallelism (并发)**: Playwright is configured for 80% CPU utilization.
- **Isolation (隔离)**: Use standardized email formats `[context]-[timestamp]@example.com` to prevent data collisions.
