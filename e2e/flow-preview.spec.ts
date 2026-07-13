import { expect, test } from '@playwright/test';

test('renders contract beats as real onboarding screens', async ({ page }) => {
  await page.goto('/onboarding/flow-preview');

  await expect(page.getByTestId('contract-provenance')).toContainText('artifact');
  await expect(page.getByTestId('real-onboarding-splash')).toContainText('Guided Growth');
  await expect(page.getByText('This component is present in the onboarding contract.')).toHaveCount(
    0,
  );

  await page.getByLabel('Preview beat').selectOption('coach-greeting');
  await expect(page.getByTestId('real-onboarding-splash-intro')).toBeVisible();
  await expect(page.getByTestId('real-onboarding-splash-intro')).toContainText(
    'GUIDED GROWTH COACH',
  );

  await page.getByLabel('Preview beat').selectOption('category');
  await expect(page.getByTestId('real-onboarding-category-grid')).toBeVisible();
  await expect(page.getByTestId('real-onboarding-category-grid')).toContainText('Sleep better');
  await expect(page.getByTestId('real-onboarding-category-grid')).toContainText('Move more');
});
