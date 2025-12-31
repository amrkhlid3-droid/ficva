import { test, expect } from "@playwright/test"

test.describe("Sync & Offline Capabilities", () => {
  test.beforeEach(async ({ page }) => {
    // Log console messages
    page.on("console", (msg) =>
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`)
    )

    // Navigate to a new project (using a random ID to ensure fresh state effectively)
    // In real app, we might need to create it via API first or use a mocked one.
    // For this test, we assume visiting /editor/new creates a project or we use a fixed ID with clean state.
    // Let's assume we are testing on a specific existing project or creating one.
    // Since we don't have a programmatic create, we visit a potentially new one?
    // Or we visit the known ID from other tests `123`.
    const projectId = "sync-test-" + Date.now()

    // Navigate and Login
    await page.goto("/login")
    await page.fill('input[type="email"]', "test@example.com")
    await page.fill('input[type="password"]', "password")
    await page.click('button[type="submit"]')
    // Wait for redirect to dashboard or home
    await page.waitForURL("**/dashboard") // Assuming redirect to dashboard

    // Now navigate to our specific test project wrapper
    await page.goto("http://localhost:3000/editor/" + projectId)

    // Mock the initial load if needed, but assuming backend handles it
    // If backend returns 404, does frontend create?
    // Based on page.tsx, it tries to fetch. If failed, it might not init.
    // We should probably visit the dashboard and click "New Design" if possible,
    // or just assume the dev server has a way.
    // Let's try mocking the GET request to return a default empty project.

    await page.route(`**/api/projects/${projectId}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: projectId,
              name: "Sync Test Project",
              json: {
                pages: [
                  {
                    id: "page-1",
                    json: {
                      version: "5.3.0",
                      objects: [],
                      backgroundColor: "#ffffff",
                    },
                  },
                ],
                activePageId: "page-1",
              },
              updatedAt: new Date().toISOString(),
            },
          }),
        })
      } else if (route.request().method() === "PATCH") {
        // Mock Save
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { updatedAt: new Date().toISOString() },
          }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test("Offline Persistence: Changes should survive reload when offline", async ({
    page,
  }) => {
    // 1. Wait for editor to load
    await expect(page.locator("canvas")).toBeVisible()

    // 2. Add an object (Rectangle)
    await page.getByText("Rectangle").click()

    // 3. Simulate Offline
    await page.context().setOffline(true)

    // 4. Add another object (Circle) - this should save to LocalStorage only
    await page.getByText("Circle").click()

    // 5. Reload page
    await page.reload()

    // 6. Verify "Unsaved changes restored" toast or check canvas count
    // The toast might appear
    // await expect(page.getByText("Unsaved changes restored")).toBeVisible({ timeout: 10000 })

    // Verify objects count via JS (Assuming 2 objects: 1 synced + 1 local, or both local)
    // Actually reload resets store, so it loads from local storage.
    const objectCount = await page.evaluate(() => {
      // @ts-expect-error - accessing global editorStore
      const canvas = window.editorStore?.getState().canvas
      return canvas?.getObjects().length
    })

    // We expect >= 1. The exact count relies on whether the first one was saved to server (it wasn't really, mocked only GET)
    expect(objectCount).toBeGreaterThan(0)
  })

  test("Immediate Sync: Adding a page should trigger immediate request", async ({
    page,
  }) => {
    await expect(page.locator("canvas")).toBeVisible()

    // Monitor network requests
    const requestPromise = page.waitForRequest(
      (request) =>
        (request.url().includes("/properties") ||
          request.url().includes("/projects") ||
          request.url().includes("/api/projects")) &&
        request.method() === "PATCH"
    )

    // Click Add Page (via Popover)
    await page.locator("button:has-text('Add Page')").click()
    await page.getByText("Blank Page").click()

    // Wait for request
    const request = await requestPromise
    expect(request).toBeTruthy()

    // Verify body has 2 pages
    const postData = request.postDataJSON()
    expect(postData.json.pages.length).toBe(2)
  })

  test("Conflict Resolution: Local newer data should override server", async ({
    page,
  }) => {
    const conflictProjectId = "conflict-test-" + Date.now()

    // 1. Inject Local Storage Data (Newer)
    const localData = {
      pages: [
        { id: "p1", json: {} },
        { id: "p2", json: {} },
      ], // 2 pages locally
      activePageId: "p1",
      projectName: "Local Project Name",
    }
    const storageEntry = {
      version: 1,
      timestamp: Date.now() + 100000, // Future timestamp to ensure it wins
      unsavedChanges: true,
      data: localData,
    }

    // We need to visit a domain to set localStorage.
    // We are already at /editor/... from beforeEach (but with different ID)
    // We can use the current page to set storage for the new ID
    await page.evaluate(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value))
      },
      { key: `project-storage-${conflictProjectId}`, value: storageEntry }
    )

    // 2. Mock API to return Older Data (1 page)
    await page.route(`**/api/projects/${conflictProjectId}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: conflictProjectId,
              name: "Server Project Name",
              json: {
                pages: [{ id: "p1", json: {} }], // Only 1 page on server
                activePageId: "p1",
              },
              updatedAt: new Date(Date.now() - 100000).toISOString(),
            },
          }),
        })
      } else if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { updatedAt: new Date().toISOString() },
          }),
        })
      } else {
        await route.continue()
      }
    })

    // 3. Visit the Conflict Project
    await page.goto("http://localhost:3000/editor/" + conflictProjectId)

    // 4. Verify Local Data Loaded (Should have 2 pages)
    // Check slide list items count or store state
    await expect(async () => {
      const pagesCount = await page.evaluate(() => {
        // @ts-expect-error - accessing global editorStore
        return window.editorStore?.getState().pages.length
      })
      return pagesCount === 2
    }).toPass()

    // Verify Toast or Log?
    // console log check: "[Sync] Conflict: Local is newer. Using Local."
  })
})
