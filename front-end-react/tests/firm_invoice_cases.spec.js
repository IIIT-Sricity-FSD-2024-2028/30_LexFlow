import { expect, test } from '@playwright/test';

test('Firm invoices use a case from the selected client’s case list', async ({ page }) => {
  const clients = [
    { id: 'cl-1', fullName: 'Client Alice', email: 'alice@example.test' },
    { id: 'cl-2', fullName: 'Client Bob', email: 'bob@example.test' },
    { id: 'cl-3', fullName: 'Client Carol', email: 'carol@example.test' },
  ];
  const cases = [
    { id: 1, clientId: 'cl-1', name: 'Property dispute', cnr: '100001' },
    { id: 2, clientId: 'cl-2', name: 'Contract dispute', cnr: '100002' },
  ];
  const legacy = {
    id: 'INV-LEGACY', clientId: 'cl-1', clientName: 'Client Alice', caseName: 'Historical case',
    amount: 1000, status: 'Pending', dueDate: '2099-12-31',
  };
  const creates = [];
  const edits = [];

  await page.addInitScript(() => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'fa-1', role: 'firmadmin', firmId: 'firm-1' }));
    localStorage.setItem('access_token', 'firm-invoice-test-token');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/billing/clients') return route.fulfill({ json: clients });
    if (path === '/api/billing/cases') return route.fulfill({ json: cases });
    if (path === '/api/billing/invoices' && request.method() === 'POST') {
      const body = request.postDataJSON();
      creates.push(body);
      const selected = cases.find((item) => item.id === body.caseId);
      return route.fulfill({
        status: 201,
        json: { ...body, id: 'INV-NEW', caseName: selected.name, clientName: 'Client Alice' },
      });
    }
    if (path === '/api/billing/invoices') return route.fulfill({ json: [legacy] });
    if (path === '/api/billing/invoices/INV-LEGACY' && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      edits.push(body);
      return route.fulfill({ json: { ...legacy, ...body } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/#/firm/billing');
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create Invoice', exact: true }).click();
  const client = page.getByLabel(/^Client\s*\*/);
  const caseSelect = page.getByRole('combobox', { name: /^Case/ });
  await expect(caseSelect).toBeDisabled();
  await client.selectOption('cl-1');
  await expect(caseSelect.locator('option')).toHaveText(['Select a case', 'Property dispute · CNR 100001']);
  await caseSelect.selectOption('1');

  await client.selectOption('cl-2');
  await expect(caseSelect).toHaveValue('');
  await expect(caseSelect.locator('option')).toHaveText(['Select a case', 'Contract dispute · CNR 100002']);
  await client.selectOption('cl-3');
  await expect(caseSelect).toBeDisabled();
  await expect(caseSelect.locator('option')).toHaveText('No cases for this client');

  await client.selectOption('cl-1');
  await page.getByLabel(/^Amount/).fill('2000');
  await page.getByLabel(/^Due Date/).fill('2099-12-31');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Select a client and case, then enter the amount and due date.')).toBeVisible();
  expect(creates).toEqual([]);
  await caseSelect.selectOption('1');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'INV-NEW' })).toContainText('Property dispute');
  expect(creates).toEqual([{ clientId: 'cl-1', caseId: 1, amount: 2000, status: 'Pending', dueDate: '2099-12-31' }]);

  const legacyRow = page.getByRole('row').filter({ hasText: 'INV-LEGACY' });
  await legacyRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(caseSelect.locator('option').first()).toHaveText('Historical case (keep existing)');
  await page.getByLabel(/^Amount/).fill('1500');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(legacyRow).toContainText('1,500.00');
  await expect(legacyRow).toContainText('Historical case');
  expect(edits).toEqual([{ clientId: 'cl-1', amount: 1500, status: 'Pending', dueDate: '2099-12-31' }]);
});
