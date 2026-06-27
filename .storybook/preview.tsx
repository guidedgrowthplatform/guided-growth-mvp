import React from 'react';
import type { Preview } from '@storybook/react-vite';

// Load the app's real Tailwind layer + design tokens so components render
// exactly as they do in the product.
import '../src/index.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' shows violations in the test UI only.
      test: 'todo',
    },
  },
  // Frame each card in a phone-width, page-background container so it reads in
  // context rather than floating on raw white. Full-screen stories (the Flow
  // Designer) opt out of the frame.
  decorators: [
    (Story, context) =>
      context.parameters.layout === 'fullscreen' ? (
        <Story />
      ) : (
        <div
          style={{
            fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, sans-serif',
            width: 360,
            maxWidth: '100%',
            padding: 24,
            background: '#f9f9f9',
            borderRadius: 24,
          }}
        >
          <Story />
        </div>
      ),
  ],
};

export default preview;
