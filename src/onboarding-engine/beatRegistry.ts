import type { OnboardingBeat } from '@/generated/onboardingContract';

export type PreviewTools = Record<string, (...args: unknown[]) => void>;
export type BeatRenderer = (props: {
  beat: OnboardingBeat;
  onAdvance: () => void;
  tools?: PreviewTools;
}) => JSX.Element;

const modules = import.meta.glob('./beats/*.tsx', { eager: true }) as Record<
  string,
  { default: BeatRenderer }
>;

export const componentRegistry: Record<string, BeatRenderer> = Object.fromEntries(
  Object.entries(modules)
    .map(([path, module]): [string, BeatRenderer] => [
      path.replace(/^\.\/beats\//, '').replace(/\.tsx$/, ''),
      module.default,
    ])
    .filter(([key]) => !key.startsWith('_')),
);
