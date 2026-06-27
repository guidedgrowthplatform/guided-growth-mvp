import type { StorybookConfig } from '@storybook/react-vite';

import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Resolve the absolute path of a package. Needed in monorepos / Yarn PnP.
 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  framework: getAbsolutePath('@storybook/react-vite'),
  // Serve the app's public/ so onboarding images (/images/onboarding/*) resolve.
  staticDirs: ['../public'],
};
export default config;
