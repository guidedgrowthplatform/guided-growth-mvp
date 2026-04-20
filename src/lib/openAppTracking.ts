import { track } from './analytics';

interface OpenAppInput {
  todayIso: string;
  lastOpenDate: string | null;
  sessionCountStr: string | null;
  platform: string;
}

export interface OpenAppOutput {
  props: {
    is_first_open_today: boolean;
    days_since_last_open: number | null;
    session_number: number;
    platform: string;
  };
  nextLastOpenDate: string;
  nextSessionCount: string;
}

export function computeOpenAppEvent(input: OpenAppInput): OpenAppOutput {
  const sessionCount = Number.parseInt(input.sessionCountStr ?? '0', 10) || 0;

  const isFirstOpenToday = input.lastOpenDate !== input.todayIso;
  const daysSinceLastOpen = input.lastOpenDate
    ? Math.max(
        0,
        Math.round(
          (Date.parse(input.todayIso) - Date.parse(input.lastOpenDate)) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return {
    props: {
      is_first_open_today: isFirstOpenToday,
      days_since_last_open: daysSinceLastOpen,
      session_number: sessionCount + 1,
      platform: input.platform,
    },
    nextLastOpenDate: input.todayIso,
    nextSessionCount: String(sessionCount + 1),
  };
}

export function trackOpenApp(platform: string): void {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const result = computeOpenAppEvent({
      todayIso,
      lastOpenDate: localStorage.getItem('gg_last_open_date'),
      sessionCountStr: localStorage.getItem('gg_session_count'),
      platform,
    });

    track('open_app', result.props);

    localStorage.setItem('gg_last_open_date', result.nextLastOpenDate);
    localStorage.setItem('gg_session_count', result.nextSessionCount);
  } catch {
    // localStorage can throw in private mode — analytics is best-effort
  }
}
