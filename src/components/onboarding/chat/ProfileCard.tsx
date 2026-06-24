import { useEffect, useRef, useState } from 'react';
import { AgeScrollPicker } from '@/components/onboarding/AgeScrollPicker';
import { OnboardingInput } from '@/components/onboarding/OnboardingInput';
import { Button } from '@/components/ui/Button';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { ProfileCardData } from '@/lib/onboarding/onboardingChatTypes';
import type { OnboardingCardApi } from './onboardingCardRegistry';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const REFERRAL_OPTIONS = ['Founder Invite', 'Webinar', 'Friend', 'Other'];

// Mirrors api/_lib/llm/onboarding/handlers/shared.ts NICKNAME_REGEX.
const NICKNAME_REGEX = /^[\p{L}\p{M}0-9 '\-_.]*$/u;
const NICKNAME_MAX_LEN = 50;
const NICKNAME_HINT = "Letters, numbers, spaces, ' - _ . only";

// Picker visually centers on AGE_VALUES[0] = 13; seed local state to match.
const AGE_DEFAULT = 13;

interface ProfileCardProps {
  data: ProfileCardData;
  api: OnboardingCardApi;
}

type TouchedKey = 'nickname' | 'age' | 'gender' | 'referralSource';

// Referral is a plain chip select (like gender): map a stored value to its
// canonical option (case-insensitive, e.g. coach-submitted "founder invite" →
// "Founder Invite"); anything unrecognized leaves nothing selected.
function canonicalReferral(stored: string | undefined): string | null {
  if (!stored) return null;
  const norm = stored.startsWith('Other: ') ? 'Other' : stored;
  return REFERRAL_OPTIONS.find((o) => o.toLowerCase() === norm.toLowerCase()) ?? null;
}

// Beat 1 — Profile. Reads pre-fill from LIVE onboarding state (card.data is
// frozen at opener-seed time); bidirectional self-heal for untouched fields so
// mid-flow voice/typed corrections (e.g. pronunciation) flow into the card.
export function ProfileCard({ data, api }: ProfileCardProps) {
  const { state } = useOnboarding();
  const liveData = state?.data;

  const [nickname, setNickname] = useState(
    (liveData?.nickname as string | undefined) ?? data.nickname ?? '',
  );
  const [age, setAge] = useState<number>(
    (liveData?.age as number | undefined) ?? data.age ?? AGE_DEFAULT,
  );
  const [gender, setGender] = useState<string | null>(
    (liveData?.gender as string | undefined) ?? data.gender ?? null,
  );
  const [referralSource, setReferralSource] = useState<string | null>(
    canonicalReferral((liveData?.referralSource as string | undefined) ?? data.referralSource),
  );

  const touchedRef = useRef<Record<TouchedKey, boolean>>({
    nickname: false,
    age: false,
    gender: false,
    referralSource: false,
  });
  const markTouched = (k: TouchedKey) => {
    touchedRef.current[k] = true;
  };

  // Bidirectional self-heal: live state wins for untouched fields, user input
  // wins for touched ones. Mirrors coach-driven mid-flow corrections.
  useEffect(() => {
    if (!touchedRef.current.nickname && typeof liveData?.nickname === 'string') {
      setNickname(liveData.nickname);
    }
    if (!touchedRef.current.age && typeof liveData?.age === 'number') {
      setAge(liveData.age);
    }
    if (!touchedRef.current.gender && typeof liveData?.gender === 'string') {
      setGender(liveData.gender);
    }
    if (!touchedRef.current.referralSource) {
      const stored = liveData?.referralSource as string | undefined;
      const canonical = canonicalReferral(stored);
      if (canonical) setReferralSource(canonical);
    }
  }, [liveData?.nickname, liveData?.age, liveData?.gender, liveData?.referralSource]);

  const trimmedNickname = nickname.trim();
  const nicknameValid =
    trimmedNickname.length > 0 &&
    trimmedNickname.length <= NICKNAME_MAX_LEN &&
    NICKNAME_REGEX.test(trimmedNickname);
  const showNicknameHint = nickname.length > 0 && !nicknameValid;

  const canSubmit = nicknameValid && gender !== null;

  const handleNicknameChange = (v: string) => {
    markTouched('nickname');
    setNickname(v);
  };
  const handleAgeChange = (v: number) => {
    markTouched('age');
    setAge(v);
  };
  const handleGenderChange = (v: string | null) => {
    markTouched('gender');
    setGender(v);
  };
  const handleReferralChange = (v: string | null) => {
    markTouched('referralSource');
    setReferralSource(v);
  };

  const handleConfirm = () => {
    if (!canSubmit) return;
    api.submitProfile({
      nickname: trimmedNickname,
      age,
      gender: gender ?? undefined,
      referralSource: referralSource ?? undefined,
    });
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <OnboardingInput
        icon="mdi:account-outline"
        placeholder="What should I call you?"
        value={nickname}
        onChange={handleNicknameChange}
      />
      {showNicknameHint && <p className="text-[12px] text-content-tertiary">{NICKNAME_HINT}</p>}
      <AgeScrollPicker value={age} onChange={handleAgeChange} />
      <ChipSelect
        options={GENDER_OPTIONS}
        value={gender}
        onChange={handleGenderChange}
        columns={3}
        ariaLabel="How do you identify?"
      />
      <ChipSelect
        options={REFERRAL_OPTIONS}
        value={referralSource}
        onChange={handleReferralChange}
        columns={3}
        ariaLabel="How did you hear about us?"
      />
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleConfirm}
        disabled={!canSubmit}
        loading={api.busy}
      >
        Continue
      </Button>
    </div>
  );
}
