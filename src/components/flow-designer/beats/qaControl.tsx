import { useState } from 'react';
import { Icon } from '@iconify/react';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// The QA control screen. A QA-only beat (variant 'qa') that opens the flow in
// QA / dev builds. Real users never see it: it lives in the QA variant of the
// onboarding flow, tagged 'qa', so the production variant skips it.
//
// What it does: pick a test user from the dropdown, then choose how to enter
// the app. The four actions are the QA entry modes. This file is the DESIGN of
// the screen (presentation only, like every other beat in the builder). The app
// wires each action to real auth + reset behind these same labels.
//
// All copy is editable from props (set in the flow + the card sidebar):
// title, subtitle, users (comma separated), and the label/desc for each action.

interface ActionDef {
  key: string;
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

function QAControlScreen({
  title = 'QA Control',
  subtitle = 'Pick a test user, then choose how to start.',
  users = 'Yair,Alejandro,Yonas,Mintesnot,Timothy',
  loginLabel = 'Log in',
  loginDesc = 'Sign in and go to where this user left off.',
  restartLabel = 'Restart onboarding (fresh)',
  restartDesc = 'Delete this user data, keep the account, run onboarding from the top.',
  reonboardLabel = 'Re-run onboarding (keep data)',
  reonboardDesc = 'Go through onboarding again with the data already saved.',
  resetLabel = 'Reset data only',
  resetDesc = 'Wipe this user data, keep the account. No onboarding.',
}: Record<string, string | undefined>) {
  const userList = (users ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const [user, setUser] = useState(userList[0] ?? '');

  const actions: ActionDef[] = [
    { key: 'login', icon: 'ic:round-login', label: loginLabel!, desc: loginDesc!, tone: 'primary' },
    {
      key: 'restart',
      icon: 'ic:round-restart-alt',
      label: restartLabel!,
      desc: restartDesc!,
      tone: 'neutral',
    },
    {
      key: 'reonboard',
      icon: 'ic:round-replay',
      label: reonboardLabel!,
      desc: reonboardDesc!,
      tone: 'neutral',
    },
    {
      key: 'reset',
      icon: 'ic:round-cleaning-services',
      label: resetLabel!,
      desc: resetDesc!,
      tone: 'danger',
    },
  ];

  return (
    <div style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'rgb(15,23,42)',
            margin: '10px 0 0',
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'rgb(100,116,139)', margin: '4px 0 0' }}>
          {subtitle}
        </p>
      </div>

      {/* Test user dropdown */}
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
            value={user}
            onChange={(e) => setUser(e.target.value)}
            aria-label="Test user"
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
            {userList.map((u) => (
              <option key={u} value={u}>
                {u}
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

      {/* Entry-mode actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((a) => (
          <div
            key={a.key}
            role="button"
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              padding: '13px 14px',
              borderRadius: 14,
              border: '1px solid rgb(226,232,240)',
              background: '#fff',
              cursor: 'pointer',
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
              <Icon icon={a.icon} style={{ fontSize: 20, color: TONE[a.tone].icon }} />
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
          </div>
        ))}
      </div>
    </div>
  );
}

function QAControlBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'qa',
      speaker: 'coach',
      render: (
        <QAControlScreen
          title={props?.title}
          subtitle={props?.subtitle}
          users={props?.users}
          loginLabel={props?.loginLabel}
          loginDesc={props?.loginDesc}
          restartLabel={props?.restartLabel}
          restartDesc={props?.restartDesc}
          reonboardLabel={props?.reonboardLabel}
          reonboardDesc={props?.reonboardDesc}
          resetLabel={props?.resetLabel}
          resetDesc={props?.resetDesc}
        />
      ),
    },
  ];
  return <BeatPlayer steps={steps} />;
}

const qaControlBeat: BeatDef = {
  type: 'qa-control',
  group: 'QA',
  label: 'QA control',
  Comp: QAControlBeat,
};

export default qaControlBeat;
