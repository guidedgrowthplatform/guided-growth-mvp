import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

/**
 * QA Control screen — the functional twin of the `qa-control` beat designed in
 * the flow builder. A QA-only launcher: pick a test user, then choose how to
 * enter the app. Gated to a flag-protected route (see src/routes/index.tsx), so
 * real users never reach it.
 *
 * Each test account is a dedicated `qa-onboarding-*@guidedgrowth.test` user (one
 * per tester). They share one password, read from VITE_QA_PASSWORD (QA builds
 * only). The reset/restart actions call /api/qa/self-reset, which wipes the
 * authed QA user's data but keeps the account. "Re-run (keep data)" drops into
 * the flow without wiping; the engine seeding it from saved data is a follow-up.
 */

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface QaUser {
  email: string;
  label: string;
  onboarded?: boolean;
}

// Fallback list used until /api/qa/users responds (the live list of real
// qa-onboarding-* accounts from Supabase). Keeps the screen usable offline or
// before the endpoint deploys.
const FALLBACK_USERS: QaUser[] = [
  { label: 'Yair', email: 'qa-onboarding-yair@guidedgrowth.test' },
  { label: 'Alejandro', email: 'qa-onboarding-alejandro@guidedgrowth.test' },
  { label: 'Yonas', email: 'qa-onboarding-yonas@guidedgrowth.test' },
  { label: 'Mintesnot', email: 'qa-onboarding-mintesnot@guidedgrowth.test' },
  { label: 'Timothy', email: 'qa-onboarding-timothy@guidedgrowth.test' },
];

const QA_PASSWORD = import.meta.env.VITE_QA_PASSWORD as string | undefined;

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

export function QAControlScreen() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [users, setUsers] = useState<QaUser[]>(FALLBACK_USERS);
  const [email, setEmail] = useState(FALLBACK_USERS[0]?.email ?? '');
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
    if (!QA_PASSWORD) throw new Error('VITE_QA_PASSWORD is not set in this build.');
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

  async function run(action: ActionKey) {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      await ensureSignedIn();
      if (action === 'restart') {
        await selfReset();
        navigate('/onboarding/flow', { replace: true });
      } else if (action === 'reonboard') {
        navigate('/onboarding/flow', { replace: true });
      } else if (action === 'reset') {
        await selfReset();
        navigate('/', { replace: true });
      } else {
        // login: land wherever the user's state routes (OnboardingEntry decides).
        navigate('/onboarding', { replace: true });
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
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          alignSelf: 'center',
        }}
      >
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
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'rgb(15,23,42)',
              margin: '10px 0 0',
            }}
          >
            QA Control
          </h1>
          <p
            style={{ fontSize: 14, fontWeight: 500, color: 'rgb(100,116,139)', margin: '4px 0 0' }}
          >
            Pick a test user, then choose how to start.
          </p>
        </div>

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
                padding: '13px 40px 13px 14px',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  padding: '13px 14px',
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
                    width: 38,
                    height: 38,
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
                      fontSize: 15,
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
                      fontSize: 12.5,
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

        {!QA_PASSWORD && (
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'rgb(202,138,4)', margin: 0 }}>
            Set VITE_QA_PASSWORD in this build to enable sign-in.
          </p>
        )}
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
