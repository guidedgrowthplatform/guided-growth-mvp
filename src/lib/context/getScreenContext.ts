import type { QueryClient } from '@tanstack/react-query';
import { fetchScreenContextBlock, type ScreenContext } from '@/api/context';
import { getBundledContextBlock } from '@/lib/context/screenContextsBundle';
import { queryKeys } from '@/lib/query/keys';
import { useSessionLogStore } from '@/stores/sessionLogStore';

// 5 min stale time on the fallback fetch path (matches the server's 60s
// in-process cache + room for sheet sync settling). The fast path (bundle
// hit) never touches the network.
const BLOCK_STALE_TIME_MS = 5 * 60 * 1000;

// Imperative fetcher used by Vapi/Cartesia session starts and callLLM.
//
// Block: sync lookup in src/generated/screen_contexts.json. On miss (a
// screen not yet in the bundle — Phase 1 covers onboarding only), falls
// back to /api/context fetch. Vapi navigation between bundled screens
// has zero network latency.
//
// State delta: sync read from the local sessionLogStore (optimistic, includes
// in-flight pending writes). No /api/context/state round-trip on the
// hot path.
export async function getScreenContext(
  qc: QueryClient,
  screenId: string,
  sinceTs?: string | null,
): Promise<ScreenContext> {
  const bundled = getBundledContextBlock(screenId);
  const block = bundled
    ? bundled
    : await qc.fetchQuery({
        queryKey: queryKeys.context.block(screenId),
        queryFn: () => fetchScreenContextBlock(screenId),
        staleTime: BLOCK_STALE_TIME_MS,
      });

  if (!bundled && import.meta.env.DEV) {
    console.warn(
      `[screen-context] '${screenId}' not in bundle, fell back to /api/context. ` +
        'Add to src/generated/screen_contexts.json to eliminate the network hop.',
    );
  }

  const state_delta = useSessionLogStore.getState().getDeltaSince(sinceTs ?? null);

  return {
    screen_id: block.screen_id,
    context_block: block.context_block,
    version: block.version,
    state_delta,
  };
}
