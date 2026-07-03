export const PROJECT_REFS = {
  prod: 'pmunbflbjpoawicgimyc',
  staging: 'ppyouymvnrqxcsllrmsl',
} as const;

export type DbTarget = 'prod' | 'staging' | 'unknown';

export function classifyTarget(text: string): DbTarget {
  if (!text) return 'unknown';
  for (const [name, ref] of Object.entries(PROJECT_REFS)) {
    if (text.includes(ref)) return name as DbTarget;
  }
  return 'unknown';
}
