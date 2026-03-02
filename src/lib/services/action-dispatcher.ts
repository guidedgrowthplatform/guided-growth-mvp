import type { ActionResult, DataService } from './data-service.interface';

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

  // Handle day names: "monday", "tuesday" etc
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const lower = String(dateStr).toLowerCase();
  const dayIndex = dayNames.indexOf(lower);
  if (dayIndex !== -1) {
    const now = new Date();
    const currentDay = now.getDay();
    let diff = currentDay - dayIndex;
    if (diff <= 0) diff += 7; // go to previous week
    const target = new Date(now);
    target.setDate(target.getDate() - diff);
    return target.toISOString().slice(0, 10);
  }

  return String(dateStr);
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
        const frequency = String(params.frequency || 'daily');
        const habit = await this.dataService.createHabit(name, frequency);
        return {
          success: true,
          message: `✅ Created habit "${habit.name}" (${frequency})`,
          data: habit,
          uiAction: 'navigate',
          navigateTo: '/capture',
        };
      }
      case 'metric': {
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
          message: `✅ Created metric "${metric.name}" (${inputType})`,
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
      return { success: false, message: `❌ Habit "${name}" not found`, uiAction: 'toast' };
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
        message: `✅ Marked "${habit.name}" done for ${completedDates.length} days`,
        uiAction: 'navigate',
        navigateTo: '/capture',
      };
    }

    // Single date
    const date = parseDateParam(params.date);
    await this.dataService.completeHabit(habit.id, date);
    return {
      success: true,
      message: `✅ Marked "${habit.name}" done for ${date === todayStr() ? 'today' : date}`,
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
        if (!habit) return { success: false, message: `❌ Habit "${name}" not found`, uiAction: 'toast' };
        await this.dataService.deleteHabit(habit.id);
        return {
          success: true,
          message: `✅ Deleted habit "${habit.name}"`,
          uiAction: 'navigate',
          navigateTo: '/capture',
        };
      }
      case 'metric': {
        const metric = await this.dataService.getMetricByName(name);
        if (!metric) return { success: false, message: `❌ Metric "${name}" not found`, uiAction: 'toast' };
        await this.dataService.deleteMetric(metric.id);
        return {
          success: true,
          message: `✅ Deleted metric "${metric.name}"`,
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
    if (!habit) return { success: false, message: `❌ Habit "${name}" not found`, uiAction: 'toast' };

    const updates: Record<string, unknown> = {};
    if (params.newName) updates.name = String(params.newName);
    if (params.frequency) updates.frequency = String(params.frequency);

    const updated = await this.dataService.updateHabit(habit.id, updates as { name?: string; frequency?: string });
    return {
      success: true,
      message: `✅ Updated habit "${updated.name}"`,
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
          if (!habit) return { success: false, message: `❌ Habit "${name}" not found`, uiAction: 'toast' };

          const period = (params.period as 'week' | 'month') || 'week';
          const summary = await this.dataService.getHabitSummary(habit.id, period);
          return {
            success: true,
            message: `📊 ${habit.name}: ${summary.completionRate}% (${summary.completionsThisPeriod}/${summary.totalDaysInPeriod} days), streak: ${summary.currentStreak} days, longest: ${summary.longestStreak}`,
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
            message: `🏆 Longest streak: ${longestStreak} days (${longestHabit})`,
            uiAction: 'display',
          };
        }

        // List all habits
        const habits = await this.dataService.getHabits();
        const list = habits.map((h) => h.name).join(', ');
        return {
          success: true,
          message: `📋 Your habits: ${list || 'none yet'}`,
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
          message: `📊 Weekly Summary (${summary.period.start} → ${summary.period.end}):\n${habitLines.join('\n')}\nMetrics logged: ${summary.metricsLogged}\nJournal entries: ${summary.journalEntries}`,
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
    if (!metric) return { success: false, message: `❌ Metric "${name}" not found`, uiAction: 'toast' };

    const value = params.value != null ? params.value : null;
    if (value == null) return { success: false, message: `Missing value for metric "${name}"`, uiAction: 'toast' };

    const date = parseDateParam(params.date);
    await this.dataService.logMetric(metric.id, value as number | string, date);
    return {
      success: true,
      message: `✅ Logged ${metric.name}: ${value}`,
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

    const entry = await this.dataService.createJournalEntry(content, mood, themes);
    return {
      success: true,
      message: `📝 Journal entry saved (mood: ${mood})`,
      data: entry,
      uiAction: 'toast',
    };
  }

  // ─── SUGGEST ───
  private async handleSuggest(_entity: string, _params: Record<string, unknown>): Promise<ActionResult> {
    const habits = await this.dataService.getHabits();
    const existingNames = habits.map((h) => h.name.toLowerCase());

    const suggestions = [
      'journaling', 'stretching', 'hydration tracking', 'gratitude practice',
      'deep breathing', 'walking', 'meal prep', 'digital detox', 'cold shower',
    ];

    const available = suggestions.filter((s) => !existingNames.includes(s));
    const suggestion = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : 'mindful breaks';

    return {
      success: true,
      message: `💡 Suggestion: Try "${suggestion}" — say "create a habit called ${suggestion}" to add it!`,
      uiAction: 'display',
    };
  }
}
