import { Capacitor, registerPlugin } from '@capacitor/core';

// iOS-only digital-wellbeing feature backed by Apple's Screen Time APIs
// (FamilyControls). App names never reach JS — the native picker/report render
// them; JS only ever sees counts.

export type ScreenTimeAuthStatus = 'notDetermined' | 'denied' | 'approved';

export interface ScreenTimeStatus {
  supported: boolean;
  status: ScreenTimeAuthStatus;
  hasSelection: boolean;
  applicationCount: number;
  categoryCount: number;
  budgetCount: number;
  shieldActive: boolean;
}

export interface ScreenTimePickerResult {
  cancelled: boolean;
  applicationCount: number;
  categoryCount: number;
  webDomainCount: number;
}

export type ScreenTimeResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export interface UsageReportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type UsageReportRange = 'today' | 'week';

interface ScreenTimePlugin {
  isSupported(): Promise<{ supported: boolean }>;
  getStatus(): Promise<ScreenTimeStatus>;
  requestAuthorization(): Promise<{ status: ScreenTimeAuthStatus }>;
  presentPicker(): Promise<ScreenTimePickerResult>;
  presentBudgetEditor(): Promise<{ budgetCount: number }>;
  showUsageReport(): Promise<void>;
  attachUsageReport(opts: UsageReportRect & { range: UsageReportRange }): Promise<void>;
  updateUsageReportRect(opts: UsageReportRect): Promise<void>;
  setUsageReportRange(opts: { range: UsageReportRange }): Promise<void>;
  detachUsageReport(): Promise<void>;
  applyShield(opts?: { minutes?: number }): Promise<void>;
  clearShield(): Promise<void>;
  disable(): Promise<void>;
}

const OFF_IOS_MESSAGE = 'Screen Time is available in the iPhone app.';

const UNSUPPORTED_STATUS: ScreenTimeStatus = {
  supported: false,
  status: 'notDetermined',
  hasSelection: false,
  applicationCount: 0,
  categoryCount: 0,
  budgetCount: 0,
  shieldActive: false,
};

let plugin: ScreenTimePlugin | null = null;

export function isScreenTimeAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

function getPlugin(): ScreenTimePlugin | null {
  if (!isScreenTimeAvailable()) return null;
  plugin ??= registerPlugin<ScreenTimePlugin>('ScreenTime');
  return plugin;
}

function toMessage(err: unknown): string {
  const msg = (err as { message?: unknown } | null)?.message;
  return typeof msg === 'string' && msg ? msg : 'Something went wrong. Please try again.';
}

async function run<T>(fn: (p: ScreenTimePlugin) => Promise<T>): Promise<ScreenTimeResult<T>> {
  const p = getPlugin();
  if (!p) return { ok: false, error: OFF_IOS_MESSAGE };
  try {
    return { ok: true, value: await fn(p) };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function isScreenTimeSupported(): Promise<boolean> {
  const result = await run((p) => p.isSupported());
  return result.ok ? result.value.supported : false;
}

// Never rejects — callers can render off the fallback on any platform.
export async function getScreenTimeStatus(): Promise<ScreenTimeStatus> {
  const result = await run((p) => p.getStatus());
  return result.ok ? result.value : UNSUPPORTED_STATUS;
}

export async function requestScreenTimeAuthorization(): Promise<
  ScreenTimeResult<{ status: ScreenTimeAuthStatus }>
> {
  return run((p) => p.requestAuthorization());
}

export async function presentAppPicker(): Promise<ScreenTimeResult<ScreenTimePickerResult>> {
  return run((p) => p.presentPicker());
}

export async function presentBudgetEditor(): Promise<ScreenTimeResult<{ budgetCount: number }>> {
  return run((p) => p.presentBudgetEditor());
}

export async function showUsageReport(): Promise<ScreenTimeResult<void>> {
  return run((p) => p.showUsageReport());
}

// Inline (in-page) report — native card positioned over a placeholder div.
export async function attachUsageReport(
  rect: UsageReportRect,
  range: UsageReportRange,
): Promise<ScreenTimeResult<void>> {
  return run((p) => p.attachUsageReport({ ...rect, range }));
}

export async function updateUsageReportRect(rect: UsageReportRect): Promise<void> {
  await run((p) => p.updateUsageReportRect(rect));
}

export async function setUsageReportRange(range: UsageReportRange): Promise<void> {
  await run((p) => p.setUsageReportRange({ range }));
}

export async function detachUsageReport(): Promise<void> {
  await run((p) => p.detachUsageReport());
}

// minutes: timed break (auto-lifts via the monitor); omitted = until ended manually
export async function applyShield(minutes?: number): Promise<ScreenTimeResult<void>> {
  return run((p) => p.applyShield(minutes ? { minutes } : {}));
}

export async function clearShield(): Promise<ScreenTimeResult<void>> {
  return run((p) => p.clearShield());
}

export async function disableScreenTime(): Promise<ScreenTimeResult<void>> {
  return run((p) => p.disable());
}
