import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  ScreenTimeBandTransition,
  ScreenTimeBoundary,
  ScreenTimeBoundaryState,
} from '@gg/shared/types/screentime';

// Digital-wellbeing feature. iOS: Apple Screen Time APIs (FamilyControls) —
// app names never reach JS (native picker/report render them). Android:
// UsageStatsManager — real names/icons DO reach JS to render our own picker
// and usage list, but they never leave the device (coach-data-contract.md).

export type ScreenTimeAuthStatus = 'notDetermined' | 'denied' | 'approved';

export interface ScreenTimeStatus {
  supported: boolean;
  status: ScreenTimeAuthStatus;
  hasSelection: boolean;
  applicationCount: number;
  categoryCount: number;
  budgetCount: number;
  shieldActive: boolean;
  /** Epoch seconds the current break auto-lifts at (0 = no active break). */
  breakEndsAt?: number;
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

export type ScreenTimePlatform = 'ios' | 'android' | 'web';

// Android-only shapes (real names/icons — on-device rendering only)
export interface AndroidInstalledApp {
  packageName: string;
  label: string;
  icon?: string; // data:image/png;base64 URL
}

export interface AndroidUsageRow {
  packageName: string;
  label: string;
  minutes: number;
  icon?: string; // data:image/png;base64 URL — on-device rendering only
}

export interface AndroidUsage {
  apps: AndroidUsageRow[];
  totalMinutes: number;
  hourly?: number[]; // today only — 24 per-hour minute buckets
  yesterdayTotalMinutes?: number; // today only
  daily?: number[]; // week only — 7 day totals, oldest first
}

export interface AndroidBudgetInput {
  id?: string; // omit for new — native mints a UUID (ids must stay name-free)
  packageName: string;
  minutes: number;
}

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
  getBoundaryStates(): Promise<{
    boundaries: ScreenTimeBoundary[];
    states: ScreenTimeBoundaryState[];
  }>;
  drainBoundaryTransitions(): Promise<{ transitions: ScreenTimeBandTransition[] }>;
  applyShield(opts?: { minutes?: number }): Promise<void>;
  clearShield(): Promise<void>;
  disable(): Promise<void>;
  // Android-only
  getInstalledApps(): Promise<{ apps: AndroidInstalledApp[] }>;
  setSelection(opts: { packageNames: string[] }): Promise<{ applicationCount: number }>;
  getSelection(): Promise<{ packageNames: string[] }>;
  setBudgets(opts: { budgets: AndroidBudgetInput[] }): Promise<{ budgetCount: number }>;
  getBudgets(): Promise<{ budgets: Required<AndroidBudgetInput>[] }>;
  getUsage(opts: { range: UsageReportRange }): Promise<AndroidUsage & { range: UsageReportRange }>;
}

const OFF_NATIVE_MESSAGE = 'Screen Time is available in the mobile app.';

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

export function getScreenTimePlatform(): ScreenTimePlatform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

export function isScreenTimeAvailable(): boolean {
  return getScreenTimePlatform() !== 'web';
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
  if (!p) return { ok: false, error: OFF_NATIVE_MESSAGE };
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

// Coach data contract (docs/screentime/coach-data-contract.md) — bands, never
// minutes. Both fall back to empty off-iOS so callers need no platform checks.
export async function getBoundaryStates(): Promise<{
  boundaries: ScreenTimeBoundary[];
  states: ScreenTimeBoundaryState[];
}> {
  const result = await run((p) => p.getBoundaryStates());
  return result.ok ? result.value : { boundaries: [], states: [] };
}

// Destructive read: native clears its journal. Callers must log every entry
// (logEvent is write-ahead local, so a failed POST still retries).
export async function drainBoundaryTransitions(): Promise<ScreenTimeBandTransition[]> {
  const result = await run((p) => p.drainBoundaryTransitions());
  return result.ok ? result.value.transitions : [];
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

// ── Android-only (names/icons stay on-device) ──

export async function getInstalledApps(): Promise<ScreenTimeResult<AndroidInstalledApp[]>> {
  const result = await run((p) => p.getInstalledApps());
  return result.ok ? { ok: true, value: result.value.apps } : result;
}

export async function setAppSelection(
  packageNames: string[],
): Promise<ScreenTimeResult<{ applicationCount: number }>> {
  return run((p) => p.setSelection({ packageNames }));
}

export async function getAppSelection(): Promise<string[]> {
  const result = await run((p) => p.getSelection());
  return result.ok ? result.value.packageNames : [];
}

export async function setAppBudgets(
  budgets: AndroidBudgetInput[],
): Promise<ScreenTimeResult<{ budgetCount: number }>> {
  return run((p) => p.setBudgets({ budgets }));
}

export async function getAppBudgets(): Promise<Required<AndroidBudgetInput>[]> {
  const result = await run((p) => p.getBudgets());
  return result.ok ? result.value.budgets : [];
}

export async function getAndroidUsage(
  range: UsageReportRange,
): Promise<ScreenTimeResult<AndroidUsage>> {
  return run((p) => p.getUsage({ range }));
}
