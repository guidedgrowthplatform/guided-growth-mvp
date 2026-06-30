import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// A live improv reaction: the coach reacts to what the user just said, spoken LIVE
// via Cartesia (NOT a pre-recorded MP3). The text here is a placeholder; at runtime
// the line is generated. Marked voiceEngine = Cartesia (in withSheetAudio) so the
// verbatim-vs-live split is visible in the builder and matches the engine's tagging.
function LiveReactionBubble({ text }: { text: string }) {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-1.5">
      <span className="flex w-fit items-center gap-1.5 rounded-full border border-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        <span className="size-1.5 rounded-full bg-primary" /> Live · Cartesia
      </span>
      <div className="rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-[15px] text-content">
        {text}
      </div>
    </div>
  );
}

function LiveReactionBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'reaction',
      speaker: 'coach',
      render: <LiveReactionBubble text={props?.text ?? 'Reacts live to what you just shared.'} />,
    },
  ];
  return <BeatPlayer steps={steps} />;
}

const liveReactionBeat: BeatDef = {
  type: 'live-reaction',
  group: 'Check-in',
  label: 'Live reaction (improv, Cartesia)',
  Comp: LiveReactionBeat,
};

export default liveReactionBeat;
