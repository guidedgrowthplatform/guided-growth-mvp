import { describe, it, expect } from 'vitest';
import {
  hashTextSync,
  anonymizeHabit,
  anonymizeJournal,
  anonymizeUser,
  anonymizeNotes,
  anonymizeHabits,
  anonymizeJournals,
} from '../anonymize';

describe('anonymize', () => {

  describe('hashTextSync', () => {
    it('returns consistent hash for same input', () => {
      const h1 = hashTextSync('meditation');
      const h2 = hashTextSync('meditation');
      expect(h1).toBe(h2);
    });

    it('returns different hash for different input', () => {
      const h1 = hashTextSync('meditation');
      const h2 = hashTextSync('exercise');
      expect(h1).not.toBe(h2);
    });

    it('returns specified length', () => {
      expect(hashTextSync('test', 8)).toHaveLength(8);
      expect(hashTextSync('test', 12)).toHaveLength(12);
    });

    it('handles empty string', () => {
      const h = hashTextSync('');
      expect(h).toHaveLength(16);
    });

    it('handles unicode', () => {
      const h = hashTextSync('日本語テスト');
      expect(h).toHaveLength(16);
    });
  });

  describe('anonymizeHabit', () => {
    it('hashes the name, preserves structure', () => {
      const habit = { id: 'abc-123', name: 'Meditation', frequency: 'daily', createdAt: '2026-03-01', active: true };
      const anon = anonymizeHabit(habit);

      expect(anon.id).toBe('abc-123');
      expect(anon.name).toMatch(/^habit_[0-9a-f]{16}$/);
      expect(anon.name).not.toContain('Meditation');
      expect(anon.frequency).toBe('daily');
      expect(anon.createdAt).toBe('2026-03-01');
      expect(anon.active).toBe(true);
    });

    it('produces same hash for same name', () => {
      const h1 = anonymizeHabit({ id: '1', name: 'yoga' });
      const h2 = anonymizeHabit({ id: '2', name: 'yoga' });
      expect(h1.name).toBe(h2.name);
    });

    it('produces different hash for different names', () => {
      const h1 = anonymizeHabit({ id: '1', name: 'yoga' });
      const h2 = anonymizeHabit({ id: '2', name: 'running' });
      expect(h1.name).not.toBe(h2.name);
    });
  });

  describe('anonymizeJournal', () => {
    it('hashes content, preserves mood/themes', () => {
      const entry = {
        id: 'j-1',
        content: 'I feel great today and very productive',
        mood: 'happy',
        themes: ['productivity', 'wellness'],
        date: '2026-03-01',
      };
      const anon = anonymizeJournal(entry);

      expect(anon.id).toBe('j-1');
      expect(anon.content).toMatch(/^journal_[0-9a-f]{16}$/);
      expect(anon.content).not.toContain('great');
      expect(anon.content).not.toContain('productive');
      expect(anon.mood).toBe('happy');
      expect(anon.themes).toEqual(['productivity', 'wellness']);
      expect(anon.date).toBe('2026-03-01');
    });
  });

  describe('anonymizeUser', () => {
    it('hashes email and nickname', () => {
      const user = {
        id: 'u-1',
        email: 'test@example.com',
        nickname: 'JohnDoe',
        age_group: '25_29',
        gender: 'male',
        language: 'en',
      };
      const anon = anonymizeUser(user);

      expect(anon.id).toBe('u-1');
      expect(anon.email).toMatch(/^user_[0-9a-f]{16}@anon$/);
      expect(anon.email).not.toContain('test@example.com');
      expect(anon.nickname).toMatch(/^anon_[0-9a-f]{16}$/);
      expect(anon.nickname).not.toContain('JohnDoe');
      expect(anon.ageGroup).toBe('25_29');
      expect(anon.gender).toBe('male');
      expect(anon.language).toBe('en');
    });
  });

  describe('anonymizeNotes', () => {
    it('hashes non-null notes', () => {
      const anon = anonymizeNotes('This is a private note');
      expect(anon).toMatch(/^note_[0-9a-f]{16}$/);
      expect(anon).not.toContain('private');
    });

    it('returns null for null/undefined', () => {
      expect(anonymizeNotes(null)).toBeNull();
      expect(anonymizeNotes(undefined)).toBeNull();
      expect(anonymizeNotes('')).toBeNull();
    });
  });

  describe('batch anonymizers', () => {
    it('anonymizeHabits processes array', () => {
      const habits = [
        { id: '1', name: 'meditation' },
        { id: '2', name: 'exercise' },
        { id: '3', name: 'reading' },
      ];
      const anon = anonymizeHabits(habits);
      expect(anon).toHaveLength(3);
      anon.forEach(h => {
        expect(h.name).toMatch(/^habit_[0-9a-f]{16}$/);
      });
    });

    it('anonymizeJournals processes array', () => {
      const entries = [
        { id: '1', content: 'Day 1 entry', date: '2026-03-01' },
        { id: '2', content: 'Day 2 entry', date: '2026-03-02' },
      ];
      const anon = anonymizeJournals(entries);
      expect(anon).toHaveLength(2);
      anon.forEach(e => {
        expect(e.content).toMatch(/^journal_[0-9a-f]{16}$/);
      });
    });
  });
});
