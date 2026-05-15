export function pathToSpec(
  plan: 'simple' | 'braindump' | null | undefined,
): 'beginner' | 'advanced' | null {
  if (plan === 'braindump') return 'advanced';
  if (plan === 'simple') return 'beginner';
  return null;
}
