import { expect, test } from '@playwright/test';

const plans = [
  { tier: 'Starter', monthlyPrice: 2999 },
  { tier: 'Growth', monthlyPrice: 9999 },
  { tier: 'Enterprise', monthlyPrice: 24999 },
];

async function openBilling(page, subscription, handleRequest) {
  await page.addInitScript(() => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'fa-1', role: 'firmadmin', firmId: 'firm-1' }));
    localStorage.setItem('access_token', 'renewal-test-token');
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform/subscriptions/firm-1') return route.fulfill({ json: subscription });
    if (path === '/api/platform/tiers') return route.fulfill({ json: plans });
    const handled = await handleRequest(route, path);
    if (!handled) return route.fulfill({ json: [] });
  });
  await page.goto('/#/firm/billing');
  await expect(page.getByRole('heading', { name: 'Your Plan' })).toBeVisible();
}

test('Firm admins can schedule a downgrade and turn off renewal during a paid period', async ({ page }) => {
  const subscription = {
    tier: 'Enterprise', monthlyPrice: 24999, hasPaidAccess: true, autoRenew: true,
    paymentMethod: { last4: '4242' }, currentPeriodEnd: '2099-12-24T12:00:00Z',
  };
  const changes = [];
  await openBilling(page, subscription, async (route, path) => {
    if (path.endsWith('/tier-change')) {
      const body = route.request().postDataJSON();
      changes.push(body);
      subscription.scheduledTier = body.tier === subscription.tier ? undefined : body.tier;
      await route.fulfill({ json: { subscription, charge: null } });
      return true;
    }
    if (path.endsWith('/renewal')) {
      const body = route.request().postDataJSON();
      changes.push(body);
      if (body.paymentMethod === null) delete subscription.paymentMethod;
      subscription.autoRenew = false;
      await route.fulfill({ json: subscription });
      return true;
    }
  });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Downgrade to Growth/ }).click();
  await expect(page.getByText('Growth scheduled for your next renewal')).toBeVisible();
  await expect(page.getByText(/Active plan: Enterprise/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pay subscription charge' })).toHaveCount(0);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel renewal', exact: true }).click();
  await expect(page.getByText('Automatic renewal off')).toBeVisible();
  await expect(page.getByText(/Paid through/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeEnabled();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove payment method' }).click();
  await expect(page.getByText('Test card ending in 4242')).toHaveCount(0);
  expect(changes).toEqual([{ tier: 'Growth' }, { autoRenew: false }, { paymentMethod: null }]);
});

test('A firm can retry a failed renewal and opt in to saving a test card', async ({ page }) => {
  const subscription = {
    tier: 'Starter', monthlyPrice: 2999, hasPaidAccess: false, autoRenew: true,
    paymentMethod: { last4: '0002' }, currentPeriodEnd: '2026-01-24T12:00:00Z',
    renewalFailure: 'The saved payment method declined the renewal.',
  };
  const charge = { id: 'PSUB-RETRY', tier: 'Starter', status: 'Overdue', period: '2026-02', amount: 2999 };
  const payments = [];
  await openBilling(page, subscription, async (route, path) => {
    if (path.endsWith('/renew')) {
      await route.fulfill({ json: charge });
      return true;
    }
    if (path === '/api/platform/charges') {
      await route.fulfill({ json: [charge] });
      return true;
    }
    if (path.endsWith('/PSUB-RETRY')) {
      payments.push(route.request().postDataJSON());
      Object.assign(subscription, {
        hasPaidAccess: true, paymentMethod: { last4: '4242' },
        currentPeriodEnd: '2099-12-24T12:00:00Z', renewalFailure: undefined,
      });
      charge.status = 'Paid';
      await route.fulfill({ json: charge });
      return true;
    }
  });

  await expect(page.getByRole('alert')).toContainText('declined the renewal');
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry renewal' }).click();
  await page.getByLabel(/^Cardholder name/).fill('Test Cardholder');
  await page.getByLabel(/^Card number/).fill('4242424242424242');
  await page.getByLabel(/^Expiry date/).fill('1299');
  await page.getByLabel(/^CVC/).fill('123');
  await page.getByRole('checkbox', { name: 'Save test card and enable automatic renewal' }).check();
  await page.locator('button[form="subscription-checkout"]').click();

  await expect(page.getByText(/Next renewal/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeEnabled();
  expect(payments).toEqual([{ status: 'Paid', paymentMethod: 'test-4242' }]);
});

test('A new firm signs in and lands on Billing to start its paid plan', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('firmOnboardingSessionId', 'test-session'));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform/tiers') return route.fulfill({ json: plans });
    if (path === '/api/users/firm-onboarding/step3/test-session') {
      expect(route.request().postDataJSON().tier).toBe('Enterprise');
      return route.fulfill({ json: { adminUserId: 'fa-1', firmId: 'firm-1' } });
    }
    if (path === '/api/users/login') {
      return route.fulfill({ json: {
        access_token: 'new-firm-token',
        user: { id: 'fa-1', role: 'firmadmin', firmId: 'firm-1' },
      } });
    }
    if (path === '/api/platform/subscriptions/firm-1') {
      expect(route.request().headers().authorization).toBe('Bearer new-firm-token');
      return route.fulfill({ json: { tier: 'Enterprise', monthlyPrice: 24999, hasPaidAccess: false } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/#/onboarding/firm/3');
  await page.getByRole('button', { name: /Enterprise/ }).click();
  await page.getByLabel(/^Admin Full Name/).fill('Test Firm Admin');
  await page.getByLabel(/^Admin Email Address/).fill('admin@example.test');
  await page.getByPlaceholder('Create a strong password').fill('FirmTest2026!');
  await page.getByPlaceholder('Re-enter your password').fill('FirmTest2026!');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Create Firm Account' }).click();
  await expect(page).toHaveURL(/#\/firm\/billing$/);
  await expect(page.getByRole('button', { name: 'Start plan' })).toBeVisible();
});
