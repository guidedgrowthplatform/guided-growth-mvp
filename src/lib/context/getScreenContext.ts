import type { QueryClient } from '@tanstack/react-query';
import { fetchScreenContextBlock, fetchSessionStateDelta, type ScreenContext } from '@/api/context';
import { queryKeys } from '@/lib/query/keys';

// Context blocks change only on sheet→DB resync. 5 min on the client matches
// the server's 60s in-process cache + room for sheet sync settling.
const BLOCK_STALE_TIME_MS = 5 * 60 * 1000;

// Imperative fetcher used by Vapi/Cartesia session starts and callLLM. Block
// goes through TanStack so repeated callers reuse the cached copy; delta is a
// direct fetch each time because session_log advances continuously.
export async function getScreenContext(
  qc: QueryClient,
  screenId: string,
  sinceTs?: string | null,
): Promise<ScreenContext> {
  const [block, deltaRes] = await Promise.all([
    qc.fetchQuery({
      queryKey: queryKeys.context.block(screenId),
      queryFn: () => fetchScreenContextBlock(screenId),
      staleTime: BLOCK_STALE_TIME_MS,
    }),
    sinceTs ? fetchSessionStateDelta(sinceTs) : Promise.resolve({ state_delta: [] }),
  ]);

  return {
    screen_id: block.screen_id,
    context_block: block.context_block,
    version: block.version,
    state_delta: deltaRes.state_delta,
  };
}
