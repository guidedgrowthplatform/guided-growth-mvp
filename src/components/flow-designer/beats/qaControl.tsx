import { useState } from 'react';
import { Icon } from '@iconify/react';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface FlowDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  fullyRunnable: boolean;
}

interface ActionDef {
  icon: string;
  label: string;
  desc: string;
  tone: 'primary' | 'neutral' | 'danger';
}

const FLOWS: FlowDef[] = [
  { id: 'full-onboarding', icon: 'ic:round-play-arrow', label: 'Full onboarding', desc: 'Fresh run from auth', fullyRunnable: true },
  { id: 'profile-start', icon: 'ic:round-person', label: 'Profile start', desc: 'Skip auth, start at profile beat', fullyRunnable: true },
  { id: 'mic-profile-start', icon: 'ic:round-mic', label: 'Mic + Profile', desc: 'Start at mic permission, then profile', fullyRunnable: true },
  { id: 'home-tour', icon: 'ic:round-home', label: 'Home tour', desc: 'Post-onboarding app tour', fullyRunnable: false },
  { id: 'morning-checkin', icon: 'ic:round-wb-sunny', label: 'Morning check-in', desc: '4-beat morning state-check flow', fullyRunnable: true },
  { id: 'evening-checkin', icon: 'ic:round-nights-stay', label: 'Evening check-in', desc: '5-beat evening flow', fullyRunnable: true },
];

const TONE: Record<ActionDef['tone'], { chip: string; icon: string }> = {
  primary: { chip: 'rgba(19,91,236,0.12)', icon: 'rgb(19,91,235)' },
  neutral: { chip: 'rgba(100,116,139,0.14)', icon: 'rgb(71,85,105)' },
  danger: { chip: 'rgba(220,38,38,0.12)', icon: 'rgb(220,38,38)' },
};

function QAControlScreen({ users = 'Fable,Mintesnot,Yair,Alejandro,Yonas,Timothy' }: Record<string, string | undefined>) {
  const userList = (users ?? '')
    .split(',')
    .map((user) => user.trim())
    .filter(Boolean);
  const [user, setUser] = useState(userList[0] ?? '');
  const [flowId, setFlowId] = useState(FLOWS[0].id);
  const selectedFlow = FLOWS.find((flow) => flow.id === flowId) ?? FLOWS[0];

  const actions: ActionDef[] = [
    { icon: 'ic:round-login', label: 'Log in', desc: 'Sign in and go to where this user left off.', tone: 'primary' },
    { icon: 'ic:round-restart-alt', label: 'Restart onboarding (fresh)', desc: 'Delete this user data, keep the account, run full onboarding from the top.', tone: 'neutral' },
    { icon: 'ic:round-replay', label: 'Replay flow (preview)', desc: 'Walk the full flow again in preview mode. Saved data untouched (and not loaded).', tone: 'neutral' },
    { icon: 'ic:round-cleaning-services', label: 'Reset data only', desc: 'Wipe this user data, keep the account. You stay on this screen.', tone: 'danger' },
  ];

  return (
    <div style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgb(220,38,38)', background: 'rgba(220,38,38,0.10)', padding: '3px 8px', borderRadius: 999 }}>
          QA only
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgb(15,23,42)', margin: '8px 0 0' }}>
          QA Control
        </h1>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'rgb(100,116,139)', margin: '3px 0 0' }}>
          Pick a test user, then tap a flow to start it fresh.
        </p>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgb(100,116,139)' }}>
          Test user
        </span>
        <div style={{ position: 'relative' }}>
          <select value={user} onChange={(event) => setUser(event.target.value)} aria-label="Test user" style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: 'rgb(15,23,42)', background: '#fff', border: '1px solid rgb(226,232,240)', borderRadius: 12, padding: '12px 40px 12px 14px', cursor: 'pointer' }}>
            {userList.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <Icon icon="ic:round-keyboard-arrow-down" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 22, color: 'rgb(100,116,139)', pointerEvents: 'none' }} />
        </div>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgb(100,116,139)' }}>
          Start a flow
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {FLOWS.map((flow) => {
            const isSelected = flow.id === selectedFlow.id;
            return (
              <button key={flow.id} type="button" onClick={() => setFlowId(flow.id)} title={flow.desc} aria-label={`Start ${flow.label} fresh`} aria-pressed={isSelected} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 4px', borderRadius: 14, border: isSelected ? '2px solid rgb(19,91,235)' : '2px solid rgb(226,232,240)', background: isSelected ? 'rgba(19,91,236,0.06)' : '#fff', cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s' }}>
                <Icon icon={flow.icon} style={{ fontSize: 22, color: isSelected ? 'rgb(19,91,235)' : 'rgb(71,85,105)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? 'rgb(19,91,235)' : 'rgb(71,85,105)', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{flow.label}</span>
                {!flow.fullyRunnable && <span style={{ fontSize: 8, fontWeight: 700, color: 'rgb(234,88,12)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>partial</span>}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, fontWeight: 500, color: 'rgb(100,116,139)', margin: 0, minHeight: 16 }}>
          {selectedFlow.desc}
          {!selectedFlow.fullyRunnable && <span style={{ color: 'rgb(234,88,12)', marginLeft: 4 }}>(adapter not yet in engine registry)</span>}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {actions.map((action) => (
          <button key={action.label} type="button" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: '1px solid rgb(226,232,240)', background: '#fff', cursor: 'pointer' }}>
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, background: TONE[action.tone].chip, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={action.icon} style={{ fontSize: 20, color: TONE[action.tone].icon }} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'rgb(15,23,42)', lineHeight: 1.2 }}>{action.label}</span>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgb(100,116,139)', lineHeight: 1.35, marginTop: 2 }}>{action.desc}</span>
            </span>
            <Icon icon="ic:round-chevron-right" style={{ flexShrink: 0, fontSize: 20, color: 'rgb(148,163,184)' }} />
          </button>
        ))}
      </div>

      <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: '1px dashed rgb(191,219,254)', background: 'rgb(239,246,255)', cursor: 'pointer' }}>
        <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, background: 'rgb(219,234,254)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon="logos:google-calendar" style={{ fontSize: 18 }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'rgb(15,23,42)', lineHeight: 1.2 }}>Calendar Sync (QA)</span>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgb(100,116,139)', lineHeight: 1.35, marginTop: 2 }}>Signs you in as this user, then connect &amp; sync</span>
        </span>
        <Icon icon="ic:round-chevron-right" style={{ flexShrink: 0, fontSize: 20, color: 'rgb(148,163,184)' }} />
      </button>
    </div>
  );
}

function QAControlBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [{ id: 'qa', speaker: 'coach', render: <QAControlScreen users={props?.users} /> }];
  return <BeatPlayer steps={steps} />;
}

const qaControlBeat: BeatDef = { type: 'qa-control', group: 'QA', label: 'QA control', Comp: QAControlBeat };

export default qaControlBeat;
