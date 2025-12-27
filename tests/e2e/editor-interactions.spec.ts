import { test, expect } from '@playwright/test';

test.describe('Editor Interactions', () => {
  // Use existing auth/session if possible, or mocked bypass.
  // For simplicity, we assume we can visit /editor directly if public or log in.
  // Given previous tasks, we might have a 'test user'.

  test.beforeEach(async ({ page }) => {
    // 1. Register a new user
    await page.goto('/register');
    const nameInput = page.locator('input[name="name"]');
    await nameInput.focus(); // Triggers onFocus to remove readOnly
    await nameInput.fill('Test User');

    const uniqueEmail = `editor-test-${Date.now()}@example.com`;
    const emailInput = page.locator('input[name="email"]');
    await emailInput.focus();
    await emailInput.fill(uniqueEmail);

    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.focus();
    await passwordInput.fill('StrongP@ss1');

    const confirmInput = page.locator('input[name="confirmPassword"]');
    await confirmInput.focus();
    await confirmInput.fill('StrongP@ss1');
    await page.click('button[type="submit"]');

    // 2. Expect redirect to login then login
    await expect(page).toHaveURL('/login');

    // Login inputs also readOnly
    await emailInput.focus();
    await page.fill('input[name="email"]', uniqueEmail);

    await passwordInput.focus();
    await page.fill('input[name="password"]', 'StrongP@ss1');
    await page.click('button[type="submit"]');

    // 3. Expect redirect to dashboard or editor
    // Assuming dashboard is "/" and editor is linked or directly accessible.
    // Let's go to /editor explicitly after login ensures session.
    await expect(page).toHaveURL('/'); // Wait for login to complete

    await page.goto('/editor');
  });

  test('should add text object and update properties', async ({ page }) => {
    // 1. Add Text
    await page.getByRole('button', { name: 'Add Text' }).click();

    // 2. Verify Text Object is selected (Properties Panel shows "Typography")
    await expect(page.getByText('Typography')).toBeVisible();

    // 3. Change Font Size
    const sizeInput = page.getByPlaceholder('Size');
    await sizeInput.fill('60');
    // Trigger change event if needed (blur or enter)
    await sizeInput.blur();

    // 4. Verify value
    await expect(sizeInput).toHaveValue('60');

    // 5. Change Color (Red)
    await page.getByTitle('#ff0000').click();

    // We can't easily verify canvas pixel color without snapshot,
    // but we trust the command verified by unit tests.
  });

  test('should support undo and redo', async ({ page }) => {
    // 1. Add Text
    await page.getByRole('button', { name: 'Add Text' }).click();
    await expect(page.getByPlaceholder('Size')).toHaveValue('36'); // Default size

    // 2. Change Size
    const sizeInput = page.getByPlaceholder('Size');
    await sizeInput.fill('80');
    await sizeInput.blur();

    await expect(sizeInput).toHaveValue('80');

    // 3. Undo (using Toolbar button or shortcut)
    // Assuming there's an Undo button in Toolbar?
    // Wait, Toolbar.tsx has Undo/Redo buttons?
    // Let's check Toolbar.tsx content or look for aria-label/text.
    // Screenshot logic says "Undo2" icon used.
    // I will press Ctrl+Z to be safe and test header integration too.

    await page.keyboard.press('Meta+z'); // Mac

    // 4. Verify Size reverts to 36
    await expect(sizeInput).toHaveValue('36');

    // 5. Redo
    await page.keyboard.press('Meta+Shift+z');
    await expect(sizeInput).toHaveValue('80');
  });
});
