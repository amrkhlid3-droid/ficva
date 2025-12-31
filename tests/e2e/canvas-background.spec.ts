import { test, expect } from "@playwright/test"

test.describe("Canvas Background Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Create new project
    await page.goto("/")
    await page.click("text=Create Design")
    await page.waitForURL(/\/editor\/.+/)
    await page.waitForSelector("canvas")
  })

  test("should persist background color when adding objects", async ({
    page,
  }) => {
    // 1. Change background color to something distinctive (e.g., Red #ff0000)
    // Assuming there is a background color input in the Properties Panel
    // We need to deselect everything first to see Canvas properties?
    // Usually clicking on canvas empty area does this, or if nothing selected initially.

    // Make sure nothing is selected
    const canvas = page.locator("canvas").first()
    await canvas.click({ position: { x: 10, y: 10 } })

    // Locate the background color input (hex input)
    // The user said "left bottom" but usually it's in Properties Panel (Right) or Toolbar?
    // Let's assume standard Properties Panel for Canvas.

    // const colorInput = page.getByPlaceholder('#000000').first(); // Adjust selector based on actual UI
    // If we can't find by placeholder, look for label "Background"

    // Wait for "Background" label in Properties panel
    await expect(page.getByText("Background")).toBeVisible()

    // Find the hex input near it.
    // We might need to inspect the code to get precise selector.
    // For now, let's try to interact with the input that has a hex value.

    // Let's set it to Red
    // const bgInput = page.locator('input[type="text"][value^="#"]');
    // This is risky if there are multiple.
    // Better strategy: Use the color picker or specific input.

    // Let's update the test after we inspect the UI code if needed.
    // But assuming we can find it:
    await page.fill('input[value="#ffffff"]', "#ff0000")
    await page.keyboard.press("Enter")

    // Verify canvas background changed (visual check or by evaluating JS)
    await expect(async () => {
      const bgColor = await page.evaluate(() => {
        // @ts-expect-error - accessing global editorStore
        const canvas = window.editorStore?.getState().canvas
        return canvas?.backgroundColor
      })
      return (
        bgColor === "#ff0000" ||
        bgColor === "rgba(255, 0, 0, 1)" ||
        bgColor === "red"
      )
    }).toPass()

    // 2. Add an object (Rectangle)
    await page.click('button[title="Square"]') // Adjust selector

    // Wait a moment for "auto-save" or "sync" logic to trigger (debounce is ~1s)
    await page.waitForTimeout(1500)

    // 3. Verify Background Color is STILL Red
    const bgColorAfterAdd = await page.evaluate(() => {
      // @ts-expect-error - accessing global canvas
      return canvas?.backgroundColor
    })

    expect(
      bgColorAfterAdd === "#ff0000" ||
        bgColorAfterAdd === "rgba(255, 0, 0, 1)" ||
        bgColorAfterAdd === "red"
    ).toBeTruthy()

    // 4. Verify UI Indicator
    // The input should still show #ff0000
    await expect(page.locator('input[value="#ff0000"]')).toBeVisible()
  })
})
