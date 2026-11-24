import { expect, test } from '@playwright/test';

test('Subscription charges settle only after card checkout is confirmed', async ({ page }) => {
  const charge = {
    id: 'CHG-TEST-UPGRADE',
    kind: 'tier_change',
    period: '2026-11',
    tier: 'Growth',
    targetTier: 'Growth',
    amount: 2999,
    status: 'Pending',
  };
  const updates = [];

  await page.addInitScript(() => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'fa-1', role: 'firmadmin', firmId: 'firm-1' }));
    localStorage.setItem('access_token', 'firm-billing-test-token');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/platform/charges') return route.fulfill({ json: [charge] });
    if (path === '/api/platform/subscriptions/firm-1') {
      return route.fulfill({ json: charge.status === 'Paid'
        ? { tier: 'Growth', monthlyPrice: 9999 }
        : {
          tier: 'Starter', monthlyPrice: 2999, pendingTier: 'Growth',
          pendingChargeId: charge.id, requiredChargeIds: [charge.id],
        } });
    }
    if (path === '/api/platform/charges/' + charge.id && request.method() === 'PATCH') {
      updates.push(request.postDataJSON());
      if (updates.length === 1) {
        return route.fulfill({ status: 503, json: { message: 'Please try again.' } });
      }
      Object.assign(charge, { status: 'Paid', paymentMode: 'internal-mode' });
      return route.fulfill({ json: charge });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/#/firm/billing');
  const row = page.getByRole('row').filter({ hasText: charge.id });
  const openCheckout = row.getByRole('button', { name: 'Pay now' });
  const checkout = page.getByRole('heading', { name: 'Pay subscription charge' });
  const confirm = page.getByRole('button', { name: /^Pay .*2,999\.00$/ });

  await openCheckout.click();
  await expect(checkout).toBeVisible();
  await expect(page.getByText(/4242 4242 4242 4242|4000 0000 0000 0002/)).toHaveCount(0);
  await expect(page.getByLabel(/^Card number/)).toHaveValue('');
  await expect(page.getByLabel(/^Card number/)).not.toHaveAttribute('placeholder');
  expect(updates).toEqual([]);
  await page.getByLabel(/^Cardholder name/).fill('Test Cardholder');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await openCheckout.click();
  await expect(page.getByLabel(/^Cardholder name/)).toHaveValue('');
  expect(updates).toEqual([]);

  await confirm.click();
  await expect(page.getByText('Cardholder name is required', { exact: true })).toBeVisible();
  await page.getByLabel(/^Cardholder name/).fill('Test Cardholder');
  await page.getByLabel(/^Card number/).fill('5555555555554444');
  await page.getByLabel(/^Expiry date/).fill('0100');
  await page.getByLabel(/^CVC/).fill('123');
  await confirm.click();
  await expect(page.getByText('Enter a supported test card number.')).toBeVisible();
  await expect(page.getByText('Card has expired')).toBeVisible();
  expect(updates).toEqual([]);

  await page.getByLabel(/^Card number/).fill('4242424242424242');
  await expect(page.getByLabel(/^Card number/)).toHaveValue('4242 4242 4242 4242');
  await page.getByLabel(/^Expiry date/).fill('1299');
  await confirm.click();
  await expect(page.getByText('Payment failed: Please try again.', { exact: true })).toBeVisible();
  await expect(checkout).toBeVisible();
  await expect(row).toContainText('Pending');

  await confirm.click();
  await expect(checkout).toBeHidden();
  await expect(row.getByText('Settled', { exact: true })).toBeVisible();
  await expect(row).not.toContainText('internal-mode');
  await expect(page.getByText(/Active plan: Growth/)).toBeVisible();
  expect(updates).toEqual([{ status: 'Paid' }, { status: 'Paid' }]);
});
