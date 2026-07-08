import { Icon } from '@iconify/react';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { DualButton } from '@/components/ui/DualButton';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { IconChatText, IconMicMuted } from '@/components/icons';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { FONT, PRIMARY } from './_beatStyle';

function CenterOrb() {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-6">
      <div
        style={{
          width: 168,
          height: 168,
          borderRadius: 999,
          background:
            'radial-gradient(circle at 38% 34%, rgba(255,255,255,0.95), rgba(19,91,236,0.58) 52%, rgba(19,91,236,0.18) 72%, rgba(19,91,236,0) 100%)',
          boxShadow: '0 28px 60px -24px rgba(19,91,236,0.8)',
          animation: 'ggChatOrbPulse 2200ms ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes ggChatOrbPulse {
          0%, 100% { transform: scale(0.98); opacity: 0.82; }
          50% { transform: scale(1.04); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function OpenChat({ line }: { line: string }) {
  return (
    <div className="relative min-h-[650px] overflow-hidden rounded-[28px] bg-white">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(19,91,236,0.74) 0%, rgba(255,255,255,0.76) 57%, rgba(255,255,255,0.96) 100%)',
        }}
      />
      <div className="relative z-10 flex h-full min-h-[650px] flex-col justify-end px-5 pb-[118px] pt-8">
        <ChatBubble role="ai" text={line} eyebrowVariant="dark" compact animate={false} />
      </div>
      <div className="absolute bottom-[78px] left-0 right-0 z-20 flex justify-center">
        <DualButton
          size={74}
          leftActive
          rings
          ringCount={3}
          ringStep={5}
          leftIcon={<IconChatText size={25} />}
          rightIcon={<IconMicMuted size={23} />}
          leftAriaLabel="Chat mode"
          rightAriaLabel="Microphone"
        />
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-20">
        <ChatComposer
          value=""
          onValueChange={() => {}}
          onSubmit={() => {}}
          placeholder="Type or talk..."
          className="flex min-h-[44px] w-full items-end gap-1 rounded-[22px] bg-white py-1.5 pl-5 pr-2 shadow-[0px_10px_24px_-8px_rgba(15,23,42,0.18)]"
        />
      </div>
      <div
        className="absolute right-5 top-5 z-20 flex size-9 items-center justify-center rounded-full bg-white shadow-card"
        aria-hidden
      >
        <Icon icon="mdi:close" width={18} height={18} style={{ color: PRIMARY }} />
      </div>
    </div>
  );
}

function CoachChatOpenBeat(props?: Record<string, string>) {
  const stage = props?.stage ?? 'open';
  if (stage === 'idle') return <CenterOrb />;

  const line = props?.coachLine ?? "Hey, how's your day going?";
  const steps: BeatStep[] = [
    {
      id: 'chat-open',
      speaker: 'coach',
      render: <OpenChat line={line} />,
    },
  ];
  return <BeatPlayer steps={steps} />;
}

const coachChatOpenBeat: BeatDef = {
  type: 'coach-chat-open',
  group: 'Chat',
  label: 'Coach chat open',
  Comp: CoachChatOpenBeat,
};

export default coachChatOpenBeat;
