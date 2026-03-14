import type { ActionResult, DataService } from './data-service.interface';
import { DAY_NAMES, HABIT_SUGGESTIONS, DEFAULT_SUGGESTION, MSG } from '../config/dispatcher-config';

interface CommandIntent {
  action: string;
  entity: string;
  params: Record<string, unknown>;
  confidence: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateParam(dateStr: unknown): string {
  if (!dateStr || dateStr === 'today') return todayStr();
  if (dateStr === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const lower = String(dateStr).toLowerCase().trim();

  // Handle "N days ago" / "two days ago" / "a day ago" patterns
  const WORD_NUMS: Record<string, number> = {
    a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  };
  const daysAgoMatch = lower.match(/^(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\s+days?\s+ago$/);
  if (daysAgoMatch) {
    const num = WORD_NUMS[daysAgoMatch[1]] ?? parseInt(daysAgoMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      const d = new Date();
      d.setDate(d.getDate() - num);
      return d.toISOString().slice(0, 10);
    }
  }

  // Handle "last week" (7 days ago)
  if (lower === 'last week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }

  // Handle day names (multi-language, from config)
  const dayIndex = DAY_NAMES[lower] ?? -1;
  if (dayIndex !== -1) {
    const now = new Date();
    const currentDay = now.getDay();
    let diff = currentDay - dayIndex;
    if (diff <= 0) diff += 7; // go to previous week
    const target = new Date(now);
    target.setDate(target.getDate() - diff);
    return target.toISOString().slice(0, 10);
  }

  // If it looks like a valid ISO date (YYYY-MM-DD), return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return lower;
  }

  // Try to parse natural date strings like "8th March 2026", "March 10", "Jan 5th 2026"
  const MONTHS: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  // "8th March 2026" or "8 March" or "March 8th 2026" or "March 8"
  const datePatterns = [
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/,  // 8th March 2026
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/,  // March 8th 2026
  ];
  for (const pattern of datePatterns) {
    const match = lower.match(pattern);
    if (match) {
      let day: number, monthName: string, year: number;
      if (/^\d/.test(match[1])) {
        day = parseInt(match[1], 10);
        monthName = match[2];
        year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      } else {
        monthName = match[1];
        day = parseInt(match[2], 10);
        year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      }
      const monthIndex = MONTHS[monthName];
      if (monthIndex !== undefined && day >= 1 && day <= 31) {
        const d = new Date(year, monthIndex, day);
        return d.toISOString().slice(0, 10);
      }
    }
  }

  // Fallback: unknown format — default to today to avoid broken date keys
  console.warn(`[parseDateParam] Unknown date format: "${dateStr}", defaulting to today`);
  return todayStr();
}

export class ActionDispatcher {
  constructor(private dataService: DataService) {}

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

      // Notify UI to re-fetch data after any successful mutation
      if (result.success && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('voice-data-changed'));
      }

      return result;
    } catch (err) {
      return {
        success: false,
        message: `Error: ${err instanceof Error ? err.message : String(err)}`,
        uiAction: 'toast',
      };
    }
  }

  // ─── CREATE ───
  private async handleCreate(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    const name = String(params.name || '');
    if (!name) return { success: false, message: 'Missing name for creation', uiAction: 'toast' };

    switch (entity) {
      case 'habit': {
        // FIX-01 (#21): Check for duplicate habits before creating
        const existing = await this.dataService.getHabitByName(name);
        if (existing) {
          return {
            success: false,
            message: `${MSG.warning} You already have a habit called "${existing.name}". Try a different name or update the existing one.`,
            data: existing,
            uiAction: 'toast',
          };
        }

        const frequency = String(params.frequency || 'daily');
        const habit = await this.dataService.createHabit(name, frequency);
        return {
          success: true,
          message: `${MSG.success} Created habit "${habit.name}" (${frequency})`,
          data: habit,
          uiAction: 'navigate',
          navigateTo: '/capture',
        };
      }
      case 'metric': {
        // FIX-01 (#21): Check for duplicate metrics before creating
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
          navigateTo: '/configure',
        };
      }
      default:
        return { success: false, message: `Can't create ${entity}`, uiAction: 'toast' };
    }
  }

  // ─── COMPLETE ───
  private async handleComplete(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    if (entity !== 'habit') {
      return { success: false, message: `Can't complete ${entity}`, uiAction: 'toast' };
    }

    const name = String(params.name || '');
    const habit = await this.dataService.getHabitByName(name);
    if (!habit) {
      return { success: false, message: `${MSG.error} Habit "${name}" not found`, uiAction: 'toast' };
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
        navigateTo: '/capture',
      };
    }

    // Single date — but first check for "past N days" / "last N days" pattern as fallback
    const dateRaw = String(params.date || '');
    const dateRawLower = dateRaw.toLowerCase().trim();
    const RANGE_WORDS: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
      eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    };
    const rangeMatch = dateRawLower.match(/(?:past|last)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\s+days?/);
    if (rangeMatch) {
      const num = RANGE_WORDS[rangeMatch[1]] ?? parseInt(rangeMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= 30) {
        const completedDates: string[] = [];
        for (let i = 0; i < num; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          await this.dataService.completeHabit(habit.id, dateStr);
          completedDates.push(dateStr);
        }
        return {
          success: true,
          message: `${MSG.success} Marked "${habit.name}" done for the past ${num} days`,
          uiAction: 'navigate',
          navigateTo: '/capture',
        };
      }
    }

    const date = parseDateParam(params.date);
    await this.dataService.completeHabit(habit.id, date);
    return {
      success: true,
      message: `${MSG.success} Marked "${habit.name}" done for ${date === todayStr() ? 'today' : date}`,
      uiAction: 'navigate',
      navigateTo: '/capture',
    };
  }

  // ─── DELETE ───
  private async handleDelete(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    const name = String(params.name || '');

    switch (entity) {
      case 'habit': {
        const habit = await this.dataService.getHabitByName(name);
        if (!habit) return { success: false, message: `${MSG.error} Habit "${name}" not found`, uiAction: 'toast' };
        await this.dataService.deleteHabit(habit.id);
        return {
          success: true,
          message: `${MSG.success} Deleted habit "${habit.name}"`,
          uiAction: 'navigate',
          navigateTo: '/capture',
        };
      }
      case 'metric': {
        const metric = await this.dataService.getMetricByName(name);
        if (!metric) return { success: false, message: `${MSG.error} Metric "${name}" not found`, uiAction: 'toast' };
        await this.dataService.deleteMetric(metric.id);
        return {
          success: true,
          message: `${MSG.success} Deleted metric "${metric.name}"`,
          uiAction: 'navigate',
          navigateTo: '/configure',
        };
      }
      default:
        return { success: false, message: `Can't delete ${entity}`, uiAction: 'toast' };
    }
  }

  // ─── UPDATE ───
  private async handleUpdate(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    if (entity !== 'habit') {
      return { success: false, message: `Can't update ${entity} yet`, uiAction: 'toast' };
    }

    const name = String(params.name || '');
    const habit = await this.dataService.getHabitByName(name);
    if (!habit) return { success: false, message: `${MSG.error} Habit "${name}" not found`, uiAction: 'toast' };

    const updates: Record<string, unknown> = {};
    if (params.newName) updates.name = String(params.newName);
    if (params.frequency) updates.frequency = String(params.frequency);

    const updated = await this.dataService.updateHabit(habit.id, updates as { name?: string; frequency?: string });
    return {
      success: true,
      message: `${MSG.success} Updated habit "${updated.name}"`,
      data: updated,
      uiAction: 'navigate',
      navigateTo: '/capture',
    };
  }

  // ─── QUERY ───
  private async handleQuery(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    switch (entity) {
      case 'habit': {
        const name = params.name ? String(params.name) : null;
        if (name) {
          // Query specific habit
          const habit = await this.dataService.getHabitByName(name);
          if (!habit) return { success: false, message: `${MSG.error} Habit "${name}" not found`, uiAction: 'toast' };

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
          navigateTo: '/capture',
        };
      }

      case 'summary': {
        const summary = await this.dataService.getWeeklySummary();
        const habitLines = summary.habits.map(
          (h) => `• ${h.habit.name}: ${h.completionRate}% (streak: ${h.currentStreak})`
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
          navigateTo: '/capture',
        };
    }
  }

  // ─── LOG ───
  private async handleLog(entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    if (entity !== 'metric') {
      return { success: false, message: `Can't log ${entity}`, uiAction: 'toast' };
    }

    const name = String(params.name || '');
    const metric = await this.dataService.getMetricByName(name);
    if (!metric) return { success: false, message: `${MSG.error} Metric "${name}" not found`, uiAction: 'toast' };

    const value = params.value != null ? params.value : null;
    if (value == null) return { success: false, message: `Missing value for metric "${name}"`, uiAction: 'toast' };

    const date = parseDateParam(params.date);
    await this.dataService.logMetric(metric.id, value as number | string, date);
    return {
      success: true,
      message: `${MSG.success} Logged ${metric.name}: ${value}`,
      uiAction: 'toast',
    };
  }

  // ─── REFLECT ───
  private async handleReflect(_entity: string, params: Record<string, unknown>): Promise<ActionResult> {
    const mood = String(params.mood || 'neutral');
    const themes = (params.themes as string[]) || [];
    const content = themes.length > 0
      ? `Feeling ${mood}. Themes: ${themes.join(', ')}`
      : `Feeling ${mood}`;

    // FIX-01 (#21): Check for duplicate journal entries today with same content
    const today = todayStr();
    const todayEntries = await this.dataService.getJournalEntries(today, today);
    const duplicate = todayEntries.find(
      (e) => e.content.toLowerCase() === content.toLowerCase()
    );
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
      message: `${MSG.journal} Journal entry saved (mood: ${mood})`,
      data: entry,
      uiAction: 'toast',
    };
  }

  // ─── SUGGEST ───
  private async handleSuggest(_entity: string, _params: Record<string, unknown>): Promise<ActionResult> {
    const habits = await this.dataService.getHabits();
    const existingNames = habits.map((h) => h.name.toLowerCase());

    const available = HABIT_SUGGESTIONS.filter((s) => !existingNames.includes(s));
    const suggestion = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : DEFAULT_SUGGESTION;

    return {
      success: true,
      message: `${MSG.suggest} Suggestion: Try "${suggestion}" — say "create a habit called ${suggestion}" to add it!`,
      uiAction: 'display',
    };
  }

  // ─── HELP (Issue #19) ───
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
