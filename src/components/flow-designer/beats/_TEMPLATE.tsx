import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// COPY THIS FILE to beats/<your-beat>.tsx, rename, and fill in the steps.
// You own that file. No other session touches it, so there are no collisions.
//
// A beat is a list of STEPS played in order:
//   { speaker: 'coach', say: '...' }                white bubble, coach speaks
//   { speaker: 'coach', say: '...', render: <X/> }  speaks AND reveals a component
//   { speaker: 'coach', render: <X/> }              component only, no voice
//   { speaker: 'user',  say: '...' }                blue bubble, the user answers
//
// Read editable copy from `props` so it can be tweaked in the sidebar and the
// flow. Default-export ONE BeatDef. The registry auto-collects it, no edits to
// index.ts or FlowBuilder are needed. Pick a unique `type`.

function TemplateBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    { id: 'line-1', speaker: 'coach', say: props?.line1 ?? 'First thing the coach says.' },
    // To reveal a real component, import it and add `render: <YourComponent ... />`.
    { id: 'reply', speaker: 'user', say: props?.reply ?? 'The user answers here.' },
  ];
  return <BeatPlayer steps={steps} />;
}

const templateBeat: BeatDef = {
  type: 'template-beat',
  group: 'Onboarding',
  label: 'Template beat',
  Comp: TemplateBeat,
};

export default templateBeat;
