import { test, expect } from '@playwright/test';

test.describe('Client Billing and Payment for New & Existing Clients', () => {
  test('New client onboards and successfully views and pays billing invoice', async ({ page }) => {
    // 1. New client onboards via Client Onboarding Step 1
    await page.goto('/#/onboarding/client/1');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Create your client account');

    // Enter details for new client
    await page.locator('input[placeholder="John Doe"]').fill('Rohit Malhotra');
    await page.locator('input[type="email"]').fill('rohit.malhotra@test.in');

    // Fill 12-digit Aadhaar
    const aadhaarInput = page.locator('#aadhaar-input');
    await aadhaarInput.fill('789012345678');
    await expect(aadhaarInput).toHaveValue('7890-1234-5678');

    await page.locator('input[placeholder="+91 98765 43210"]').fill('+91 98765 43210');
    await page.locator('input[placeholder="San Francisco"]').fill('Mumbai');
    await page.locator('input[placeholder="123 Legal Way"]').fill('42 Marine Drive');
    await page.locator('input[placeholder="California"]').fill('Maharashtra');
    await page.locator('input[placeholder="560001"]').fill('400020');

    await page.locator('input[type="password"]').first().fill('StrongPass123!');
    await page.locator('input[placeholder="Re-enter your password"]').fill('StrongPass123!');

    // Submit Step 1
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*#\/onboarding\/client\/2/);

    // Complete onboarding Step 2
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*#\/client\/dashboard/);

    // 2. Navigate to Billing & Payments
    await page.goto('/#/client/billing');
    await page.waitForLoadState('networkidle');

    // Verify page header and absence of error banner
    await expect(page.locator('h1')).toContainText('Billing & Payments');
    await expect(page.locator('text=Failed to load invoices')).not.toBeVisible();
    await expect(page.locator('text=Server error')).not.toBeVisible();

    // Verify stat cards
    await expect(page.locator('text=Total Amount Billed')).toBeVisible();
    await expect(page.locator('text=Total Paid')).toBeVisible();

    // Verify Invoices table loaded cleanly
    await expect(page.locator('text=My Invoices')).toBeVisible();
    await expect(page.locator('button:has-text("Pay Now")').first()).toBeVisible();

    // 3. Click Pay Now on the invoice
    await page.locator('button:has-text("Pay Now")').first().click();
    await expect(page).toHaveURL(/.*#\/client\/billing\/pay\/.+/);

    // Verify Pay Now page loaded invoice details
    await expect(page.locator('h1')).toContainText('Pay Invoice');
    await expect(page.locator('text=Invoice Summary')).toBeVisible();
    await expect(page.locator('text=Payment Details')).toBeVisible();

    // 4. Fill simulated payment form
    await page.locator('input[placeholder="Name on card"]').fill('Rohit Malhotra');
    await page.locator('input[placeholder="4242 4242 4242 4242"]').fill('4242424242424242');
    await page.locator('input[placeholder="MM/YY"]').fill('1228');
    await page.locator('input[placeholder="•••"]').fill('789');

    // Submit payment
    await page.locator('button:has-text("Pay")').click();

    // Check payment success screen
    await expect(page.locator('text=Payment Successful!').first()).toBeVisible();

    // Automatically redirected back to billing
    await page.waitForURL(/.*#\/client\/billing/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Billing & Payments');

    // Verify invoice is marked Paid with badge
    await expect(page.locator('span:has-text("Paid")').first()).toBeVisible();

    // 5. Navigate to Transactions page
    await page.locator('button:has-text("View All Transactions")').click();
    await expect(page).toHaveURL(/.*#\/client\/transactions/);
    await expect(page.locator('h1')).toContainText('All Transactions');
    await expect(page.locator('text=Completed').first()).toBeVisible();
  });

  test('Existing client Alice loads billing, sees invoices, and navigates to pay', async ({ page }) => {
    // Sign in as Alice
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').fill('alice@client.test');
    await page.locator('input[type="password"]').fill('clientpass');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*#\/client\/dashboard/);

    // Go to Billing
    await page.goto('/#/client/billing');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Billing & Payments');
    await expect(page.locator('text=Failed to load invoices')).not.toBeVisible();

    // Verify Alice has billed amounts
    await expect(page.locator('text=Sharma Tech Solutions Merger')).toBeVisible();
    await expect(page.locator('text=INV-9821A')).toBeVisible();
  });
});
