import { expect, test } from '@playwright/test';

test('Firm admins can search for a case and link it when creating a task', async ({ page }) => {
  const cases = [
    { id: 4, cnr: '612559', case_type: 'Jolly Vs State', brief_description: 'General consultation request.' },
    { id: 5, cnr: '612560', case_type: 'Contract dispute', brief_description: 'Contract review.' },
  ];
  const tasks = [];

  await page.addInitScript(() => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'fa-3', role: 'firmadmin', firmId: 'firm-3' }));
    localStorage.setItem('access_token', 'firm-tasks-test-token');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/cases') {
      return route.fulfill({ json: url.searchParams.get('firmId') === 'firm-3' ? cases : [] });
    }
    if (url.pathname === '/api/tasks' && request.method() === 'POST') {
      const task = { ...request.postDataJSON(), id: 'TASK-NEW', status: 'Pending' };
      tasks.push(task);
      return route.fulfill({ status: 201, json: task });
    }
    return route.fulfill({ json: url.pathname === '/api/tasks' ? tasks : [] });
  });

  await page.goto('/#/firm/tasks');
  await page.getByRole('button', { name: 'New Task' }).click();
  const search = page.getByRole('searchbox', { name: 'Search cases' });
  const picker = page.getByRole('combobox', { name: /^Case/ });
  await expect(picker.locator('option')).toHaveCount(3);

  await page.getByLabel(/^Task Name/).fill('Prepare hearing notes');
  await page.getByLabel(/^Due Date/).fill('2099-12-31');
  await search.fill('unknown case');
  await expect(page.getByText('No cases match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect(page.getByText('Select a case.', { exact: true })).toBeVisible();
  expect(tasks).toHaveLength(0);

  await search.fill('612560');
  await expect(picker.locator('option')).toHaveText(['Select a case', 'Contract dispute · CNR 612560']);
  await search.fill('jolly');
  await expect(picker.locator('option')).toHaveText(['Select a case', 'Jolly Vs State · CNR 612559']);
  await picker.selectOption('4');
  await page.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Prepare hearing notes' })).toBeVisible();
  expect(tasks[0]).toMatchObject({ firmId: 'firm-3', caseId: '4', caseTitle: 'Jolly Vs State', caseCnr: '612559' });

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(picker).toHaveValue('4');
});
