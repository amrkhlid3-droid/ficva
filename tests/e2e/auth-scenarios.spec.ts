import { test, expect } from "@playwright/test"

test.describe("Authentication Scenarios / 认证场景", () => {
  test("should enforce strong password rules on registration / 注册时应强制执行强密码规则", async ({
    page,
    context,
  }) => {
    await context.clearCookies()
    await page.goto("/register")

    // Fill valid name and email / 填写有效的姓名和电子邮件
    await page.focus('input[name="name"]')
    await expect(page.locator('input[name="name"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="name"]', "Test User")
    const uniqueEmail = `auth-scenarios-val-${Date.now()}@example.com`
    await page.focus('input[name="email"]')
    await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="email"]', uniqueEmail)

    // ... (later in file)

    // Register a user first to ensure they exist / 先注册一个用户以确保其存在
    await page.goto("/register")
    await page.focus('input[name="name"]')
    await expect(page.locator('input[name="name"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="name"]', "Login User")
    await page.focus('input[name="email"]')
    await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="email"]', uniqueEmail)
    await page.focus('input[name="password"]')
    await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="password"]', "StrongP@ss1")
    await page.focus('input[name="confirmPassword"]')
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).not.toHaveAttribute("readonly")
    await page.fill('input[name="confirmPassword"]', "StrongP@ss1")

    // Try a weak password / 尝试使用弱密码
    await page.focus('input[name="password"]')
    await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="password"]', "weak")
    await page.focus('input[name="confirmPassword"]')
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).not.toHaveAttribute("readonly")
    await page.fill('input[name="confirmPassword"]', "weak")

    // Check validation feedback (PasswordStrength component) / 检查验证反馈（密码强度组件）
    await expect(page.getByText("At least 8 characters")).not.toHaveClass(
      /text-green-600/
    )

    // Try submitting / 尝试提交
    await page.click('button[type="submit"]', { force: true })
    // Wait for loading to finish (button text changes back) / 等待加载完成（按钮文本变回原样）
    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible()

    // Should see error / 应看到错误信息
    await expect(page.locator(".text-destructive").first()).toContainText(
      "must be at least 8 characters"
    )

    // Fill a strong password / 填写强密码
    await page.focus('input[name="password"]')
    await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="password"]', "StrongP@ss1")
    // Check validation feedback (all green) / 检查验证反馈（全绿）
    await expect(page.getByText("Strong")).toHaveClass(/text-green-600/)

    // Confirm password mismatch / 确认密码不匹配
    await page.focus('input[name="confirmPassword"]')
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).not.toHaveAttribute("readonly")
    await page.fill('input[name="confirmPassword"]', "Mismatch1!")
    await page.click('button[type="submit"]')
    await expect(page.getByText("Passwords do not match")).toBeVisible()

    // Success flow / 成功流程
    await page.focus('input[name="confirmPassword"]')
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).not.toHaveAttribute("readonly")
    await page.fill('input[name="confirmPassword"]', "StrongP@ss1")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL("/login")
  })

  test("should allow login with valid credentials / 应允许使用有效凭据登录", async ({
    page,
  }) => {
    const uniqueEmail = `auth-scenarios-login-${Date.now()}@example.com`
    // Register a user first to ensure they exist / 先注册一个用户以确保其存在
    await page.goto("/register")
    await page.focus('input[name="name"]')
    await expect(page.locator('input[name="name"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="name"]', "Login User")
    await page.focus('input[name="email"]')
    await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="email"]', uniqueEmail)
    await page.focus('input[name="password"]')
    await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="password"]', "StrongP@ss1")
    await page.focus('input[name="confirmPassword"]')
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).not.toHaveAttribute("readonly")
    await page.fill('input[name="confirmPassword"]', "StrongP@ss1")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL("/login")

    // Now try to log in / 现在尝试登录
    await page.focus('input[name="email"]')
    await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="email"]', uniqueEmail)
    await page.focus('input[name="password"]')
    await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="password"]', "StrongP@ss1")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL("/")
  })

  test("should prevent XSS patterns in input / 应防止输入中的 XSS 模式", async ({
    page,
  }) => {
    await page.goto("/register")
    await page.focus('input[name="name"]')
    await expect(page.locator('input[name="name"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="name"]', "<script>alert(1)</script>")
    const uniqueEmail = `auth-scenarios-xss-${Date.now()}@example.com`
    await page.focus('input[name="email"]')
    await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="email"]', uniqueEmail)
    await page.focus('input[name="password"]')
    await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
      "readonly"
    )
    await page.fill('input[name="password"]', "StrongP@ss1")
    await page.focus('input[name="confirmPassword"]')
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).not.toHaveAttribute("readonly")
    await page.fill('input[name="confirmPassword"]', "StrongP@ss1")

    // Attempt registration / 尝试注册
    await page.click('button[type="submit"]')

    // We expect it to either fail validation (if name schema excludes <>) or sanitize it.
    // Since our name schema is z.string().min(2), it might pass validation.
    // But React escapes content by default, so XSS shouldn't execute.
    // We verify redirection to login happens (meaning it was accepted)
    // or verification of sanitized data would be needed on the dashboard.
    // For this test, we just check no alert dialog appears.
    // 我们期望它通过验证（如果名称模式排除 <>）或对其进行清理。
    // 由于我们的名称模式是 z.string().min(2)，它可能会通过验证。
    // 但 React 默认转义内容，因此 XSS 不应执行。
    // 我们验证是否重定向到登录（意味着它已被接受）
    // 或者需要在仪表板上验证清理后的数据。
    // 对于此测试，我们只检查没有出现警报对话框。
    page.on("dialog", (dialog) => {
      throw new Error(`Unexpected dialog: ${dialog.message()}`)
    })

    await expect(page).toHaveURL("/login")
  })
})
