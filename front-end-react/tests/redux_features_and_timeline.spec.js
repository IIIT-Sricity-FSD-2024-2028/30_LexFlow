import { test, expect } from '@playwright/test';

test.describe('Redux Features, INR Consultation Currency, LawFirm Search and Firm Case Timeline', () => {

  test('Find a Law Firm page enforces INR currency, updated placeholder and 0 stars for 0-review Sharma', async ({ page }) => {
    // 1. Sign in as Client Alice
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').fill('alice@client.test');
    await page.locator('input[type="password"]').fill('clientpass');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/.*#\/client\/dashboard/);

    // 2. Visit Find a Law Firm page
    await page.goto('/#/client/search');
    await page.waitForLoadState('networkidle');

    // 3. Placeholder must not contain "lawyer"
    const searchInput = page.getByPlaceholder('Search firm name or specialty...');
    await expect(searchInput).toBeVisible();

    // 4. Verify Sharma & Associates shows 0.0 rating and 0 reviews
    const sharmaHeading = page.getByRole('heading', { name: 'Sharma & Associates' });
    await expect(sharmaHeading).toBeVisible();
    await expect(page.getByText('★ 0.0')).toBeVisible();
    await expect(page.getByText('(0 reviews)').first()).toBeVisible();

    // 5. Verify consultation fee is in INR (₹) rather than $
    await expect(page.getByText('₹250/hr').first()).toBeVisible();

    // 6. Open profile modal for Sharma
    await page.getByRole('button', { name: 'View Profile' }).first().click();
    await expect(page.getByRole('heading', { name: /Sharma & Associates/i }).first()).toBeVisible();
    await expect(page.getByText('0.0/5 (0 reviews)')).toBeVisible();
    await page.getByRole('button', { name: 'Back to List' }).click();
  });

  test('Firm Admin Case Details features editable Case Progress and Timeline & Milestones', async ({ page }) => {
    // 1. Log in as Firm Admin
    await page.goto('/#/signin');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').fill('firmadmin@lexflow.test');
    await page.locator('input[type="password"]').fill('firmadminpass');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/.*#\/firm\/dashboard/);

    // 2. Navigate to Firm Case Details for Case 1
    await page.goto('/#/firm/cases/1');
    await page.waitForLoadState('networkidle');

    // 3. Verify Tabs are present
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    const timelineTab = page.getByRole('button', { name: 'Timeline & Case Progress' });
    await expect(overviewTab).toBeVisible();
    await expect(timelineTab).toBeVisible();

    // 4. Switch to Timeline & Case Progress tab
    await timelineTab.click();

    // Verify Case Progress Card and editable parts
    await expect(page.getByRole('heading', { name: 'Case Progress' })).toBeVisible();
    await expect(page.getByText('Update Progress')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toBeVisible();

    // Change progress using preset button 75%
    await page.getByRole('button', { name: '75%' }).click();
    await page.getByRole('button', { name: 'Save Progress' }).click();

    // Verify progress updated
    await expect(page.getByText('75% Complete')).toBeVisible();

    // 5. Verify Timeline Card and Events
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByText('Case Filed')).toBeVisible();

    // 6. Add new timeline milestone
    await page.getByRole('button', { name: /Add Event/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Add Timeline Event' })).toBeVisible();

    await page.getByPlaceholder('e.g. Chargesheet Submitted, Bail Hearing, Plaint Filed...').fill('Interim Injunction Hearing');
    await page.getByPlaceholder('e.g. 15 Jan 2026').fill('18 Aug 2026');
    await page.getByPlaceholder('Brief details or observations about this milestone...').fill('Hearing concluded before High Court single bench');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Add Event' }).last().click();

    // Verify newly added event appears with UPCOMING badge
    await expect(page.getByText('Interim Injunction Hearing')).toBeVisible();
    await expect(page.getByText('18 Aug 2026')).toBeVisible();
    await expect(page.getByText('UPCOMING').first()).toBeVisible();
  });

});
