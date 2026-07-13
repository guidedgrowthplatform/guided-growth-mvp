import { expect, test } from '@playwright/test';

test('walks the generated contract preview spine and exposes its declared clip', async ({
  page,
}) => {
  await page.goto('/onboarding/flow-preview');

  await expect(page.getByTestId('contract-provenance')).toContainText(
    'artifact 5ece2b0d2689b39d0b4981c9fe760a6fe30131058851a7b66f636ec4873e0fe9',
  );
  const splashPreview = page.getByTestId('preview-component-splash');
  await expect(splashPreview).toBeVisible();
  await expect(splashPreview).toContainText('Behavioral OS');

  for (const beat of [
    'get-started',
    'coach-greeting',
    'sign-up',
    'mic-permission',
    'profile-greeting',
    'profile-asks',
    'state-check',
    'checkin',
    'reflection',
    'fork',
  ]) {
    await page.getByTestId('continue-preview').click();
    await expect(page.getByTestId('current-beat')).toContainText(beat);
  }

  await expect(page.getByTestId('declared-clip')).toHaveAttribute(
    'src',
    /onboard_fork_form_1\.wav$/,
  );
  const clipResponse = await page.request.get('/voice/ob/onboard_fork_form_1.wav');
  expect(clipResponse.ok()).toBe(true);
  await page.getByTestId('choose-beginner').click();
  await expect(page.getByTestId('branch-choice')).toContainText('beginner');
  await page.getByTestId('choose-advanced').click();
  await expect(page.getByTestId('branch-choice')).toContainText('advanced');
  await page.screenshot({ path: 'test-results/flow-preview-pass.png', fullPage: true });
});
