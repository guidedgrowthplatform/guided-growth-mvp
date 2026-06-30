import { useState } from 'react';
import { FONT, PRIMARY, SUBTLE, BORDER, CARD, SECTION_LABEL, SPACE } from './_beatStyle';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { Button } from '@/components/ui/Button';
import { type BeatDef } from '../beatKit';

function AuthSignup() {
  const [mode, setMode] = useState<'default' | 'signup' | 'login'>('default');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  return (
    <div style={{ fontFamily: FONT, gap: SPACE.lg }} className="flex flex-col">
      {/* Heading */}
      <div
        style={{ color: PRIMARY, fontFamily: FONT }}
        className="text-[26px] font-extrabold tracking-tight leading-tight"
      >
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </div>

      {/* Social sign-in */}
      <div style={{ gap: SPACE.md }} className="flex flex-col">
        <Button variant="social-dark" size="auth" fullWidth>
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Continue with Apple
        </Button>
        <Button variant="social-light" size="auth" fullWidth>
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </div>

      {/* Email form: signup */}
      {mode === 'signup' && (
        <div style={{ ...CARD, padding: SPACE.lg, gap: SPACE.md }} className="flex flex-col">
          {/* Divider label */}
          <div style={{ gap: SPACE.sm }} className="flex items-center">
            <span style={{ flex: 1, height: 1, background: BORDER }} />
            <span style={{ ...SECTION_LABEL }}>sign up with email</span>
            <span style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <OnboardingInput
            icon="mdi:account-outline"
            placeholder="First name"
            value={first}
            onChange={setFirst}
          />
          <OnboardingInput
            icon="mdi:account-outline"
            placeholder="Last name"
            value={last}
            onChange={setLast}
          />
          <OnboardingInput
            icon="mdi:email-outline"
            placeholder="Email"
            value={email}
            onChange={setEmail}
          />
          <OnboardingInput
            icon="mdi:lock-outline"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          <Button variant="primary" size="auth" fullWidth>
            Create account
          </Button>
        </div>
      )}

      {/* Email form: login */}
      {mode === 'login' && (
        <div style={{ ...CARD, padding: SPACE.lg, gap: SPACE.md }} className="flex flex-col">
          {/* Divider label */}
          <div style={{ gap: SPACE.sm }} className="flex items-center">
            <span style={{ flex: 1, height: 1, background: BORDER }} />
            <span style={{ ...SECTION_LABEL }}>log in with email</span>
            <span style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <OnboardingInput
            icon="mdi:email-outline"
            placeholder="Email"
            value={email}
            onChange={setEmail}
          />
          <OnboardingInput
            icon="mdi:lock-outline"
            placeholder="Password"
            value={pw}
            onChange={setPw}
          />
          <Button variant="primary" size="auth" fullWidth>
            Log in
          </Button>
        </div>
      )}

      {/* Email CTA (default mode) */}
      {mode === 'default' && (
        <Button variant="primary" size="auth" fullWidth onClick={() => setMode('signup')}>
          Sign up with email
        </Button>
      )}

      {/* Mode toggle */}
      <div style={{ textAlign: 'center', fontSize: 13, fontFamily: FONT, color: SUBTLE }}>
        {mode === 'login' ? (
          <>
            New here?{' '}
            <button
              type="button"
              onClick={() => setMode('signup')}
              style={{ color: PRIMARY, fontWeight: 700, fontFamily: FONT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              style={{ color: PRIMARY, fontWeight: 700, fontFamily: FONT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Log in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const authSignupBeat: BeatDef = {
  type: 'auth-signup',
  group: 'Auth',
  label: 'Sign up (Apple / Google / email)',
  Comp: AuthSignup,
};

export default authSignupBeat;
