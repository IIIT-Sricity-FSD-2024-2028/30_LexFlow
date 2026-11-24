import { test, expect } from '@playwright/test';
import { installTestApi } from './api-fixtures.js';

test.describe('Bar Number for Lawyers and Live Verification', () => {
  test('Firm user forms validate inputs and surface API rejections', async ({ page }) => {
    await installTestApi(page, { id: 'fa-1', role: 'firmadmin', firmId: 'firm-1' }, {
      'POST /api/users': async (route) => {
        const body = route.request().postDataJSON();
        expect(body).not.toHaveProperty('id');
        expect(body).not.toHaveProperty('barEnrollmentNumber');
        expect(body).not.toHaveProperty('aadhaarNumber');
        const message = body.role === 'lawyer' ? 'The API rejected the lawyer record.' : 'The API rejected the client record.';
        await route.fulfill({ status: 400, json: { message } });
      },
    });
    // 1. Sign in as Firm Admin directly via email/password
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').fill('firmadmin@lexflow.test');
    await page.locator('input[type="password"]').fill('firmadminpass');
    await page.locator('button[type="submit"]').click();

    // Verify redirected to Firm Dashboard
    await expect(page).toHaveURL(/.*#\/firm\/dashboard/);

    // 2. Navigate to Firm User Management
    await page.goto('/#/firm/users');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('User Management');

    // 3. Open Add User Modal
    await page.locator('#add-user-btn').click();
    await expect(page.getByRole('heading', { name: 'Add New User' })).toBeVisible();

    // Default role is Lawyer
    const barInput = page.locator('#bar-number-input');
    await expect(barInput).toBeVisible();

    // Test invalid Bar Number
    await barInput.fill('INVALID-BAR');
    await expect(page.locator('text=Invalid format. Bar number must follow')).toBeVisible();

    // Test valid Bar Number
    await barInput.fill('MAH/7788/2019');
    await expect(page.locator('text=Bar Council of Maharashtra & Goa')).toBeVisible();

    // Fill valid lawyer data
    await page.locator('#user-fullname-input').fill('Adv. Vikram Deshmukh');
    await page.locator('#user-email-input').fill('vikram.deshmukh@sharma.law');

    // Click submit
    await page.locator('#submit-user-btn').click();

    await expect(page.getByText('The API rejected the lawyer record.')).toBeVisible();
    await expect(page.getByText('User created successfully.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await page.locator('#add-user-btn').click();
    await expect(page.getByRole('heading', { name: 'Add New User' })).toBeVisible();
    await page.locator('#user-role-select').selectOption('client');

    const aadhaarInput = page.locator('#client-aadhaar-input');
    await expect(aadhaarInput).toBeVisible();

    // Test typing 12 numbers -> auto-formatted to 4-4-4
    await aadhaarInput.fill('654321098765');
    await expect(aadhaarInput).toHaveValue('6543-2109-8765');
    await expect(page.locator('text=Valid 12-digit Aadhaar Card (4-4-4)')).toBeVisible();

    await page.locator('#user-fullname-input').fill('Client Rohit Verma');
    await page.locator('#user-email-input').fill('rohit@client.test');

    await page.locator('#submit-user-btn').click();

    await expect(page.getByText('The API rejected the client record.')).toBeVisible();
    await expect(page.getByText('User created successfully.')).toHaveCount(0);
  });

  test('Advocate Profile displays verified Bar Council enrollment badge', async ({ page }) => {
    await installTestApi(page, { id: 'cl-1', role: 'client' }, {
      'GET /api/users/lw-1': { id: 'lw-1', fullName: 'Lawyer Bob', role: 'lawyer', barNumber: 'MAH/1234/2018', isBarVerified: true },
    });
    // Sign in as Client Alice
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').fill('alice@client.test');
    await page.locator('input[type="password"]').fill('clientpass');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*#\/client\/dashboard/);

    await page.goto('/#/client/advocate/lw-1');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Adv. Lawyer Bob');
    await expect(page.locator('text=Bar Council Verified')).toBeVisible();
    await expect(page.locator('text=MAH/1234/2018').first()).toBeVisible();
  });

  test('Superadmin Lawyers console displays Bar numbers in roster table', async ({ page }) => {
    const lawyer = { id: 'lw-1', fullName: 'Lawyer Bob', email: 'bob@example.test', role: 'lawyer', barNumber: 'MAH/1234/2018' };
    await installTestApi(page, { id: 'sa-1', role: 'superadmin' }, {
      'GET /api/users/lawyers': [lawyer],
      'GET /api/users': [lawyer],
    });
    // Sign in as Superadmin
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').fill('superadmin@lexflow.test');
    await page.locator('input[type="password"]').fill('superadminpass');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*#\/superadmin\/dashboard/);

    await page.goto('/#/superadmin/lawyers');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Lawyers & Interns');
    await expect(page.locator('th:has-text("Bar Number")')).toBeVisible();
    await expect(page.locator('text=MAH/1234/2018').first()).toBeVisible();
  });
});
