import { waitUntil as vercelWaitUntil } from '@vercel/functions';

// On Vercel, waitUntil keeps the lambda alive until the promise settles.
// Self-hosted the process is long-lived, so fire-and-forget is equivalent —
// but @vercel/functions throws without Vercel's request context.
export function waitUntil(promise: Promise<unknown>): void {
  try {
    vercelWaitUntil(promise);
  } catch {
    void Promise.resolve(promise).catch((err) => {
      console.error('[waitUntil] background task failed:', err);
    });
  }
}
