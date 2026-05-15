import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useState } from 'react';
import { fetchScreenRoutes, type ScreenRouteEntry } from '@/api/context';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { useLLM } from '@/hooks/useLLM';
import type { CoachingStyle } from '@shared/types/llm';

const IDLE_GRADIENT =
  'linear-gradient(to top, rgba(19,91,236,0.7) 0%, rgba(255,255,255,0.7) 54%, rgba(255,255,255,0.7) 81%, rgba(246,246,246,0.7) 100%)';

const STYLES: CoachingStyle[] = ['warm', 'direct', 'reflective'];
const FALLBACK_SCREEN_ID = 'HOME-DEFAULT';

export function ChatDebugPage() {
  const { user } = useAuth();

  const { data: routesData } = useQuery({
    queryKey: ['screenRoutes'],
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
  });
  const routes: ScreenRouteEntry[] = routesData?.routes ?? [];

  const [screenId, setScreenId] = useState(FALLBACK_SCREEN_ID);
  const [style, setStyle] = useState<CoachingStyle>('warm');

  const { sendMessage, messages, response, toolEvents, isStreaming, error, reset, cancel } =
    useLLM(screenId, { coachingStyle: style });

  const scrollAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, response, toolEvents.length]);

  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'YOU';

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-white" />
      <div
        className="absolute inset-0 backdrop-blur-[50px]"
        style={{ backgroundImage: IDLE_GRADIENT }}
      />

      <div
        className="absolute left-0 right-0 z-30 flex items-center gap-2 overflow-x-auto whitespace-nowrap px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[1.2px] text-[#135bec]">
          /chat-debug
        </span>
        <select
          value={screenId}
          onChange={(e) => {
            reset();
            setScreenId(e.target.value);
          }}
          title={screenId}
          className="max-w-[180px] shrink-0 truncate rounded-full border border-[#135bec33] bg-white/80 px-3 py-1 font-mono text-[11px] text-content backdrop-blur-md focus:outline-none"
        >
          {routes.length === 0 && <option value={FALLBACK_SCREEN_ID}>{FALLBACK_SCREEN_ID}</option>}
          {routes.map((r) => (
            <option key={r.screen_id} value={r.screen_id}>
              {r.screen_id}
            </option>
          ))}
        </select>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as CoachingStyle)}
          className="shrink-0 rounded-full border border-[#135bec33] bg-white/80 px-3 py-1 font-mono text-[11px] text-content backdrop-blur-md focus:outline-none"
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-full border border-[#135bec33] bg-white/80 px-3 py-1 font-mono text-[11px] text-content backdrop-blur-md hover:bg-white"
        >
          reset
        </button>
        {isStreaming && (
          <button
            type="button"
            onClick={cancel}
            className="shrink-0 rounded-full border border-[#135bec33] bg-white/80 px-3 py-1 font-mono text-[11px] text-content backdrop-blur-md hover:bg-white"
          >
            cancel
          </button>
        )}
      </div>

      <div
        className="relative z-10 flex-1 overflow-y-auto px-6 pt-[64px]"
        style={{
          paddingBottom: 'calc(160px + max(48px, env(safe-area-inset-bottom)))',
          maskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, transparent 0px, transparent 120px, black 240px, black 100%)',
        }}
      >
        {messages.length === 0 && !isStreaming && (
          <p className="mt-12 text-center font-mono text-[12px] text-content-tertiary">
            Send a message to start.
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className="flex flex-col">
            <ChatBubble
              role={m.role === 'user' ? 'user' : 'ai'}
              text={m.content}
              userName={displayName}
              eyebrowVariant="dark"
              compact
            />
            {m.toolEvents && m.toolEvents.length > 0 && (
              <div className="ml-4 mt-1 max-w-[290px] rounded-bl-[12px] rounded-br-[12px] rounded-tr-[12px] border border-dashed border-[#135bec55] bg-white/70 px-3 py-2 font-mono text-[10px] text-content-tertiary backdrop-blur-[6px]">
                {m.toolEvents.map((t) => (
                  <div key={t.id} className="leading-[14px]">
                    <span className="font-semibold text-[#135bec]">{t.name}</span>(
                    {JSON.stringify(t.args)}){' '}
                    {t.result && (
                      <span className={t.result.ok ? 'text-emerald-600' : 'text-red-600'}>
                        → {t.result.ok ? 'ok' : 'err'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isStreaming && response.length > 0 && (
          <ChatBubble role="ai" text={response} eyebrowVariant="dark" compact animate={false} />
        )}

        {isStreaming && response.length === 0 && toolEvents.length === 0 && <TypingIndicator />}

        {error && (
          <div className="mx-auto mt-4 max-w-[290px] rounded-2xl border border-red-300/60 bg-red-50/90 px-4 py-2 font-mono text-[11px] text-red-700 backdrop-blur-[6px]">
            {error.message}
          </div>
        )}

        <div ref={scrollAnchor} />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[20px] px-6 pt-[24px]"
        style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto w-full max-w-[420px]">
          <ChatComposer
            onSubmit={(text) => void sendMessage(text)}
            disabled={isStreaming}
            placeholder="Send a message…"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
