import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { FONT, PRIMARY } from './_beatStyle';

// This is the first beat where the user actually answers, so the "you can now
// talk" affordance lives here: a hollow bordered pill under the gender chips,
// mic icon and a breathing dot, telling the user they can answer by voice or tap.
// Exported so the state-check beat can reuse the exact same reminder under its
// cards (the state-check is still early, so the nudge repeats once there).
export function VoiceOpenHint() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 20px',
          borderRadius: 999,
          background: 'transparent',
          border: `1.5px solid ${PRIMARY}`,
          color: PRIMARY,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <Icon icon="mdi:microphone" width={18} height={18} style={{ color: PRIMARY }} />
        You can now talk. Answer by voice, or tap.
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: PRIMARY,
            animation: 'ggMicPulse 1.8s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`@keyframes ggMicPulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  );
}

// The profile beat, the worked example of the step model. Copy beats/_TEMPLATE.tsx
// to make a new one. Editable text comes from props (set in the flow + sidebar):
// greeting, askAge, askGender, userReply, age, gender.
function ProfileBeat(props?: Record<string, string>) {
  // No default age: the picker starts unselected ("Select your age") and the user
  // has to choose. Only a prop-provided age pre-fills it.
  const propAge: number | '' = props?.age && props.age !== '' ? Number(props.age) : '';
  const propGender = props?.gender ?? null;
  const [age, setAge] = useState<number | ''>(propAge);
  const [gender, setGender] = useState<string | null>(propGender);
  useEffect(() => {
    setAge(propAge);
  }, [propAge]);
  useEffect(() => {
    setGender(propGender);
  }, [propGender]);

  const steps: BeatStep[] = [
    {
      id: 'greet',
      speaker: 'coach',
      // {name} is substituted at runtime from the sign-up auth profile (Cartesia speaks it).
      // The real copy comes from beatContexts.ts; this is a placeholder that keeps the name.
      say: props?.greeting ?? 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
    },
    {
      id: 'age',
      speaker: 'coach',
      say: props?.askAge ?? 'How old are you?',
      render: <AgeScrollPicker key={propAge} value={age} onChange={setAge} />,
    },
    {
      id: 'gender',
      speaker: 'coach',
      say: props?.askGender ?? "What's your gender?",
      render: (
        <ChipSelect
          options={['Male', 'Female', 'Other']}
          value={gender}
          onChange={setGender}
          ariaLabel="Gender"
          columns={3}
        />
      ),
    },
    { id: 'voice-hint', speaker: 'coach', render: <VoiceOpenHint /> },
    { id: 'reply', speaker: 'user', say: props?.userReply ?? "I'm 35, and I'm male." },
  ];

  return <BeatPlayer steps={steps} />;
}

const profileBeat: BeatDef = {
  type: 'profile-beat',
  group: 'Onboarding',
  label: 'Profile (age + gender)',
  Comp: ProfileBeat,
};

export default profileBeat;
