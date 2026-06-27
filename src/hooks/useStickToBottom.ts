/**
 * useStickToBottom — the shared "real chat" auto-scroll behaviour.
 *
 * Keeps a scroll container pinned to the bottom as new content arrives (so the
 * latest message pushes everything up), but ONLY while the user is already near
 * the bottom. If they scroll up to read history, new content does not yank them
 * back down. This is the same logic CoachChatView and OnboardingChatOverlay
 * each implemented inline; extract it once so every chat surface behaves the
 * same and the cutoff above the orb is consistent app-wide.
 *
 * Usage:
 *   const { scrollRef, onScroll, scrollToBottom } = useStickToBottom(contentKey);
 *   <div ref={scrollRef} onScroll={onScroll} className="overflow-y-auto">…</div>
 * Pass a `contentKey` that changes whenever content is appended (message count,
 * streamed length, active beat id) so the effect re-pins after each growth.
 */
import { useCallback, useEffect, useRef } from 'react';

// Within this many px of the bottom counts as "pinned" (matches the existing
// chat surfaces). Generous enough to survive a half-revealed card.
const PIN_THRESHOLD_PX = 140;

export function useStickToBottom(contentKey: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
  }, []);

  // Pin to the bottom only when already there. Forced = honor the request even
  // if the user scrolled up (used right after the user themselves sends).
  const scrollToBottom = useCallback((force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (force || pinned.current) {
      el.scrollTop = el.scrollHeight;
      pinned.current = true;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [contentKey, scrollToBottom]);

  return { scrollRef, onScroll, scrollToBottom };
}
