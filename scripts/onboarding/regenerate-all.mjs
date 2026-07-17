/** Phase B aggregate generation seam; enabled when every projector is wired. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(await readFile(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
if (!packageJson.scripts['onboarding:generate']) {
  console.log('REGENERATE unavailable onboarding:generate is not registered');
  process.exitCode = 2;
} else {
  console.log('REGENERATE delegated to npm run onboarding:generate');
}
