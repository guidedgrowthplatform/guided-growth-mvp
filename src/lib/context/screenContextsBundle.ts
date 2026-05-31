/**
 * Static, build-time bundle of screen context blocks. Replaces the
 * per-navigation /api/context fetch with a sync local lookup so Vapi
 * onboarding does not wait on a network round-trip when navigating
 * between screens.
 *
 * Source: src/generated/screen_contexts.json (authored from the Master
 * Sheet's "Screens" tab, byte-identical to what `scripts/voice-sync/
 * seed_contexts.py` writes to Supabase). When the Sheet changes,
 * regenerate the JSON and rebuild.
 */
import type { ScreenRouteEntry } from '@/api/context';
import bundle from '@/generated/screen_contexts.json';
import type { ScreenContextBlock } from '@shared/types/context.js';

interface BundleScreen {
  screen_id: string;
  screen_name: string;
  route: string | null;
  context_block: string;
  content_hash: string;
  source?: string;
}

interface BundleShape {
  version: string;
  scope: string;
  screens: Record<string, BundleScreen>;
  routes: ScreenRouteEntry[];
}

const typedBundle = bundle as BundleShape;

// The seeded `screen_contexts` table tracks a numeric `version` that increments
// on each Sheet→DB resync. The bundle is a snapshot, so we derive a single
// numeric version from the bundle's YYYY-MM-DD stamp (e.g. "2026-05-20" → 20260520).
// All screens in a given bundle share this version.
const BUNDLE_NUMERIC_VERSION = Number(typedBundle.version.replace(/-/g, ''));

export function getBundledContextBlock(screenId: string): ScreenContextBlock | null {
  const screen = typedBundle.screens[screenId];
  if (!screen) return null;
  return {
    screen_id: screen.screen_id,
    context_block: screen.context_block,
    version: BUNDLE_NUMERIC_VERSION,
  };
}

export function getBundledRoutes(): ScreenRouteEntry[] {
  return typedBundle.routes;
}

export function getBundledScreenIds(): string[] {
  return Object.keys(typedBundle.screens);
}

export const BUNDLE_VERSION = typedBundle.version;
