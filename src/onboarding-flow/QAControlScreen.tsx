import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

/**
 * QA Control screen -- the functional twin of the `qa-control` beat designed in
 * the flow builder. A QA-only launcher: pick a test user, pick a flow to run, then
 * choose how to enter the app. Gated to a flag-protected route (see src/routes/index.tsx),
 * so real users never reach it.
 *
 * Layout (one phone screen, no scroll):
 *   1. Header (QA badge + title)
 *   2. Test user picker (select)
 *   3. "Start a flow" grid (5 square buttons)
 *   4. Account-state action buttons (log in / restart / re-onboard / reset)
 *   5. Error line
 *
 * Each test account is a dedicated `qa-onboarding-*@guidedgrowth.test` user. They
 * share one embedded password so testers just pick a user and go.
 */

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface QaUser {
  email: string;
  label: string;
  onboarded?: boolean;
}

const FALLBACK_USERS: QaUser[] = [
  { label: 'Yair', email: 'qa-onboarding-yair@guidedgrowth.test' },
  { label: 'Alejandro', email: 'qa-onboarding-alejandro@guidedgrowth.test' },
  { label: 'Yonas', email: 'qa-onboarding-yonas@guidedgrowth.test' },
  { label: 'Mintesnot', email: 'qa-onboarding-mintesnot@guidedgrowth.test' },
  { label: 'Timothy', email: 'qa-onboarding-timothy@guidedgrowth.test' },
];

// Shared password for the QA test accounts. Embedded on purpose: these are
// throwaway qa-onboarding-*@guidedgrowth.test accounts with no real data, behind
// a QA-only gated route, so testers pick a user and go with no entry. The
// create-test-users script seeds the accounts with this exact value.
const QA_PASSWORD = 'guided-growth-qa-2026';

// ---------------------------------------------------------------------------
// Flow picker config
// ---------------------------------------------------------------------------

type FlowId = 'full-onboarding' | 'profile-start' | 'home-tour' | 'morning-checkin' | 'evening-checkin';

interface FlowDef {
  id: FlowId;
  icon: string;
  label: string;
  desc: string;
  /** Call to navigate to the flow's route. Receives the react-router navigate fn. */
  navigate: (nav: ReturnType<typeof useNavigate>) => void;
  /**
   * true when the flow renders completely through the engine today.
   * false when components are missing from componentRegistry.tsx and the flow
   * will render an empty or fallback beat for those nodes.
   */
  fullyRunnable: boolean;
}

const FLOWS: FlowDef[] = [
  {
    id: 'full-onboarding',
    icon: 'ic:round-play-arrow',
    label: 'Full onboarding',
    desc: 'From auth (beat 0)',
    // Navigate directly to /onboarding/flow, bypassing OnboardingEntry so the
    // QA path is never affected by the VITE_ONBOARDING_USE_ENGINE flag.
    navigate: (nav) => nav('/onboarding/flow', { replace: true }),
    fullyRunnable: true,
  },
  {
    id: 'profile-start',
    icon: 'ic:round-person',
    label: 'Profile start',
    desc: 'Skip auth, start at profile beat',
    // ?startAt=profile seeds the orchestrator at the profile node (id='profile'
    // in onboarding-beginner-v1.ts:84). The user must already be signed in,
    // which ensureSignedIn in run() handles before this navigation fires.
    navigate: (nav) => nav('/onboarding/flow?startAt=profile', { replace: true }),
    fullyRunnable: true,
  },
  {
    id: 'home-tour',
    icon: 'ic:round-home',
    label: 'Home tour',
    desc: 'Post-onboarding app tour',
    // Routes to /flow-preview/home-tour but the 'home-tour' componentType is NOT
    // registered in src/onboarding-flow/renderer/componentRegistry.tsx. The engine
    // renderer will hit the default/fallback case for each beat. This flow is
    // deferred to the app-shell workstream (HANDOFF-app-shell-and-flow-order.md).
    // The route and button are wired correctly; the adapter is what is missing.
    navigate: (nav) => nav('/flow-preview/home-tour', { replace: true }),
    fullyRunnable: false,
  },
  {
    id: 'morning-checkin',
    icon: 'ic:round-wb-sunny',
    label: 'Morning check-in',
    desc: '4-beat morning state-check flow',
    navigate: (nav) => nav('/flow-preview/morning-checkin', { replace: true }),
    fullyRunnable: true,
  },
  {
    id: 'evening-checkin',
    icon: 'ic:round-nights-stay',
    label: 'Evening check-in',
    desc: '5-beat evening flow',
    navigate: (nav) => nav('/flow-preview/evening-checkin', { replace: true }),
    fullyRunnable: true,
  },
];

// ---------------------------------------------------------------------------
// Account-state actions
// ---------------------------------------------------------------------------

type ActionKey = 'login' | 'restart' | 'reonboard' | 'reset';

interface ActionDef {
  key: ActionKey;
  icon: string;
  label: string;
  desc: string;
  tone: 'primary' | 'neutral' | 'danger';
}

const TONE: Record<ActionDef['tone'], { chip: string; icon: string }> = {
  primary: { chip: 'rgba(19,91,236,0.12)', icon: 'rgb(19,91,235)' },
  neutral: { chip: 'rgba(100,116,139,0.14)', icon: 'rgb(71,85,105)' },
  danger: { chip: 'rgba(220,38,38,0.12)', icon: 'rgb(220,38,38)' },
};

const ACTIONS: ActionDef[] = [
  {
    key: 'login',
    icon: 'ic:round-login',
    label: 'Log in',
    desc: 'Sign in and go to where this user left off.',
    tone: 'primary',
  },
  {
    key: 'restart',
    icon: 'ic:round-restart-alt',
    label: 'Restart onboarding (fresh)',
    desc: 'Delete this user data, keep the account, run onboarding from the top.',
    tone: 'neutral',
  },
  {
    key: 'reonboard',
    icon: 'ic:round-replay',
    label: 'Re-run onboarding (keep data)',
    desc: 'Go through onboarding again with the data already saved.',
    tone: 'neutral',
  },
  {
    key: 'reset',
    icon: 'ic:round-cleaning-services',
    label: 'Reset data only',
    desc: 'Wipe this user data, keep the account. No onboarding.',
    tone: 'danger',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QAControlScreen() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [users, setUsers] = useState<QaUser[]>(FALLBACK_USERS);
  const [email, setEmail] = useState(FALLBACK_USERS[0]?.email ?? '');
  const [flowId, setFlowId] = useState<FlowId>('full-onboarding');
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull the live list of QA accounts from Supabase so the dropdown reflects the
  // real accounts (and shows who already has data). Falls back to the static list.
  useEffect(() => {
    let alive = true;
    fetch('/api/qa/users')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { users?: { email: string; name: string; onboarded?: boolean }[] } | null) => {
        if (!alive || !d?.users?.length) return;
        const live = d.users.map((u) => ({
          email: u.email,
          label: u.name,
          onboarded: u.onboarded,
        }));
        setUsers(live);
        setEmail(live[0].email);
      })
      .catch(() => {
        /* keep the fallback list */
      });
    return () => {
      alive = false;
    };
  }, []);

  async function ensureSignedIn() {
    const { error: signInError } = await signIn(email, QA_PASSWORD);
    if (signInError) throw new Error(signInError);
  }

  async function selfReset() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('No session after sign-in.');
    const res = await fetch('/api/qa/self-reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Reset failed (${res.status})`);
    }
  }

  const selectedFlow = FLOWS.find((f) => f.id === flowId) ?? FLOWS[0];

  async function run(action: ActionKey) {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      await ensureSignedIn();
      if (action === 'restart') {
        await selfReset();
        // Use the selected flow's navigate function so the tester lands in the
        // correct flow after a fresh reset, not just on /onboarding.
        selectedFlow.navigate(navigate);
      } else if (action === 'reonboard') {
        selectedFlow.navigate(navigate);
      } else if (action === 'reset') {
        // Reset data only: wipe and go home, regardless of flow selection.
        await selfReset();
        navigate('/', { replace: true });
      } else {
        // login: navigate to the selected flow.
        selectedFlow.navigate(navigate);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        fontFamily: FONT,
        minHeight: '100dvh',
        background: '#f1f5f9',
        display: 'flex',
        justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignSelf: 'center',
        }}
      >
        {/* Header */}
        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgb(220,38,38)',
              background: 'rgba(220,38,38,0.10)',
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            QA only
          </span>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'rgb(15,23,42)',
              margin: '8px 0 0',
            }}
          >
            QA Control
          </h1>
          <p
            style={{ fontSize: 13, fontWeight: 500, color: 'rgb(100,116,139)', margin: '3px 0 0' }}
          >
            Pick a test user and a flow, then choose how to start.
          </p>
        </div>

        {/* Test user picker */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgb(100,116,139)',
            }}
          >
            Test user
          </span>
          <div style={{ position: 'relative' }}>
            <select
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Test user"
              disabled={busy !== null}
              style={{
                width: '100%',
                appearance: 'none',
                WebkitAppearance: 'none',
                fontFamily: FONT,
                fontSize: 15,
                fontWeight: 600,
                color: 'rgb(15,23,42)',
                background: '#fff',
                border: '1px solid rgb(226,232,240)',
                borderRadius: 12,
                padding: '12px 40px 12px 14px',
                cursor: 'pointer',
              }}
            >
              {users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.label}
                  {u.onboarded === undefined ? '' : u.onboarded ? '  ·  onboarded' : '  ·  fresh'}
                </option>
              ))}
            </select>
            <Icon
              icon="ic:round-keyboard-arrow-down"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 22,
                color: 'rgb(100,116,139)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </label>

        {/* Flow picker grid (5 square buttons) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgb(100,116,139)',
            }}
          >
            Start a flow
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
            }}
          >
            {FLOWS.map((f) => {
              const isSelected = flowId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFlowId(f.id)}
                  disabled={busy !== null}
                  title={f.desc}
                  aria-label={f.label}
                  aria-pressed={isSelected}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '10px 4px',
                    borderRadius: 14,
                    border: isSelected
                      ? '2px solid rgb(19,91,235)'
                      : '2px solid rgb(226,232,240)',
                    background: isSelected ? 'rgba(19,91,236,0.06)' : '#fff',
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                >
                  <Icon
                    icon={f.icon}
                    style={{
                      fontSize: 22,
                      color: isSelected ? 'rgb(19,91,235)' : 'rgb(71,85,105)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isSelected ? 'rgb(19,91,235)' : 'rgb(71,85,105)',
                      textAlign: 'center',
                      lineHeight: 1.2,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {f.label}
                  </span>
                  {/* Warn that home-tour cannot run yet */}
                  {!f.fullyRunnable && (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: 'rgb(234,88,12)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      partial
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: 'rgb(100,116,139)',
              margin: 0,
              minHeight: 16,
            }}
          >
            {selectedFlow.desc}
            {!selectedFlow.fullyRunnable && (
              <span style={{ color: 'rgb(234,88,12)', marginLeft: 4 }}>
                (adapter not yet in engine registry)
              </span>
            )}
          </p>
        </div>

        {/* Account-state action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {ACTIONS.map((a) => {
            const isBusy = busy === a.key;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => run(a.key)}
                disabled={busy !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: '1px solid rgb(226,232,240)',
                  background: '#fff',
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy && !isBusy ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    background: TONE[a.tone].chip,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    icon={isBusy ? 'svg-spinners:ring-resize' : a.icon}
                    style={{ fontSize: 20, color: TONE[a.tone].icon }}
                  />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'rgb(15,23,42)',
                      lineHeight: 1.2,
                    }}
                  >
                    {a.label}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgb(100,116,139)',
                      lineHeight: 1.35,
                      marginTop: 2,
                    }}
                  >
                    {a.desc}
                  </span>
                </span>
                <Icon
                  icon="ic:round-chevron-right"
                  style={{ flexShrink: 0, fontSize: 20, color: 'rgb(148,163,184)' }}
                />
              </button>
            );
          })}
        </div>

        {error && (
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'rgb(220,38,38)', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default QAControlScreen;
