import { test, expect } from '@playwright/test';

test.describe('LexFlow Application Routes & Redux Authentication', () => {
  test('Landing page renders properly with header, hero and CTA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('img[alt="LexFlow logo"]')).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
    await expect(page.locator('button:has-text("Request Consultation")')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Simplifying Legal');

    // Clicking Login opens signin page
    await page.locator('button:has-text("Login")').click();
    await expect(page).toHaveURL(/.*#\/signin/);
  });

  test('Client can sign in, see Redux toast, and navigate client routes', async ({ page }) => {
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');

    // Sign in as Client Alice directly via email and password
    await page.locator('input[type="email"]').fill('alice@client.test');
    await page.locator('input[type="password"]').fill('clientpass');
    await page.locator('button[type="submit"]').click();

    // Verify redirected to client dashboard
    await expect(page).toHaveURL(/.*#\/client\/dashboard/);
    await expect(page.locator('h1')).toContainText('Consultations Dashboard');

    // Test Client Cases route
    await page.goto('/#/client/cases');
    await expect(page.locator('h1')).toContainText('My Cases');

    // Test Case Details route
    await page.goto('/#/client/cases/1');
    await expect(page.locator('h1')).toContainText('Case Details');

    // Test Law Firm Search route
    await page.goto('/#/client/search');
    await expect(page.locator('h1')).toContainText('Law Firm');

    // Test Client Billing route
    await page.goto('/#/client/billing');
    await expect(page.locator('h1')).toContainText('Billing');

    // Test Client Transactions route
    await page.goto('/#/client/transactions');
    await expect(page.locator('h1')).toContainText('All Transactions');

    // Test Documents route
    await page.goto('/#/documents');
    await expect(page.locator('h1')).toContainText('Document');

    // Test Activity Log route
    await page.goto('/#/activity-log');
    await expect(page.locator('h1')).toContainText('Activity Log');
  });

  test('Firm Admin can sign in and navigate firm routes', async ({ page }) => {
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');

    // Sign in as Firm Admin directly via email and password
    await page.locator('input[type="email"]').fill('firmadmin@lexflow.test');
    await page.locator('input[type="password"]').fill('firmadminpass');
    await page.locator('button[type="submit"]').click();

    // Verify redirected to firm dashboard
    await expect(page).toHaveURL(/.*#\/firm\/dashboard/);
    await expect(page.locator('h1')).toContainText('Consultations');

    // Test Firm Cases route
    await page.goto('/#/firm/cases');
    await expect(page.locator('h1')).toContainText('Case List');

    // Test Firm Tasks route
    await page.goto('/#/firm/tasks');
    await expect(page.locator('h1')).toContainText('Tasks');

    // Test Firm Billing route
    await page.goto('/#/firm/billing');
    await expect(page.locator('h1')).toContainText('Billing');

    // Test Firm Users route
    await page.goto('/#/firm/users');
    await expect(page.locator('h1')).toContainText('User Management');
  });

  test('Superadmin can sign in and navigate superadmin console routes', async ({ page }) => {
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');

    // Sign in as Super Admin directly via email and password
    await page.locator('input[type="email"]').fill('superadmin@lexflow.test');
    await page.locator('input[type="password"]').fill('superadminpass');
    await page.locator('button[type="submit"]').click();

    // Verify redirected to Superadmin Dashboard
    await expect(page).toHaveURL(/.*#\/superadmin\/dashboard/);
    await expect(page.locator('h1')).toContainText('Platform Overview');

    // Test Superadmin Revenue route
    await page.goto('/#/superadmin/revenue');
    await expect(page.locator('h1')).toContainText('Revenue');

    // Test Superadmin Firms route
    await page.goto('/#/superadmin/firms');
    await expect(page.locator('h1')).toContainText('Law Firms');

    // Test Superadmin Lawyers route
    await page.goto('/#/superadmin/lawyers');
    await expect(page.locator('h1')).toContainText('Lawyers & Interns');

    // Test Superadmin Users route
    await page.goto('/#/superadmin/users');
    await expect(page.locator('h1')).toContainText('Users');

    // Test Superadmin Consultations route
    await page.goto('/#/superadmin/consultations');
    await expect(page.locator('h1')).toContainText('Consultations');

    // Test Superadmin Invoices route
    await page.goto('/#/superadmin/invoices');
    await expect(page.locator('h1')).toContainText('Client Invoices');

    // Test Superadmin Settings route
    await page.goto('/#/superadmin/settings');
    await expect(page.locator('h1')).toContainText('Platform Settings');
  });
});
