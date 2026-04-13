import {
  DAY_NAMES,
  HABIT_SUGGESTIONS,
  DEFAULT_SUGGESTION,
  MSG,
  COACHING,
} from '../config/dispatcher-config';
import type { ActionResult, DataService } from './data-service.interface';

/** Translate raw backend errors into friendly coaching-style messages */
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('schema') || lower.includes('column'))
    return "Something didn't work on my end. Try again in a moment.";
  if (lower.includes('not authenticated') || lower.includes('jwt'))
    return "Looks like you're not signed in. Log in and try again.";
  if (lower.includes('permission') || lower.includes('policy'))
    return "I can't do that right now. Try signing in again.";
  if (lower.includes('duplicate') || lower.includes('unique'))
    return 'That one already exists. Try a different name.';
  if (lower.includes('timeout') || lower.includes('network'))
    return "Couldn't connect. Check your internet and try again.";
  if (lower.includes('not found')) return "I couldn't find that. Make sure the name is right.";
  return "Something went wrong. Let's try that again.";
}

interface CommandIntent {
  action: string;
  entity: string;
  params: Record<string, unknown>;
  confidence: number;
}

/**
 * Format a Date as YYYY-MM-DD using LOCAL time components.
 *
 * NEVER use `Date.toISOString().slice(0,10)` for "today" — that returns
 * UTC. For users east of UTC (e.g. Indonesia at +7) it can return
 * yesterday's date during morning local time, causing voice commands
 * like "mark pushups done" to save against the wrong day.
 */
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return formatLocalDate(new Date());
}

function parseDateParam(dateStr: unknown): string {
  if (!dateStr || dateStr === 'today') return todayStr();
  if (dateStr === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }

  // Handle day names (multi-language, from config).
  // Resolves to the most recent occurrence of that day, including today.
  // Previously used `diff <= 0` which sent same-day back a full week
  // (saying "wednesday" on a Wednesday saved to LAST Wednesday). Use
  // `diff < 0` so same-day stays today.
  const lower = String(dateStr).toLowerCase();
  const dayIndex = DAY_NAMES[lower] ?? -1;
  if (dayIndex !== -1) {
    const now = new Date();
    const currentDay = now.getDay();
    let diff = currentDay - dayIndex;
    if (diff < 0) diff += 7;
    const target = new Date(now);
    target.setDate(target.getDate() - diff);
    return formatLocalDate(target);
  }

  return String(dateStr);
}

/**
 * Normalize a habit / metric name as spoken from a voice transcript.
 * Strips leading articles and possessives ("the", "my", "a", "an"),
 * trailing "habit"/"habits", trailing "please", and collapses whitespace.
 *
 * Previously the dispatcher passed the raw params.name straight to
 * getHabitByName, which is an exact ilike() match in Supabase — so
 * "mark the pushups done" (name="the pushups") would never find the
 * stored "pushups" habit. Normalizing here keeps the storage lookup
 * strict while tolerating natural speech.
 */
function normalizeVoiceName(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:the|my|a|an)\s+/i, '')
    .replace(/\s+(?:please|thanks?|thank you)$/i, '')
    .replace(/\s+habits?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class ActionDispatcher {
  constructor(private dataService: DataService) {}

  getDataService(): DataService {
    return this.dataService;
  }

  async dispatch(intent: CommandIntent): Promise<ActionResult> {
    const { action, entity, params } = intent;

    try {
      let result: ActionResult;

      switch (action) {
        case 'create':
          result = await this.handleCreate(entity, params);
          break;
        case 'complete':
          result = await this.handleComplete(entity, params);
          break;
        case 'delete':
          result = await this.handleDelete(entity, params);
          break;
        case 'update':
          result = await this.handleUpdate(entity, params);
          break;
        case 'query':
          result = await this.handleQuery(entity, params);
          break;
        case 'log':
          result = await this.handleLog(entity, params);
          break;
        case 'reflect':
          result = await this.handleReflect(entity, params);
          break;
        case 'checkin':
          result = await this.handleCheckIn(params);
          break;
        case 'focus':
          result = await this.handleFocus(params);
          break;
        case 'suggest':
          result = await this.handleSuggest(entity, params);
          break;
        case 'help':
          result = this.handleHelp();
          break;
        default:
          result = { success: false, message: `Unknown action: ${action}`, uiAction: 'toast' };
          break;
      }

      return result;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // Log full error for debugging — friendly message for the user, but
      // we need the original error in console/Sentry to actually fix things
      // when users report "voice didn't work". Previously this caught error
      // was completely silent.
      console.error('[ActionDispatcher] dispatch failed:', { action, entity, err });
      const friendly = friendlyError(raw);
      return {
        success: false,
        message: friendly,
        uiAction: 'toast',
      };
    }
  }

  private async handleCreate(
    entity: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    const name = String(params.name || '');
    if (!name) {
      // Conversational follow-up per Voice Journey Spreadsheet
      return {
        success: false,
        message: COACHING.askName(entity),
        uiAction: 'toast',
      };
    }

    switch (entity) {
      case 'habit': {
        // FIX-01 (#21): Check for duplicate habits before creating
        const existing = await this.dataService.getHabitByName(name);
        if (existing) {
          return {
            success: false,
            message: COACHING.duplicate(existing.name),
            data: existing,
            uiAction: 'toast',
          };
        }

        const frequency = String(params.frequency || 'daily');
        const habit = await this.dataService.createHabit(name, frequency);
        return {
          success: true,
          message: COACHING.habitCreated(habit.name, frequency),
          data: habit,
          uiAction: 'navigate',
          navigateTo: '/home',
        };
      }
      case 'metric': {
        const existingMetric = await this.dataService.getMetricByName(name);
        if (existingMetric) {
          return {
            success: false,
            message: `${MSG.warning} You already have a metric called "${existingMetric.name}". Try a different name or update the existing one.`,
            data: existingMetric,
            uiAction: 'toast',
          };
        }

        const inputType = String(params.inputType || params.input_type || 'scale');
        const frequency = String(params.frequency || 'daily');
        const scaleMin = params.scaleMin != null ? Number(params.scaleMin) : undefined;
        const scaleMax = params.scaleMax != null ? Number(params.scaleMax) : undefined;
        // Handle "scale" array param like [1, 10]
        const scale = params.scale as number[] | undefined;
        const metric = await this.dataService.createMetric(
          name,
          inputType,
          frequency,
          scale?.[0] ?? scaleMin,
          scale?.[1] ?? scaleMax,
        );
        return {
          success: true,
          message: `${MSG.success} Created metric "${metric.name}" (${inputType})`,
          data: metric,
          uiAction: 'navigate',
          navigateTo: '/home',
        };
      }
      default:
        return { success: false, message: `Can't create ${entity}`, uiAction: 'toast' };
    }
  }

  private async handleComplete(
    entity: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    if (entity !== 'habit') {
      return { success: false, message: `Can't complete ${entity}`, uiAction: 'toast' };
    }

    const name = normalizeVoiceName(String(params.name || ''));
    const habit = await this.dataService.getHabitByName(name);
    if (!habit) {
      return {
        success: false,
        message: `Hmm, I don't see a habit called "${name}". Want to create it?`,
        uiAction: 'toast',
      };
    }

    // Handle multiple dates
    const dates = params.dates as string[] | undefined;
    if (dates && dates.length > 0) {
      const completedDates: string[] = [];
      for (const d of dates) {
        const dateStr = parseDateParam(d);
        await this.dataService.completeHabit(habit.id, dateStr);
        completedDates.push(dateStr);
      }
      return {
        success: true,
        message: `${MSG.success} Marked "${habit.name}" done for ${completedDates.length} days`,
        uiAction: 'navigate',
        navigateTo: '/home',
      };
    }

    // Single date
    const date = parseDateParam(params.date);
    await this.dataService.completeHabit(habit.id, date);
    return {
      success: true,
      message: COACHING.habitCompleted(habit.name),
      uiAction: 'navigate',
      navigateTo: '/home',
    };
  }

  private async handleDelete(
    entity: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    const name = normalizeVoiceName(String(params.name || ''));

    switch (entity) {
      case 'habit': {
        const habit = await this.dataService.getHabitByName(name);
        if (!habit)
          return {
            success: false,
            message: `I don't see "${name}" in your habits. Check the name or create it first.`,
            uiAction: 'toast',
          };
        await this.dataService.deleteHabit(habit.id);
        return {
          success: true,
          message: COACHING.habitDeleted(habit.name),
          uiAction: 'navigate',
          navigateTo: '/home',
        };
      }
      case 'metric': {
        const metric = await this.dataService.getMetricByName(name);
        if (!metric)
          return {
            success: false,
            message: `I don't see a metric called "${name}". Check the name?`,
            uiAction: 'toast',
          };
        await this.dataService.deleteMetric(metric.id);
        return {
          success: true,
          message: `${MSG.success} Deleted metric "${metric.name}"`,
          uiAction: 'navigate',
          navigateTo: '/home',
        };
      }
      default:
        return { success: false, message: `Can't delete ${entity}`, uiAction: 'toast' };
    }
  }

  private async handleUpdate(
    entity: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    if (entity !== 'habit') {
      return { success: false, message: `Can't update ${entity} yet`, uiAction: 'toast' };
    }

    const name = normalizeVoiceName(String(params.name || ''));
    const habit = await this.dataService.getHabitByName(name);
    if (!habit)
      return {
        success: false,
        message: `I don't see "${name}" in your habits. Check the name?`,
        uiAction: 'toast',
      };

    const updates: Record<string, unknown> = {};
    if (params.newName) updates.name = String(params.newName);
    if (params.frequency) updates.frequency = String(params.frequency);

    const updated = await this.dataService.updateHabit(
      habit.id,
      updates as { name?: string; frequency?: string },
    );
    return {
      success: true,
      message: COACHING.habitUpdated(updated.name),
      data: updated,
      uiAction: 'navigate',
      navigateTo: '/home',
    };
  }

  private async handleQuery(
    entity: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    switch (entity) {
      case 'habit': {
        const rawName = params.name ? String(params.name) : null;
        const name = rawName ? normalizeVoiceName(rawName) : null;
        if (name) {
          // Query specific habit
          const habit = await this.dataService.getHabitByName(name);
          if (!habit)
            return {
              success: false,
              message: `I don't see "${name}" in your habits. Check the name?`,
              uiAction: 'toast',
            };

          const period = (params.period as 'week' | 'month') || 'week';
          const summary = await this.dataService.getHabitSummary(habit.id, period);
          return {
            success: true,
            message: `${MSG.chart} ${habit.name}: ${Math.round(summary.completionRate * 10) / 10}% (${summary.completionsThisPeriod}/${summary.totalDaysInPeriod} days), streak: ${summary.currentStreak} days, longest: ${summary.longestStreak}`,
            data: summary,
            uiAction: 'display',
          };
        }

        // If checking for streaks
        if (params.metric === 'streak') {
          const habits = await this.dataService.getHabits();
          let longestHabit = '';
          let longestStreak = 0;
          for (const h of habits) {
            const s = await this.dataService.getHabitSummary(h.id, 'month');
            if (s.longestStreak > longestStreak) {
              longestStreak = s.longestStreak;
              longestHabit = h.name;
            }
          }
          return {
            success: true,
            message: `${MSG.trophy} Longest streak: ${longestStreak} days (${longestHabit})`,
            uiAction: 'display',
          };
        }

        // List all habits
        const habits = await this.dataService.getHabits();
        const list = habits.map((h) => h.name).join(', ');
        return {
          success: true,
          message: `${MSG.list} Your habits: ${list || 'none yet'}`,
          data: habits,
          uiAction: 'navigate',
          navigateTo: '/home',
        };
      }

      case 'summary': {
        const summary = await this.dataService.getWeeklySummary();
        const habitLines = summary.habits.map(
          (h) => `• ${h.habit.name}: ${h.completionRate}% (streak: ${h.currentStreak})`,
        );
        return {
          success: true,
          message: `${MSG.chart} Weekly Summary (${summary.period.start} - ${summary.period.end}):\n${habitLines.join('\n')}\nMetrics logged: ${summary.metricsLogged}\nJournal entries: ${summary.journalEntries}`,
          data: summary,
          uiAction: 'display',
        };
      }

      default:
        return {
          success: true,
          message: `Navigating to view ${entity}`,
          uiAction: 'navigate',
          navigateTo: '/home',
        };
    }
  }

  private async handleLog(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    if (entity !== 'metric') {
      return { success: false, message: `Can't log ${entity}`, uiAction: 'toast' };
    }

    const name = normalizeVoiceName(String(params.name || ''));
    const metric = await this.dataService.getMetricByName(name);
    if (!metric)
      return {
        success: false,
        message: `I don't see a metric called "${name}". Want to create it?`,
        uiAction: 'toast',
      };

    const value = params.value != null ? params.value : null;
    if (value == null)
      return { success: false, message: `Missing value for metric "${name}"`, uiAction: 'toast' };

    const date = parseDateParam(params.date);
    await this.dataService.logMetric(metric.id, value as number | string, date);
    return {
      success: true,
      message: `${MSG.success} Logged ${metric.name}: ${value}`,
      uiAction: 'toast',
    };
  }

  private async handleReflect(
    _entity: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    // CRITICAL: Mental health safety boundary (Task 27, non-negotiable)
    if (params.crisis === true) {
      return {
        success: true,
        message:
          "I hear you, and I want you to know that what you're feeling matters. " +
          "I'm not the right support for this — but someone is. " +
          'Please reach out to the 988 Suicide and Crisis Lifeline. ' +
          "You can call or text 988, anytime, 24/7. You don't have to go through this alone.",
        data: null,
        uiAction: 'toast',
      };
    }

    const mood = String(params.mood || 'neutral');
    const themes = (params.themes as string[]) || [];
    const rawContent = params.content ? String(params.content) : null;
    const content =
      rawContent ||
      (themes.length > 0 ? `Feeling ${mood}. Themes: ${themes.join(', ')}` : `Feeling ${mood}`);

    const today = todayStr();
    const todayEntries = await this.dataService.getJournalEntries(today, today);
    const duplicate = todayEntries.find((e) => e.content.toLowerCase() === content.toLowerCase());
    if (duplicate) {
      return {
        success: false,
        message: `${MSG.warning} You already have a similar journal entry for today. Try adding different thoughts or details.`,
        data: duplicate,
        uiAction: 'toast',
      };
    }

    const entry = await this.dataService.createJournalEntry(content, mood, themes);
    return {
      success: true,
      message: COACHING.journalSaved(),
      data: entry,
      uiAction: 'toast',
    };
  }

  private async handleSuggest(
    _entity: string,
    _params: Record<string, unknown>,
  ): Promise<ActionResult> {
    const habits = await this.dataService.getHabits();
    const existingNames = habits.map((h) => h.name.toLowerCase());

    const available = HABIT_SUGGESTIONS.filter((s) => !existingNames.includes(s));
    const suggestion =
      available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : DEFAULT_SUGGESTION;

    return {
      success: true,
      message: COACHING.suggestion(suggestion),
      uiAction: 'display',
    };
  }

  private async handleCheckIn(params: Record<string, unknown>): Promise<ActionResult> {
    const sleep = params.sleep != null ? Number(params.sleep) : null;
    const mood = params.mood != null ? Number(params.mood) : null;
    const energy = params.energy != null ? Number(params.energy) : null;
    const stress = params.stress != null ? Number(params.stress) : null;

    if (sleep === null && mood === null && energy === null && stress === null) {
      return {
        success: false,
        message: `${MSG.error} Please provide at least one value (sleep, mood, energy, or stress)`,
        uiAction: 'toast',
      };
    }

    const date = todayStr();
    const record = await this.dataService.saveCheckIn(date, { sleep, mood, energy, stress });
    const parts: string[] = [];
    if (sleep !== null) parts.push(`sleep: ${sleep}`);
    if (mood !== null) parts.push(`mood: ${mood}`);
    if (energy !== null) parts.push(`energy: ${energy}`);
    if (stress !== null) parts.push(`stress: ${stress}`);

    // Determine time of day for coaching style
    const hour = new Date().getHours();
    const partsStr = parts.join(', ');
    const coachMsg =
      hour < 12
        ? COACHING.checkinMorning(partsStr)
        : hour >= 18
          ? COACHING.checkinEvening(partsStr)
          : COACHING.checkinGeneric(partsStr);

    return {
      success: true,
      message: coachMsg,
      data: record,
      uiAction: 'toast',
    };
  }

  private async handleFocus(params: Record<string, unknown>): Promise<ActionResult> {
    const duration = params.duration != null ? Number(params.duration) : 25;
    const rawHabitName = params.habit ? String(params.habit) : null;
    const habitName = rawHabitName ? normalizeVoiceName(rawHabitName) : null;

    let habitId: string | null = null;
    if (habitName) {
      const habit = await this.dataService.getHabitByName(habitName);
      if (!habit) {
        return {
          success: false,
          message: `I don't see "${habitName}" in your habits. Create it first, or start a focus session without one.`,
          uiAction: 'toast',
        };
      }
      habitId = habit.id;
    }

    await this.dataService.saveFocusSession(habitId, duration, null, new Date().toISOString());

    return {
      success: true,
      message: COACHING.focusStarted(duration, habitName || undefined),
      uiAction: 'navigate',
      navigateTo: '/focus',
    };
  }

  private handleHelp(): ActionResult {
    const commands = [
      '• "Create a habit called meditation" — add a new habit',
      '• "Mark meditation done" — complete a habit for today',
      '• "Delete the exercise habit" — remove a habit',
      '• "Rename exercise to morning workout" — update a habit',
      '• "Show my habits" — list all habits',
      '• "How am I doing with meditation?" — view stats',
      '• "Log sleep quality as 8" — record a metric value',
      '• "I feel stressed" — save a journal reflection',
      '• "Journal I had a productive morning" — quick journal entry',
      '• "Check in sleep 4 mood 3 energy 5 stress 2" — daily check-in',
      '• "Start focus session for 25 minutes" — start focus timer',
      '• "Start focus on meditation for 25 minutes" — focus on a habit',
      '• "Suggest a habit" — get a recommendation',
      '• "Help" — show this list',
    ];
    return {
      success: true,
      message: `${MSG.info} Available voice commands:\n${commands.join('\n')}`,
      uiAction: 'display',
    };
  }
}
