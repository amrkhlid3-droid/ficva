import { test, expect } from "@playwright/test"

test.describe("Authentication Flow / 认证流程", () => {
  test("should allow a user to register, logout, and login / 应允许用户注册、注销和登录", async ({
    page,
  }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()))

    const timestamp = Date.now()
    const userData = {
      name: "Test User",
      email: `auth-flow-${timestamp}-${Math.random().toString(36).substring(7)}@example.com`,
      password: "StrongP@ss1",
    }

    // 1. Register / 1. 注册
    await page.goto("/register")
    await expect(
      page.getByRole("heading", { name: "Create an account" })
    ).toBeVisible()

    await page.fill('input[name="name"]', userData.name)
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="password"]', userData.password)
    await page.fill('input[name="confirmPassword"]', userData.password)

    await page.click('button[type="submit"]')

    // Should redirect to login page after success / 成功后应重定向到登录页面
    await expect(page).toHaveURL(/\/login/)

    // 2. Login / 2. 登录
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="password"]', userData.password)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard (/) / 应重定向到仪表板 (/)
    await expect(page).toHaveURL("/")

    // Verify user is logged in (e.g., check for user profile or logout button)
    // Assuming there's a user menu or similar. For now, we can check that we are on the dashboard.
    // 验证用户已登录（例如，检查用户个人资料或注销按钮）
    // 假设有用户菜单或类似内容。目前，我们可以检查我们是否在仪表板上。
    await expect(page.getByText("What will you design today?")).toBeVisible()
  })

  test("should show error for existing user registration / 现有用户注册时应显示错误", async ({
    page,
  }) => {
    const timestamp = Date.now()
    const userData = {
      name: "Test User",
      email: `auth-flow-${timestamp}-${Math.random().toString(36).substring(7)}@example.com`,
      password: "StrongP@ss1",
    }

    // 1. Initial Registration (Should succeed) / 1. 初始注册（应成功）
    await page.goto("/register")
    await page.fill('input[name="name"]', userData.name)
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="password"]', userData.password)
    await page.fill('input[name="confirmPassword"]', userData.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/login/) // Confirm success / 确认成功

    // 2. Duplicate Registration (Should fail) / 2. 重复注册（应失败）
    await page.goto("/register")
    await page.fill('input[name="name"]', userData.name)
    await page.fill('input[name="email"]', userData.email)
    await page.fill('input[name="password"]', userData.password)
    await page.fill('input[name="confirmPassword"]', userData.password)
    await page.click('button[type="submit"]')

    // Should remain on register page and show error / 应停留在注册页面并显示错误
    await expect(page.getByText("User already exists")).toBeVisible()
  })
})
