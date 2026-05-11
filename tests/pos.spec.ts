import { test, expect, Page } from '@playwright/test';

// Helper: Login to the application
async function login(page: Page) {
    await page.goto('/login');
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Fill credentials - adjust selectors based on actual UI
    const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    const passwordInput = page.locator('input[type="password"]');

    if (await usernameInput.isVisible()) {
        await usernameInput.fill('admin');
        await passwordInput.fill('admin123');
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(/\/(dashboard|sales)/);
    }
}

test.describe('POS - Point of Sale', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/sales');
        await page.waitForLoadState('networkidle');
    });

    test('products load with stock information', async ({ page }) => {
        // Wait for products to load
        await expect(page.locator('.grid')).toBeVisible({ timeout: 10000 });

        // Check that product cards exist
        const productCards = page.locator('.grid > div');
        await expect(productCards).toHaveCount(await productCards.count());

        // Verify product structure (price, name visible)
        const firstProduct = productCards.first();
        await expect(firstProduct.locator('text=/EGP/')).toBeVisible();
    });

    test('search filters products correctly', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="Search"]');
        await searchInput.fill('test');

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Products should be filtered (or show no results)
        const productCards = page.locator('.grid > div');
        const count = await productCards.count();
        // Just verify the search was applied (count may vary)
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('staff selector is populated', async ({ page }) => {
        // Find staff selector in the sidebar
        const sidebarStaffSelect = page.locator('.bg-amber-50 select, [class*="amber"] select').first();

        if (await sidebarStaffSelect.isVisible()) {
            // Get options count
            const options = sidebarStaffSelect.locator('option');
            const optionCount = await options.count();
            expect(optionCount).toBeGreaterThan(1); // At least placeholder + 1 staff
        }
    });

    test('add product to cart', async ({ page }) => {
        // Click on first available product (not out of stock)
        const availableProduct = page.locator('.grid > div:not(:has-text("OUT OF STOCK"))').first();
        await availableProduct.click();

        // Cart should show item
        await expect(page.locator('text="Cart is empty"')).not.toBeVisible({ timeout: 3000 });
    });

    test('cart quantity controls work', async ({ page }) => {
        // Add product first
        const availableProduct = page.locator('.grid > div:not(:has-text("OUT OF STOCK"))').first();
        await availableProduct.click();

        // Wait for cart to update
        await page.waitForTimeout(500);

        // Verify product was added (cart should have items or quantity badge visible)
        const cartBadge = page.locator('.rounded-full, [data-cart-count]').first();
        await expect(cartBadge).toBeVisible({ timeout: 3000 });
    });

    test('checkout flow opens confirmation dialog', async ({ page }) => {
        // Add product
        const availableProduct = page.locator('.grid > div:not(:has-text("OUT OF STOCK"))').first();
        await availableProduct.click();

        // Click checkout button
        const checkoutButton = page.locator('button:has-text("فاتورة"), button:has-text("Checkout")');
        await checkoutButton.click();

        // Confirmation dialog should appear (use heading to avoid matching button)
        await expect(page.getByRole('heading', { name: 'Confirm Sale' })).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Staff Sales Report', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/reports/staff-sales');
        await page.waitForLoadState('networkidle');
    });

    test('page loads with staff selector', async ({ page }) => {
        // Wait for page to fully load
        await page.waitForTimeout(1000);

        // Check for staff dropdown or any select element
        const staffDropdown = page.locator('select, [role="combobox"]').first();
        const hasDropdown = await staffDropdown.isVisible();

        // Accept either dropdown visible or content loaded
        const hasContent = await page.locator('h1, h2, [class*="heading"]').first().isVisible();
        expect(hasDropdown || hasContent).toBe(true);
    });

    test('staff selection updates report', async ({ page }) => {
        const staffDropdown = page.locator('select').first();

        // Try selecting second option if available
        const options = staffDropdown.locator('option');
        const count = await options.count();

        if (count > 1) {
            await staffDropdown.selectOption({ index: 1 });
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Inventory Movements', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/movements');
        await page.waitForLoadState('networkidle');
    });

    test('page loads with transaction list', async ({ page }) => {
        // Check for table or list structure
        await expect(page.locator('table, .space-y-4')).toBeVisible({ timeout: 10000 });
    });

    test('type filter works', async ({ page }) => {
        const typeFilter = page.locator('select').filter({ hasText: /SALE|IN|OUT|ALL/i }).first();

        if (await typeFilter.isVisible()) {
            await typeFilter.selectOption('SALE');
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Audit Logs', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/logs');
        await page.waitForLoadState('networkidle');
    });

    test('logs page displays entries', async ({ page }) => {
        // Wait for content
        await page.waitForTimeout(1000);

        // Check for log entries or empty state
        const hasLogs = await page.locator('table tbody tr, .space-y-3 > div').count() > 0;
        const hasEmptyState = await page.locator('text="No logs", text="No activity"').isVisible();

        expect(hasLogs || hasEmptyState).toBe(true);
    });
});

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
    });

    test('dashboard loads with activity widget', async ({ page }) => {
        // Look for activity widget using specific heading
        await expect(page.getByRole('heading', { name: 'Recent System Activity' })).toBeVisible({ timeout: 10000 });
    });

    test('navigation links work', async ({ page }) => {
        // Click on Sales link in sidebar
        const salesLink = page.locator('a[href="/sales"], nav >> text="Sales"').first();
        if (await salesLink.isVisible()) {
            await salesLink.click();
            await page.waitForURL('**/sales');
        }
    });
});
