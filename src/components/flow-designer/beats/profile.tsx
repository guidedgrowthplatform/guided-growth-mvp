import { useEffect, useState } from 'react';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// The profile beat, the worked example of the step model. Copy beats/_TEMPLATE.tsx
// to make a new one. Editable text comes from props (set in the flow + sidebar):
// greeting, askAge, askGender, userReply, age, gender.
function ProfileBeat(props?: Record<string, string>) {
  const propAge = props?.age && props.age !== '' ? Number(props.age) : 35;
  const propGender = props?.gender ?? 'Male';
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
      say: props?.greeting ?? 'Good to meet you, {name}. A couple of quick things.',
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
      say: props?.askGender ?? "And what's your gender?",
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
