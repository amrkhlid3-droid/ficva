module.exports = {
  // 继承的规则配置 | Extended rule configuration
  extends: ["@commitlint/config-conventional"],
  // @commitlint/config-conventional 提供了 Angular 风格的提交规范 | Provides Angular-style commit conventions

  // 自定义规则 | Custom rules
  rules: {
    // 提交类型规则 | Commit type rules
    "type-enum": [
      2, // 级别：0-禁用，1-警告，2-错误 | Level: 0-disable, 1-warning, 2-error
      "always", // 应用时机：always-始终检查，never-从不检查 | When: always-always check, never-never check
      [
        // 允许的提交类型列表 | Allowed commit types
        "feat", // 新功能 | New feature
        "fix", // 修复 bug | Bug fix
        "docs", // 仅文档更改 | Documentation only changes
        "style", // 不影响代码含义的更改（空白、格式化、缺少分号等）| Changes that don't affect code meaning
        "refactor", // 既不修复错误也不添加功能的代码更改 | Code change that neither fixes a bug nor adds a feature
        "perf", // 提高性能的代码更改 | Code change that improves performance
        "test", // 添加缺失的测试或更正现有测试 | Adding missing tests or correcting existing tests
        "build", // 影响构建系统或外部依赖的更改 | Changes to build system or external dependencies
        "ci", // 对 CI 配置文件和脚本的更改 | Changes to CI configuration files and scripts
        "chore", // 其他不修改 src 或测试文件的更改 | Other changes that don't modify src or test files
        "revert", // 撤销之前的提交 | Reverts a previous commit

        // 可选的自定义类型（根据需要取消注释）| Optional custom types (uncomment as needed)
        "wip", // 进行中的工作 | Work in progress
        "ui", // UI/UX 改进 | UI/UX improvements
        "release", // 发布相关更改 | Release related changes
        "deploy", // 部署相关更改 | Deployment related changes
        "hotfix", // 紧急修复 | Emergency fix
        "merge", // 合并分支 | Merge branches
        "init", // 初始提交 | Initial commit
        "security", // 安全相关更改 | Security related changes
        "upgrade", // 升级依赖 | Upgrade dependencies
        "downgrade", // 降级依赖 | Downgrade dependencies
        "i18n", // 国际化相关 | Internationalization related
        "typo", // 修正拼写错误 | Fix typos
        "dep", // 添加或删除依赖 | Add or remove dependencies
      ],
    ],

    // 提交类型大小写规则 | Type case rules
    "type-case": [
      2,
      "always",
      "lower-case", // 必须小写 | Must be lowercase
      // 其他选项：upper-case, camel-case, kebab-case, pascal-case, snake-case, start-case
    ],

    // 提交范围（scope）规则 | Scope rules
    "scope-case": [
      2,
      "always",
      "lower-case", // scope 必须小写 | Scope must be lowercase
    ],

    // scope 允许为空 | Scope can be empty
    "scope-empty": [
      0, // 禁用此规则，允许空 scope | Disable this rule, allow empty scope
      "never",
    ],

    // 自定义 scope 枚举（根据项目模块定制）| Custom scope enum (customize based on project modules)
    // 'scope-enum': [
    //   2,
    //   'always',
    //   [
    //     'components',  // 组件相关 | Component related
    //     'utils',       // 工具函数 | Utility functions
    //     'styles',      // 样式相关 | Style related
    //     'config',      // 配置相关 | Configuration related
    //     'api',         // API 相关 | API related
    //     'store',       // 状态管理 | State management
    //     'routes',      // 路由相关 | Routing related
    //     'tests',       // 测试相关 | Test related
    //     'deps',        // 依赖相关 | Dependency related
    //     'auth',        // 认证相关 | Authentication related
    //     'db',          // 数据库相关 | Database related
    //   ],
    // ],

    // 主题（subject）规则 | Subject rules
    "subject-case": [
      2,
      "always",
      "lower-case", // 主题必须小写开头 | Subject must start with lowercase
      // 注：通常建议首字母小写，但不强制整个主题都小写 | Note: Usually first letter lowercase is recommended
    ],

    // 主题不能为空 | Subject cannot be empty
    "subject-empty": [
      2,
      "never", // 不允许空主题 | Don't allow empty subject
    ],

    // 主题末尾不要句号 | No period at end of subject
    "subject-full-stop": [
      2,
      "never",
      ".", // 不允许以句号结尾 | Don't allow period at end
    ],

    // 主题最大长度 | Subject max length
    "subject-max-length": [
      2,
      "always",
      100, // 主题最多 100 个字符 | Subject max 100 characters
    ],

    // 主题最小长度 | Subject min length
    "subject-min-length": [
      2,
      "always",
      3, // 主题至少 3 个字符 | Subject min 3 characters
    ],

    // 头部最大长度（type(scope): subject）| Header max length
    "header-max-length": [
      2,
      "always",
      100, // 整个头部最多 100 个字符 | Entire header max 100 characters
    ],

    // 正文（body）规则 | Body rules
    "body-leading-blank": [
      1, // 警告级别 | Warning level
      "always", // 正文前必须有空行 | Must have blank line before body
    ],

    // 正文每行最大长度 | Body line max length
    "body-max-line-length": [
      2,
      "always",
      100, // 正文每行最多 100 个字符 | Body lines max 100 characters
    ],

    // 正文最小长度 | Body min length
    // 'body-min-length': [
    //   2,
    //   'always',
    //   10, // 如果有正文，至少 10 个字符 | If body exists, min 10 characters
    // ],

    // 页脚（footer）规则 | Footer rules
    "footer-leading-blank": [
      1,
      "always", // 页脚前必须有空行 | Must have blank line before footer
    ],

    // 页脚每行最大长度 | Footer line max length
    "footer-max-line-length": [
      2,
      "always",
      100, // 页脚每行最多 100 个字符 | Footer lines max 100 characters
    ],

    // 签名规则（Signed-off-by）| Signature rules
    // 'signed-off-by': [
    //   2,
    //   'always',
    //   'Signed-off-by:', // 要求签名 | Require signature
    // ],

    // 自定义规则（根据团队需求添加）| Custom rules (add based on team needs)
    // 'references-empty': [
    //   2,
    //   'never', // 必须包含 issue 引用 | Must include issue reference
    // ],
  },

  // 提示配置 | Prompt configuration
  prompt: {
    settings: {},
    messages: {
      skip: ":skip", // 跳过 | Skip
      max: "最多 %d 个字符 | Upper %d chars",
      min: "至少 %d 个字符 | %d chars minimum",
      emptyWarning: "不能为空 | Can not be empty",
      upperLimitWarning: "超过限制 | Over limit",
      lowerLimitWarning: "低于限制 | Below limit",
    },
    questions: {
      type: {
        description: "请选择提交类型 | Select the type of change",
        enum: {
          feat: {
            description: "新功能 | A new feature",
            title: "Features",
            emoji: "✨",
          },
          fix: {
            description: "修复 Bug | A bug fix",
            title: "Bug Fixes",
            emoji: "🐛",
          },
          docs: {
            description: "仅文档更改 | Documentation only changes",
            title: "Documentation",
            emoji: "📚",
          },
          style: {
            description:
              "不影响代码含义的更改 | Markup, white-space, formatting, missing semi-colons...",
            title: "Styles",
            emoji: "💎",
          },
          refactor: {
            description:
              "代码重构，既不修复错误也不添加功能 | A code change that neither fixes a bug nor adds a feature",
            title: "Code Refactoring",
            emoji: "📦",
          },
          perf: {
            description:
              "提高性能的代码更改 | A code change that improves performance",
            title: "Performance Improvements",
            emoji: "🚀",
          },
          test: {
            description:
              "添加缺失的测试或更正现有测试 | Adding missing tests or correcting existing tests",
            title: "Tests",
            emoji: "🚨",
          },
          build: {
            description:
              "影响构建系统或外部依赖的更改 | Changes that affect the build system or external dependencies",
            title: "Builds",
            emoji: "🛠",
          },
          ci: {
            description:
              "对 CI 配置文件和脚本的更改 | Changes to our CI configuration files and scripts",
            title: "Continuous Integrations",
            emoji: "⚙️",
          },
          chore: {
            description:
              "其他不修改源代码或测试文件的更改 | Other changes that don't modify src or test files",
            title: "Chores",
            emoji: "♻️",
          },
          revert: {
            description: "撤销之前的提交 | Reverts a previous commit",
            title: "Reverts",
            emoji: "🗑",
          },
        },
      },
      scope: {
        description:
          "此更改的范围是什么（例如组件或文件名）| What is the scope of this change (e.g. component or file name)",
      },
      subject: {
        description:
          "写一个简短的、命令式的时态描述 | Write a short, imperative tense description of the change",
      },
      body: {
        description:
          "提供更详细的更改描述（可选）| Provide a longer description of the change (optional)",
      },
      breaking: {
        description:
          "列出任何破坏性变更（可选）| List any BREAKING CHANGES (optional)",
      },
      issues: {
        description:
          "列出此更改关闭的任何 ISSUES（可选）| List any ISSUES CLOSED by this change (optional)",
      },
    },
  },

  // 忽略某些提交的规则检查 | Ignore rules for certain commits
  ignores: [
    // 忽略自动生成的提交 | Ignore auto-generated commits
    (commit) => commit.includes("auto-generated"),
    // 忽略版本标签 | Ignore version tags
    (commit) => commit.includes("[skip ci]"),
    // 忽略 Merge 提交 | Ignore merge commits
    (commit) => commit.match(/^Merge/),
  ],

  // 默认忽略规则 | Default ignore rules
  defaultIgnores: true, // 是否使用默认忽略规则 | Whether to use default ignore rules

  // 帮助链接 | Help URL
  helpUrl:
    "https://github.com/conventional-changelog/commitlint/#what-is-commitlint",
}

/*
提交信息格式 | Commit Message Format:
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>

示例 | Examples:
1. feat(auth): add login functionality
2. fix(ui): resolve button alignment issue
3. docs: update README with new API endpoints
4. style(components): format code with prettier
5. refactor(utils): simplify date formatting logic
6. perf(api): optimize database queries
7. test(auth): add unit tests for login service
8. build(deps): upgrade React to v18
9. ci: add GitHub Actions workflow
10. chore: update .gitignore

带正文和页脚的示例 | Example with body and footer:
fix(auth): prevent race condition in token refresh

The token refresh logic had a race condition when multiple
requests triggered refresh simultaneously. Added mutex lock
to ensure only one refresh happens at a time.

Fixes #123
BREAKING CHANGE: Token refresh API now returns different format
*/
