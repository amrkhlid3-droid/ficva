import { test, expect } from "@playwright/test"

test("dashboard has correct title and components / 仪表板具有正确的标题和组件", async ({
  page,
}) => {
  // Register and Login first / 先注册并登录
  const timestamp = Date.now()
  const userData = {
    name: "Dashboard User",
    email: `dashboard-${timestamp}-${Math.random().toString(36).substring(7)}@example.com`,
    password: "StrongP@ss1",
  }

  await page.goto("/register")
  await page.focus('input[name="name"]')
  await expect(page.locator('input[name="name"]')).not.toHaveAttribute(
    "readonly"
  )
  await page.fill('input[name="name"]', userData.name)
  await page.focus('input[name="email"]')
  await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
    "readonly"
  )
  await page.fill('input[name="email"]', userData.email)
  await page.focus('input[name="password"]')
  await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
    "readonly"
  )
  await page.fill('input[name="password"]', userData.password)
  await page.focus('input[name="confirmPassword"]')
  await expect(
    page.locator('input[name="confirmPassword"]')
  ).not.toHaveAttribute("readonly")
  await page.fill('input[name="confirmPassword"]', userData.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/login/)

  await page.focus('input[name="email"]')
  await expect(page.locator('input[name="email"]')).not.toHaveAttribute(
    "readonly"
  )
  await page.fill('input[name="email"]', userData.email)
  await page.focus('input[name="password"]')
  await expect(page.locator('input[name="password"]')).not.toHaveAttribute(
    "readonly"
  )
  await page.fill('input[name="password"]', userData.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL("/")

  // Sidebar checks / 侧边栏检查
  await expect(page.getByRole("heading", { name: "Ficva" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Create a design" }).first()
  ).toBeVisible()
  await expect(page.locator("text=Home")).toBeVisible()

  // Header checks / 头部检查
  await expect(page.getByPlaceholder("Search your content")).toBeVisible()

  // Hero section checks / 英雄区域检查
  await expect(page.locator("text=What will you design today?")).toBeVisible()

  // Recent designs check / 最近的设计检查
  await expect(page.locator("text=Recent designs")).toBeVisible()
  await expect(page.locator("text=Project Proposal")).toBeVisible()
})
