import pool from '../db.js';
import { verifyCapability } from './coachBroker.js';

export type CoachHostHandoff = Readonly<{
  sessionId: string;
  capability: string;
  effectiveProfile: Record<string, unknown>;
}>;

export type CoachHostConnection = Readonly<{
  roomUrl: string;
  token: string;
}>;

export async function handoffCoachSessionToHost(
  handoff: CoachHostHandoff,
): Promise<CoachHostConnection> {
  if (process.env.COACH_COMPONENT_ENABLED !== 'true') throw new Error('coach_unavailable');
  const hostUrl = process.env.COACH_HOST_URL;
  if (!hostUrl) throw new Error('coach_host_unavailable');
  let response: Response;
  try {
    response = await fetch(new URL('/v1/coach-sessions', hostUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(handoff),
      signal: AbortSignal.timeout(Number(process.env.COACH_HOST_TIMEOUT_MS ?? 60_000)),
    });
  } catch {
    throw new Error('coach_host_unavailable');
  }
  if (!response.ok) throw new Error('coach_host_unavailable');
  const connection = (await response.json()) as Partial<CoachHostConnection>;
  if (typeof connection.roomUrl !== 'string' || typeof connection.token !== 'string')
    throw new Error('coach_host_invalid_response');
  return { roomUrl: connection.roomUrl, token: connection.token };
}

export async function endCoachSessionOnHost(sessionId: string): Promise<void> {
  const hostUrl = process.env.COACH_HOST_URL;
  const controlSecret = process.env.COACH_HOST_CONTROL_SECRET;
  if (!hostUrl || !controlSecret) return;
  try {
    await fetch(new URL(`/v1/coach-sessions/${encodeURIComponent(sessionId)}`, hostUrl), {
      method: 'DELETE',
      headers: { 'X-Coach-Host-Control': controlSecret },
      signal: AbortSignal.timeout(Number(process.env.COACH_HOST_TIMEOUT_MS ?? 15_000)),
    });
  } catch {
    // The host watchdog deletes its Daily room if a best-effort end call is unavailable.
  }
}

export async function failCoachSessionBeforeHostTeardown(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE coach_sessions
       SET state = 'failed', ended_at = now(), terminal_reason = 'host_handoff_failed'
     WHERE id = $1 AND state IN ('creating', 'spawning', 'active')`,
    [sessionId],
  );
}

export async function acknowledgeCoachHostActive(
  sessionId: string,
  capability: string,
): Promise<boolean> {
  const claims = verifyCapability(capability);
  if (!claims || claims.sessionId !== sessionId) return false;

  const result = await pool.query(
    `UPDATE coach_sessions
     SET state = 'active'
     WHERE id = $1 AND anon_id = $2 AND screen_id = $3 AND capability_jti = $4 AND state = 'spawning'`,
    [sessionId, claims.anonId, claims.screenId, claims.jti],
  );
  return result.rowCount === 1;
}
