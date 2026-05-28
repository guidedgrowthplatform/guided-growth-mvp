import type { OnboardingVoiceResult } from '@/hooks/useOnboardingVoice';
import type { LLMToolEvent } from '@shared/types/llm';

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function asNumberArray(v: unknown): number[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : undefined;
}
function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
}
function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function r(action: string, params: Record<string, unknown>): OnboardingVoiceResult {
  return { success: true, action, params, message: '', confidence: 1 };
}

export function toolEventToVoiceActions(event: LLMToolEvent): OnboardingVoiceResult[] {
  if (!event.result?.ok) return [];
  const args = event.args ?? {};
  const out: OnboardingVoiceResult[] = [];

  switch (event.name) {
    case 'submit_profile': {
      const nickname = asString(args.nickname);
      const age = asString(args.age);
      const gender = asString(args.gender);
      const referralSource = asString(args.referral_source);
      if (nickname) out.push(r('fill_field', { fieldName: 'nickname', value: nickname }));
      if (age) out.push(r('fill_field', { fieldName: 'age', value: age }));
      if (gender) out.push(r('select_option', { fieldName: 'gender', value: gender }));
      if (referralSource)
        out.push(r('select_option', { fieldName: 'referralSource', value: referralSource }));
      return out;
    }
    case 'submit_path_choice': {
      const path = asString(args.path);
      if (path) out.push(r('set_path', { path }));
      return out;
    }
    case 'submit_category': {
      const category = asString(args.category);
      if (category) out.push(r('select_option', { fieldName: 'category', value: category }));
      return out;
    }
    case 'submit_goals': {
      const goals = asStringArray(args.goals);
      if (goals && goals.length > 0)
        out.push(r('select_multiple', { fieldName: 'goals', values: goals }));
      return out;
    }
    case 'add_habit': {
      const name = asString(args.name);
      const days = asNumberArray(args.days);
      const time = asString(args.time);
      const reminder = asBoolean(args.reminder);
      const schedule = asString(args.schedule);
      if (name) {
        out.push(
          r('add_habit', {
            name,
            value: name,
            ...(days !== undefined ? { days } : {}),
            ...(time !== undefined ? { time } : {}),
            ...(reminder !== undefined ? { reminder } : {}),
            ...(schedule !== undefined ? { schedule } : {}),
          }),
        );
      }
      return out;
    }
    case 'remove_habit': {
      const name = asString(args.name);
      if (name) out.push(r('remove_habit', { name }));
      return out;
    }
    case 'submit_reflection_config': {
      const time = asString(args.time);
      const days = asNumberArray(args.days);
      const reminder = asBoolean(args.reminder);
      const schedule = asString(args.schedule);
      const params = {
        ...(time !== undefined ? { time } : {}),
        ...(days !== undefined ? { days } : {}),
        ...(reminder !== undefined ? { reminder } : {}),
        ...(schedule !== undefined ? { schedule } : {}),
      };
      if (Object.keys(params).length > 0) out.push(r('set_reflection_config', params));
      return out;
    }
    case 'submit_brain_dump': {
      const raw = asString(args.brain_dump_raw);
      if (raw) out.push(r('fill_field', { fieldName: 'brainDumpText', value: raw }));
      return out;
    }
    default:
      return [];
  }
}
