import { useCallback } from 'react';

/**
 * MOCK STUB FOR AMIT / MINTESNOT
 *
 * This hook is prepared to log tap-heavy actions to the new `session_log` table
 * so the LLM state delta is updated without requiring an active voice session.
 *
 * TODO(@amit25): If you handle this purely server-side in the existing mutations,
 * we can delete this. If the frontend must explicitly call a new endpoint, wire it here.
 */
export function useSessionLog() {
  const logAction = useCallback(async (actionName: string, payload: unknown) => {
    // [MOCK]
    if (import.meta.env.DEV) {
      console.log(`[SessionLog] Captured '${actionName}' for LLM state delta:`, payload);
    }
    // await apiFetch('/api/session_log', { method: 'POST', body: JSON.stringify({ actionName, payload }) });
  }, []);

  return { logAction };
}
