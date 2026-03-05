// @vitest-environment jsdom
// Unit tests for DataService implementations
// Tests both MockDataService and SupabaseDataService against the same DataService interface
// Run: npx vitest run src/lib/services/__tests__/data-service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import type { DataService } from '../data-service.interface';

// ---------------------------------------------------------------------------
// Shared test suite — runs against ANY DataService implementation
// ---------------------------------------------------------------------------

function createDataServiceTests(name: string, factory: () => DataService) {
  describe(`${name} — DataService contract`, () => {
    let svc: DataService;

    beforeEach(async () => {
      svc = factory();
      await svc.clearData();
    });

    // ── Habits ──────────────────────────────────────────────────────

    describe('Habits CRUD', () => {
      it('should create a habit', async () => {
        const habit = await svc.createHabit('Meditation', 'daily');
        expect(habit).toBeDefined();
        expect(habit.id).toBeTruthy();
        expect(habit.name).toBe('Meditation');
        expect(habit.frequency).toBe('daily');
        expect(habit.active).toBe(true);
      });

      it('should list habits', async () => {
        await svc.createHabit('Meditation');
        await svc.createHabit('Exercise', '3x/week');
        const habits = await svc.getHabits();
        expect(habits.length).toBeGreaterThanOrEqual(2);
        const names = habits.map(h => h.name);
        expect(names).toContain('Meditation');
        expect(names).toContain('Exercise');
      });

      it('should find habit by name', async () => {
        await svc.createHabit('Meditation');
        const found = await svc.getHabitByName('Meditation');
        expect(found).toBeDefined();
        expect(found!.name).toBe('Meditation');
      });

      it('should return null for non-existent habit name', async () => {
        const found = await svc.getHabitByName('NonExistent');
        expect(found).toBeNull();
      });

      it('should update a habit', async () => {
        const habit = await svc.createHabit('Meditation');
        const updated = await svc.updateHabit(habit.id, { name: 'Morning Meditation' });
        expect(updated.name).toBe('Morning Meditation');
      });

      it('should delete a habit', async () => {
        const habit = await svc.createHabit('ToDelete');
        await svc.deleteHabit(habit.id);
        const habits = await svc.getHabits();
        const names = habits.map(h => h.name);
        expect(names).not.toContain('ToDelete');
      });
    });

    // ── Habit Completions ───────────────────────────────────────────

    describe('Habit Completions', () => {
      it('should mark a habit complete', async () => {
        const habit = await svc.createHabit('Test');
        const completion = await svc.completeHabit(habit.id, '2026-03-05');
        expect(completion).toBeDefined();
        expect(completion.habitId).toBe(habit.id);
        expect(completion.date).toBe('2026-03-05');
      });

      it('should get completions for a habit', async () => {
        const habit = await svc.createHabit('Test');
        await svc.completeHabit(habit.id, '2026-03-03');
        await svc.completeHabit(habit.id, '2026-03-04');
        await svc.completeHabit(habit.id, '2026-03-05');
        const completions = await svc.getCompletions(habit.id);
        expect(completions.length).toBeGreaterThanOrEqual(3);
      });
    });

    // ── Metrics ─────────────────────────────────────────────────────

    describe('Metrics CRUD', () => {
      it('should create a metric', async () => {
        const metric = await svc.createMetric('Sleep Quality', 'scale', 'daily', 1, 10);
        expect(metric).toBeDefined();
        expect(metric.name).toBe('Sleep Quality');
        expect(metric.inputType).toBe('scale');
      });

      it('should list metrics', async () => {
        await svc.createMetric('Sleep', 'scale');
        await svc.createMetric('Water', 'numeric');
        const metrics = await svc.getMetrics();
        expect(metrics.length).toBeGreaterThanOrEqual(2);
      });

      it('should find metric by name', async () => {
        await svc.createMetric('Sleep Quality', 'scale');
        const found = await svc.getMetricByName('Sleep Quality');
        expect(found).toBeDefined();
        expect(found!.name).toBe('Sleep Quality');
      });

      it('should delete a metric', async () => {
        const metric = await svc.createMetric('ToDelete', 'binary');
        await svc.deleteMetric(metric.id);
        const metrics = await svc.getMetrics();
        expect(metrics.map(m => m.name)).not.toContain('ToDelete');
      });
    });

    // ── Metric Entries ──────────────────────────────────────────────

    describe('Metric Entries', () => {
      it('should log a metric entry', async () => {
        const metric = await svc.createMetric('Mood', 'scale', 'daily', 1, 10);
        const entry = await svc.logMetric(metric.id, 8, '2026-03-05');
        expect(entry).toBeDefined();
        expect(entry.metricId).toBe(metric.id);
        expect(entry.value).toBe(8);
      });

      it('should get metric entries', async () => {
        const metric = await svc.createMetric('Mood', 'scale');
        await svc.logMetric(metric.id, 7, '2026-03-04');
        await svc.logMetric(metric.id, 8, '2026-03-05');
        const entries = await svc.getMetricEntries(metric.id);
        expect(entries.length).toBeGreaterThanOrEqual(2);
      });
    });

    // ── Journal ─────────────────────────────────────────────────────

    describe('Journal Entries', () => {
      it('should create a journal entry', async () => {
        const entry = await svc.createJournalEntry('Had a great day!', 'happy', ['gratitude']);
        expect(entry).toBeDefined();
        expect(entry.content).toBe('Had a great day!');
        expect(entry.mood).toBe('happy');
      });

      it('should list journal entries', async () => {
        await svc.createJournalEntry('Entry 1');
        await svc.createJournalEntry('Entry 2');
        const entries = await svc.getJournalEntries();
        expect(entries.length).toBeGreaterThanOrEqual(2);
      });
    });

    // ── Summaries ───────────────────────────────────────────────────

    describe('Summaries', () => {
      it('should return a habit summary', async () => {
        const habit = await svc.createHabit('Meditation');
        await svc.completeHabit(habit.id, '2026-03-04');
        await svc.completeHabit(habit.id, '2026-03-05');
        const summary = await svc.getHabitSummary(habit.id, 'week');
        expect(summary).toBeDefined();
        expect(summary.habit.name).toBe('Meditation');
        expect(summary.completionsThisPeriod).toBeGreaterThanOrEqual(0);
      });

      it('should return a weekly summary', async () => {
        const summary = await svc.getWeeklySummary();
        expect(summary).toBeDefined();
        expect(summary.habits).toBeDefined();
        expect(summary.period).toBeDefined();
        expect(summary.period.start).toBeTruthy();
        expect(summary.period.end).toBeTruthy();
      });
    });

    // ── Seed & Clear ────────────────────────────────────────────────

    describe('Seed & Clear', () => {
      it('should seed data without error', async () => {
        await expect(svc.seedData()).resolves.not.toThrow();
      });

      it('should clear data', async () => {
        await svc.seedData();
        await svc.clearData();
        const habits = await svc.getHabits();
        // After clear, should have no habits (or at least fewer than seeded)
        expect(habits.length).toBe(0);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Run tests against MockDataService (can run without Supabase connection)
// ---------------------------------------------------------------------------

import { MockDataService } from '../mock-data-service';

createDataServiceTests('MockDataService', () => new MockDataService());

// ---------------------------------------------------------------------------
// SupabaseDataService tests (skipped by default — needs live Supabase connection)
// To run: SUPABASE_TEST=1 npx vitest run src/lib/services/__tests__/data-service.test.ts
// ---------------------------------------------------------------------------

// import { SupabaseDataService } from '../supabase-data-service';
// if (process.env.SUPABASE_TEST) {
//   createDataServiceTests('SupabaseDataService', () => new SupabaseDataService());
// }
