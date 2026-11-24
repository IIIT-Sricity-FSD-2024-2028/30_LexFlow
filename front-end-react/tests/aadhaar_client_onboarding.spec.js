import { test, expect } from '@playwright/test';
import { installTestApi } from './api-fixtures.js';

test.describe('Client Onboarding with Aadhaar formatting (12 Numbers, 4-4-4)', () => {
  test('Aadhaar field enforces 12 numbers in 4-4-4 format during client onboarding', async ({ page }) => {
    await installTestApi(page, { id: 'cl-20', role: 'client', fullName: 'Test Client' }, {
      'POST /api/users': (route) => {
        const body = route.request().postDataJSON();
        expect(body).toMatchObject({ role: 'client', aadhaar: '9876-5432-1098' });
        expect(body).not.toHaveProperty('id');
        expect(body).not.toHaveProperty('aadhaarNumber');
        return route.fulfill({ status: 201, json: { id: 'cl-20', role: 'client' } });
      },
    });
    await page.goto('/#/onboarding/client/1');
    await page.waitForLoadState('networkidle');

    // Verify title and Aadhaar input presence
    await expect(page.locator('h1')).toContainText('Create your client account');
    const aadhaarInput = page.locator('#aadhaar-input');
    await expect(aadhaarInput).toBeVisible();

    // Test live 4-4-4 auto-formatting
    await aadhaarInput.fill('987654321098');
    await expect(aadhaarInput).toHaveValue('9876-5432-1098');

    // Fill form with invalid password to trigger validation check
    await page.locator('input[placeholder="John Doe"]').fill('Rudra Sharma');
    await page.locator('input[type="email"]').fill('rudra@client.test');
    await page.locator('input[placeholder="+91 98765 43210"]').fill('+91 98765 43210');
    await page.locator('input[placeholder="San Francisco"]').fill('Mumbai');
    await page.locator('input[placeholder="123 Legal Way"]').fill('42 Marine Drive');
    await page.locator('input[placeholder="California"]').fill('Maharashtra');
    await page.locator('input[placeholder="560001"]').fill('400020');

    // Invalid short password
    await page.locator('input[type="password"]').first().fill('123');
    await page.locator('button[type="submit"]').click();

    // Check alert message
    await expect(page.locator('text=Please fix the errors below before continuing.')).toBeVisible();

    // Now fill strong valid password satisfying 4/5 rules
    await page.locator('input[type="password"]').first().fill('StrongPass123!');
    await page.locator('input[placeholder="Re-enter your password"]').fill('StrongPass123!');

    // Submit valid onboarding
    await page.locator('button[type="submit"]').click();

    // Should navigate to Step 2
    await expect(page).toHaveURL(/.*#\/onboarding\/client\/2/);
    await expect(page.locator('h1')).toContainText('Tell us about your case');

    // Complete onboarding by clicking "Finish & Go to Dashboard"
    await page.locator('button[type="submit"]').click();

    // Should navigate to client dashboard
    await expect(page).toHaveURL(/.*#\/client\/dashboard/);

    // Use the account ID issued by the API.
    const currentUser = await page.evaluate(() => JSON.parse(localStorage.getItem('currentUser') || '{}'));
    expect(currentUser.id).toBe('cl-20');
    expect(currentUser).not.toHaveProperty('aadhaar');
    expect(currentUser.role).toBe('client');
  });
});
