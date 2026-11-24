import { test, expect } from '@playwright/test';
import { installTestApi } from './api-fixtures.js';

test('Startup removes old demo data and a server outage keeps sign-in closed', async ({ page }) => {
  const keys = ['lexflow_users', 'lexflow_firms', 'lexflow_cases', 'lexflow_consultations', 'lexflow_store_seeded'];
  await page.addInitScript((legacyKeys) => {
    for (const key of legacyKeys) localStorage.setItem(key, 'old-demo-value');
    localStorage.setItem('access_token', 'demo_jwt_fa-1_0');
    localStorage.setItem('currentUser', JSON.stringify({ id: 'fa-1', role: 'firmadmin' }));
    localStorage.setItem('userRole', 'firmadmin');
    localStorage.setItem('other-preference', 'keep');
  }, keys);
  await page.route('**/api/users/login', (route) => route.fulfill({
    status: 503,
    json: { message: 'The API is unavailable.' },
  }));
  await page.goto('/#/signin');
  await page.locator('input[type="email"]').fill('firmadmin@lexflow.test');
  await page.locator('input[type="password"]').fill('firmadminpass');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('The API is unavailable.')).toBeVisible();
  await expect(page).toHaveURL(/#\/signin$/);
  expect(await page.evaluate((legacyKeys) => legacyKeys.every((key) => localStorage.getItem(key) === null),
    [...keys, 'access_token', 'currentUser', 'userRole'])).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('other-preference'))).toBe('keep');
});

test('Billing redirects an expired session to sign-in and a fresh login restores access', async ({ page }) => {
  const firmAdmin = { id: 'fa-1', fullName: 'Test Firm Admin', role: 'firmadmin', firmId: 'firm-1' };
  await page.addInitScript((user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userRole', user.role);
    localStorage.setItem('access_token', 'expired-token');
  }, firmAdmin);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/users/login') {
      expect(request.headers().authorization).toBeUndefined();
      await route.fulfill({ json: { access_token: 'fresh-token', user: firmAdmin } });
      return;
    }
    if (request.headers().authorization === 'Bearer fresh-token') {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ status: 401, json: { message: 'Invalid or expired token' } });
  });

  await page.goto('/#/firm/billing');
  await expect(page).toHaveURL(/#\/signin$/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('currentUser'))).toBeNull();

  // A previously stored credential must not be attached to a new sign-in request.
  await page.evaluate(() => localStorage.setItem('access_token', 'expired-token'));
  await page.locator('input[type="email"]').fill('firmadmin@example.test');
  await page.locator('input[type="password"]').fill('test-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/#\/firm\/dashboard$/);
  await page.goto('/#/firm/billing');
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
});

test('Sign-in reports a server credential rejection instead of using the demo account', async ({ page }) => {
  await page.route('**/api/users/login', (route) => route.fulfill({
    status: 401,
    json: { message: 'Invalid email or password' },
  }));
  await page.goto('/#/signin');
  await page.locator('input[type="email"]').fill('firmadmin@lexflow.test');
  await page.locator('input[type="password"]').fill('firmadminpass');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/signin$/);
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
});

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
    await installTestApi(page, { id: 'cl-1', role: 'client', fullName: 'Client Alice' }, {
      'GET /api/cases/1': { id: 1, case_type: 'Civil', client_id: 'cl-1', cnr: '100001' },
    });
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
    await installTestApi(page, { id: 'fa-1', role: 'firmadmin', firmId: 'firm-1', fullName: 'Firm Admin' });
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
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/users/login') {
        return route.fulfill({ json: {
          access_token: 'test-superadmin-token',
          user: { id: 'sa-1', fullName: 'Test Superadmin', role: 'superadmin' },
        } });
      }
      const data = ['/api/platform/revenue/summary', '/api/platform/settings'].includes(path) ? {} : [];
      return route.fulfill({ json: data });
    });
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
