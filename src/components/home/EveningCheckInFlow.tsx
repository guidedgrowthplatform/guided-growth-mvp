import { Icon } from '@iconify/react';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AIResponseText } from '@/components/ui/AIResponseText';
import { ChatBubble } from '@/components/voice/ChatBubble';
import { TypingIndicator } from '@/components/voice/TypingIndicator';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { track } from '@/lib/analytics';
import type { Habit, HabitCompletion } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';
import { speak, stopTTS, unlockTTS } from '@/lib/services/tts-service';

/**
 * Evening Check-In Flow (ECHECK-01 through ECHECK-06)
 *
 * Voice Journey CSV spec:
 * 1. ECHECK-01: Ask method — self-report or AI-read
 * 2. ECHECK-02/03: Go through habits
 * 3. ECHECK-04: Goal check (if morning goal exists)
 * 4. ECHECK-05: Daily reflection (if configured)
 * 5. ECHECK-06: Wrap-up summary
 */

interface HabitStatus {
  habit: Habit;
  completed: boolean;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

type FlowStep =
  | 'method_choice' // ECHECK-01
  | 'ai_read' // ECHECK-03 (coach reads habits one by one)
  | 'self_report' // ECHECK-02 (user reports)
  | 'goal_check' // ECHECK-04
  | 'wrap_up'; // ECHECK-06

interface EveningCheckInFlowProps {
  onClose: () => void;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function EveningCheckInFlow({ onClose }: EveningCheckInFlowProps) {
  const { user } = useAuth();
  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  const { isListening, start, stop, transcript, resetTranscript } = useVoiceInput();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [step, setStep] = useState<FlowStep>('method_choice');
  const [habits, setHabits] = useState<HabitStatus[]>([]);
  const [currentHabitIdx, setCurrentHabitIdx] = useState(0);
  const [_completedCount, setCompletedCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTranscript = useRef('');
  const initialized = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const addAiMsg = useCallback(
    (text: string, alsoSpeak = true, autoListen = true) => {
      setMessages((prev) => [...prev, { id: makeId(), role: 'ai', text }]);
      if (alsoSpeak) {
        speak(text);
        // Auto-start listening after TTS finishes (seamless conversation)
        if (autoListen) {
          const ttsDurationMs = Math.max(2000, text.length * 65);
          setTimeout(() => {
            resetTranscript();
            start();
          }, ttsDurationMs);
        }
      }
    },
    [start, resetTranscript],
  );

  const addUserMsg = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: makeId(), role: 'user', text }]);
  }, []);

  // Load habits on mount + start flow
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const ds = await getDataService();
        const allHabits = await ds.getHabits();
        const today = new Date().toISOString().slice(0, 10);
        const completions = await ds.getAllCompletions(today, today);
        const completedIds = new Set(completions.map((c: HabitCompletion) => c.habitId));

        const statuses: HabitStatus[] = allHabits
          .filter((h: Habit) => h.active)
          .map((habit: Habit) => ({ habit, completed: completedIds.has(habit.id) }));

        setHabits(statuses);
        setCompletedCount(statuses.filter((h: HabitStatus) => h.completed).length);

        // ECHECK-01: Opening
        unlockTTS();
        const greeting = `Hey ${displayName}, let's wrap up your day. Would you like to go through your habits yourself, or want me to read them off?`;
        addAiMsg(greeting);
      } catch {
        addAiMsg("I couldn't load your habits right now. Let's try again later.");
      }
    })();
  }, [displayName, addAiMsg]);

  // Process voice transcript
  useEffect(() => {
    if (!transcript || transcript === lastTranscript.current || isListening) return;
    lastTranscript.current = transcript;

    addUserMsg(transcript);
    handleUserInput(transcript.toLowerCase());
    resetTranscript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, isListening]);

  const handleUserInput = useCallback(
    (text: string) => {
      if (step === 'method_choice') {
        // ECHECK-01: Determine method
        const aiRead = /read|you go|go through|list them|tell me/i.test(text);
        const selfReport = /i.?ll|let me|myself|i.?ll do|i did|report/i.test(text);

        if (aiRead) {
          setStep('ai_read');
          setCurrentHabitIdx(0);
          if (habits.length > 0) {
            const first = habits[0].habit.name;
            addAiMsg(`OK. Let's go through them. ${first}, did you do it?`);
          } else {
            addAiMsg("Looks like you don't have any habits scheduled today. Rest well.");
            setStep('wrap_up');
          }
        } else if (selfReport) {
          setStep('self_report');
          addAiMsg('Go ahead, tell me how today went.');
        } else {
          // Ambiguous — default to AI-read
          addAiMsg("I'll read them off for you. Let's go through them.");
          setStep('ai_read');
          setCurrentHabitIdx(0);
          if (habits.length > 0) {
            setTimeout(() => {
              addAiMsg(`${habits[0].habit.name}, did you do it?`);
            }, 2500);
          }
        }
        return;
      }

      if (step === 'ai_read') {
        // ECHECK-03: Process response for current habit
        const yes = /yes|yeah|did it|yep|done|checked|completed/i.test(text);
        const no = /no|skip|didn.?t|nope|missed/i.test(text);
        const sortOf = /sort of|kind of|half|started|partially/i.test(text);

        if (yes || sortOf) {
          markHabitDone(currentHabitIdx);
          const ack = sortOf ? "I'll mark that as done. Every bit counts." : 'Nice.';
          const nextIdx = currentHabitIdx + 1;

          if (nextIdx < habits.length) {
            setCurrentHabitIdx(nextIdx);
            const nextName = habits[nextIdx].habit.name;
            const phrasing =
              nextIdx === habits.length - 1
                ? `${ack} Last one, ${nextName}?`
                : `${ack} How about ${nextName}?`;
            addAiMsg(phrasing);
          } else {
            addAiMsg(`${ack} That's all of them.`);
            transitionAfterHabits();
          }
        } else if (no) {
          const nextIdx = currentHabitIdx + 1;
          if (nextIdx < habits.length) {
            setCurrentHabitIdx(nextIdx);
            const nextName = habits[nextIdx].habit.name;
            addAiMsg(`OK. And ${nextName}?`);
          } else {
            addAiMsg("OK. That's all of them.");
            transitionAfterHabits();
          }
        } else {
          // Didn't understand — ask again gently
          addAiMsg('Did you do it? Yes or no is fine.');
        }
        return;
      }

      if (step === 'self_report') {
        // ECHECK-02: Parse self-report
        setProcessing(true);
        const completed: string[] = [];
        const missed: string[] = [];

        for (const { habit } of habits) {
          const nameLC = habit.name.toLowerCase();
          const nameWords = nameLC.split(/\s+/);
          const mentioned = nameWords.some((w) => text.includes(w));

          if (mentioned) {
            const isSkip = /skip|miss|didn.?t.*${nameWords[0]}/i.test(text);
            if (isSkip) {
              missed.push(habit.name);
            } else {
              completed.push(habit.name);
              const idx = habits.findIndex((h) => h.habit.id === habit.id);
              if (idx >= 0) markHabitDone(idx);
            }
          }
        }

        // Check for "all" or "everything"
        if (/all of them|everything|did them all|all done/i.test(text)) {
          habits.forEach((_, idx) => markHabitDone(idx));
          addAiMsg(`All ${habits.length} habits done? Nice. Let me mark them all complete.`);
          setProcessing(false);
          transitionAfterHabits();
          return;
        }

        if (completed.length > 0 || missed.length > 0) {
          const parts: string[] = [];
          if (completed.length > 0) parts.push(`Got it, ${completed.join(', ')}.`);
          if (missed.length > 0) parts.push(`Skipped ${missed.join(', ')}.`);
          addAiMsg(parts.join(' ') + ' Anything else?');
        } else if (/good day|great|not bad/i.test(text)) {
          addAiMsg('Sounds like a solid day. Which habits specifically did you complete?');
        } else if (/not great|rough|bad|terrible/i.test(text)) {
          addAiMsg("That's OK. Which ones did you get to?");
        } else {
          addAiMsg('OK, which habits specifically? You can say the names or just tell me.');
        }
        setProcessing(false);
        return;
      }

      if (step === 'goal_check') {
        // ECHECK-04: Goal check response
        const achieved = /yes|yeah|did it|nailed|done|got it/i.test(text);
        const partial = /sort of|kind of|started|halfway|partially/i.test(text);

        if (achieved) {
          addAiMsg("You said you wanted to do it and you did. That's you following through.");
        } else if (partial) {
          addAiMsg('Progress counts. You moved it forward.');
        } else {
          addAiMsg("No stress. Tomorrow's a fresh one.");
        }
        setTimeout(() => doWrapUp(), 3000);
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, habits, currentHabitIdx, addAiMsg],
  );

  const markHabitDone = useCallback(
    (idx: number) => {
      setHabits((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], completed: true };
        return updated;
      });
      setCompletedCount((c) => c + 1);

      // Actually save to DB
      (async () => {
        try {
          const ds = await getDataService();
          await ds.completeHabit(habits[idx].habit.id, new Date().toISOString().slice(0, 10));
        } catch {
          // Silent fail — user can fix manually
        }
      })();
    },
    [habits],
  );

  const transitionAfterHabits = useCallback(() => {
    // Check if morning goal exists
    const morningGoal = localStorage.getItem('gg_morning_goal');
    if (morningGoal) {
      setTimeout(() => {
        setStep('goal_check');
        addAiMsg(
          `One more thing. You said this morning you wanted to ${morningGoal}. How'd that go?`,
        );
      }, 2500);
    } else {
      setTimeout(() => doWrapUp(), 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAiMsg]);

  const doWrapUp = useCallback(() => {
    setStep('wrap_up');
    const total = habits.length;
    const done = habits.filter((h) => h.completed).length;

    let comment: string;
    if (done === total && total > 0) {
      comment = `All habits done today. That's a full day. Rest well, ${displayName}.`;
    } else if (done >= total * 0.75) {
      comment = `${done} out of ${total}, solid day. Rest well, ${displayName}.`;
    } else if (done >= 1) {
      comment = `${done} out of ${total} today. Some days are like that. Tomorrow's fresh.`;
    } else {
      comment = `Sometimes the day doesn't go as planned. That's OK. Tomorrow we start again. Sleep well, ${displayName}.`;
    }

    addAiMsg(comment, true, false); // Don't auto-listen on wrap-up

    track('evening_complete', {
      habits_completed: done,
      habits_total: total,
      had_goal: !!localStorage.getItem('gg_morning_goal'),
    });

    // Clear morning goal for today
    localStorage.removeItem('gg_morning_goal');

    // Auto-close after wrap-up
    setTimeout(() => onClose(), 5000);
  }, [habits, displayName, addAiMsg, onClose]);

  const handleMicPress = () => {
    unlockTTS();
    if (isListening) {
      stop();
    } else {
      stopTTS();
      lastTranscript.current = '';
      resetTranscript();
      start();
    }
  };

  const handleClose = () => {
    stop();
    stopTTS();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={handleClose}>
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(4,4,4,0.55)] via-[rgba(26,26,26,0.4)] to-[rgba(81,81,81,0.25)]" />
      <div
        className="absolute inset-0 backdrop-blur-[15px]"
        style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, black 40%)' }}
      />

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute right-5 top-14 z-20 text-white transition-colors hover:text-white/80"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Step indicator */}
      <div className="relative z-10 px-6 pt-16">
        <p className="text-center text-sm font-medium text-white/60">Evening Check-In</p>
      </div>

      {/* Chat messages */}
      <div
        className="relative z-10 flex-1 overflow-y-auto px-6 pb-4 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <ChatBubble role="user" text={msg.text} userName={user?.name ?? undefined} />
            ) : (
              <AIResponseText text={msg.text} />
            )}
          </div>
        ))}
        {processing && <TypingIndicator />}
        <div ref={scrollRef} />
      </div>

      {/* Quick action buttons for method choice */}
      {step === 'method_choice' && (
        <div className="relative z-10 flex gap-3 px-6 pb-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              addUserMsg("I'll report");
              handleUserInput("i'll report");
            }}
            className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm"
          >
            I'll report
          </button>
          <button
            onClick={() => {
              addUserMsg('Read them off');
              handleUserInput('read them');
            }}
            className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm"
          >
            Read them off
          </button>
        </div>
      )}

      {/* Mic button */}
      {step !== 'wrap_up' && (
        <div
          className="relative z-10 flex flex-col items-center pb-10"
          onClick={(e) => e.stopPropagation()}
        >
          {isListening && (
            <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-[#fdd017] px-3 py-1.5">
              <span className="text-[14px] font-medium text-content">Listening</span>
              <Icon icon="mingcute:loading-2-line" className="h-6 w-6 animate-spin text-content" />
            </div>
          )}

          <div className="relative flex items-center justify-center">
            <div
              className={`absolute h-[105px] w-[105px] rounded-full border-[3px] border-[#89c9ff] opacity-40 transition-all duration-500 ${
                isListening ? 'animate-[pulse_1.5s_ease-in-out_infinite]' : ''
              }`}
            />
            <button
              onClick={handleMicPress}
              disabled={processing}
              className="relative flex h-[75px] w-[75px] items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)] active:scale-95 disabled:active:scale-100"
            >
              <Icon
                icon={isListening ? 'ic:round-mic' : 'ic:round-mic-off'}
                width={20}
                height={20}
                className="text-white"
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
