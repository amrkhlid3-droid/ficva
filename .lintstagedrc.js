module.exports = {
  // TypeScript 和 JavaScript 文件处理规则 | TypeScript and JavaScript file rules
  "*.{ts,tsx,js,jsx}": [
    // 1. ESLint 检查并自动修复 | ESLint check and auto-fix
    // 使用 --cache 加速，--no-warn-ignored 避免警告忽略文件
    // Use --cache for speed, --no-warn-ignored to avoid warnings on ignored files
    "eslint --fix --cache --no-warn-ignored",
    // --fix: 自动修复可修复的问题 | Auto-fix fixable issues
    // --cache: 只检查更改的文件，大幅提升性能 | Only check changed files, greatly improves performance

    // 2. Prettier 格式化 | Prettier formatting
    "prettier --write",
    // --write: 直接修改文件 | Modify files directly

    // 其他可选命令（根据需要取消注释）| Other optional commands (uncomment as needed)
    // 'eslint --fix --max-warnings 0',      // 将警告视为错误 | Treat warnings as errors
    // 'tsc --noEmit',                        // TypeScript 类型检查（可能较慢）| TypeScript type check (may be slow)
    // 'jest --bail --findRelatedTests',      // 运行相关测试 | Run related tests
  ],

  // JSON 文件处理规则 | JSON file rules
  "*.{json,jsonc}": [
    // Prettier 格式化 JSON | Format JSON with Prettier
    "prettier --write",
    // JSON 文件不需要 ESLint 检查 | JSON files don't need ESLint
  ],

  // Markdown 文件处理规则 | Markdown file rules
  "*.{md,mdx}": [
    // Prettier 格式化 Markdown | Format Markdown with Prettier
    "prettier --write",
    // 可选：Markdown lint 工具（如需要请取消注释）| Optional: Markdown lint tool (uncomment if needed)
    // 'markdownlint --fix',
  ],

  // CSS/SCSS/Less 文件处理规则 | CSS/SCSS/Less file rules
  "*.{css,scss,less}": [
    // Prettier 格式化样式文件 | Format style files with Prettier
    "prettier --write",
    // 可选：StyleLint（如需要请取消注释）| Optional: StyleLint (uncomment if needed)
    // 'stylelint --fix',
  ],

  // HTML 文件处理规则 | HTML file rules
  "*.{html,htm}": [
    // Prettier 格式化 HTML | Format HTML with Prettier
    "prettier --write",
    // 可选：HTMLHint（如需要请取消注释）| Optional: HTMLHint (uncomment if needed)
    // 'htmlhint',
  ],

  // YAML 文件处理规则 | YAML file rules
  "*.{yml,yaml}": [
    // Prettier 格式化 YAML | Format YAML with Prettier
    "prettier --write",
  ],

  // 图片文件优化（如需要请取消注释）| Image file optimization (uncomment if needed)
  // '*.{png,jpg,jpeg,gif,svg}': [
  //   // 使用 imagemin 优化图片 | Optimize images with imagemin
  //   'imagemin-lint-staged',
  // ],

  // 其他配置文件格式化 | Other config files formatting
  "*.{toml,ini,cfg}": [
    // Prettier 格式化配置文件 | Format config files with Prettier
    "prettier --write",
  ],

  // 包管理器文件 | Package manager files
  "package.json": [
    // Prettier 格式化 | Format with Prettier
    "prettier --write",
    // 可选：排序 package.json（如需要请取消注释）| Optional: Sort package.json (uncomment if needed)
    // 'sort-package-json',
  ],

  // 忽略文件配置 | Ignore file configuration
  // 注意：.gitignore 等文件没有 Prettier 解析器，不应该用 prettier 处理
  // Note: .gitignore and similar files don't have a Prettier parser, should not be processed by prettier
  // ".{gitignore,prettierignore,eslintignore}": [
  //   "prettier --write",
  // ],

  // Shell 脚本（如需要请取消注释）| Shell scripts (uncomment if needed)
  // '*.{sh,bash}': [
  //   // Shell 脚本检查 | Shell script check
  //   'shellcheck',
  //   // Shell 脚本格式化 | Shell script formatting
  //   'shfmt -w',
  // ],

  // Python 文件（如需要请取消注释）| Python files (uncomment if needed)
  // '*.py': [
  //   // Python 格式化和检查 | Python formatting and linting
  //   'black',
  //   'pylint',
  // ],

  // Go 文件（如需要请取消注释）| Go files (uncomment if needed)
  // '*.go': [
  //   // Go 格式化 | Go formatting
  //   'gofmt -w',
  //   'golint',
  // ],
}

// 高级配置示例（如需要可以替换上面的配置）| Advanced configuration example (can replace above config if needed)
// module.exports = async (stagedFiles) => {
//   const commands = [];
//
//   // 动态生成命令基于文件类型 | Dynamically generate commands based on file types
//   const jsFiles = stagedFiles.filter(file => file.match(/\.[jt]sx?$/));
//   if (jsFiles.length > 0) {
//     commands.push(`eslint --fix ${jsFiles.join(' ')}`);
//     commands.push(`prettier --write ${jsFiles.join(' ')}`);
//   }
//
//   const cssFiles = stagedFiles.filter(file => file.match(/\.(css|scss|less)$/));
//   if (cssFiles.length > 0) {
//     commands.push(`prettier --write ${cssFiles.join(' ')}`);
//   }
//
//   return commands;
// };

// 性能优化建议 | Performance optimization tips:
// 1. 避免在 lint-staged 中运行 tsc，因为它会检查整个项目 | Avoid running tsc in lint-staged as it checks the entire project
// 2. 使用 --cache 选项加速 ESLint | Use --cache option to speed up ESLint
// 3. 考虑并行运行命令 | Consider running commands in parallel
// 4. 只运行必要的命令 | Only run necessary commands
