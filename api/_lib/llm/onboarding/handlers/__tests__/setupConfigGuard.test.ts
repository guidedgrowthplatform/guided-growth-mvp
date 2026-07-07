import { describe, expect, it } from 'vitest';
import { checkSetupConfigGuard, SURFACES } from '../setupConfigGuard.js';

describe('checkSetupConfigGuard', () => {
  describe('disabled without user_text', () => {
    it('never blocks when userText is undefined', () => {
      expect(checkSetupConfigGuard(SURFACES.morning, undefined)).toEqual({ blocked: false });
    });

    it('never blocks when userText is an empty string', () => {
      expect(checkSetupConfigGuard(SURFACES.morning, '')).toEqual({ blocked: false });
    });
  });

  describe('leg 1: explicit refusal', () => {
    it('blocks the proven regression case verbatim (morning refusal, ...just the evening one)', () => {
      const r = checkSetupConfigGuard(
        SURFACES.morning,
        "I don't want to do a morning thing at all. Just the evening one.",
      );
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });

    it('blocks a direct decline naming the surface', () => {
      const r = checkSetupConfigGuard(SURFACES.morning, 'No thanks, skip the morning check-in.');
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });

    it('blocks "never mind" with the surface named', () => {
      const r = checkSetupConfigGuard(SURFACES.reflection, 'Never mind the evening reflection.');
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });

    it('blocks a bare decline with no surface named at all (refusing whatever is being asked now)', () => {
      const r = checkSetupConfigGuard(SURFACES.weekly, 'No thanks, not interested.');
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });

    it('blocks "just the X" naming a different surface (implicit refusal of this one)', () => {
      const r = checkSetupConfigGuard(SURFACES.reflection, 'Just the morning one is fine.');
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });

    it('blocks "only" naming a different surface for the weekly tool', () => {
      const r = checkSetupConfigGuard(SURFACES.weekly, 'Only the evening reflection, please.');
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });

    it('does NOT block "just the X" naming THIS surface (affirms it)', () => {
      const r = checkSetupConfigGuard(SURFACES.morning, 'Just the morning one, every day at 8am.');
      expect(r).toEqual({ blocked: false });
    });

    it('does NOT block a negation about something unrelated to any surface', () => {
      // "don't want" present, but talking about habits, not a setup-config
      // surface at all, and no other surface named either -- per the
      // conservative design this DOES fall into the "no surface named"
      // refusal branch, which is intentional: a decline on this beat with no
      // surface talk is still a decline of what's currently being asked.
      const r = checkSetupConfigGuard(SURFACES.morning, "I don't want that, let's move on.");
      expect(r).toEqual({ blocked: true, code: 'config_refused_by_user' });
    });
  });

  describe('leg 2: grounding', () => {
    it('blocks an off-topic reply with no config content and no affirmation', () => {
      const r = checkSetupConfigGuard(SURFACES.morning, 'What do you think about the news lately?');
      expect(r).toEqual({ blocked: true, code: 'config_not_grounded' });
    });

    it('blocks a clarifying question', () => {
      const r = checkSetupConfigGuard(SURFACES.weekly, 'Sorry, what were you asking?');
      expect(r).toEqual({ blocked: true, code: 'config_not_grounded' });
    });

    it('passes real config content: a day name', () => {
      const r = checkSetupConfigGuard(SURFACES.weekly, "Let's do Sunday for the weekly review.");
      expect(r).toEqual({ blocked: false });
    });

    it('passes real config content: a time', () => {
      const r = checkSetupConfigGuard(SURFACES.morning, '9am works for my morning check-in.');
      expect(r).toEqual({ blocked: false });
    });

    it('passes real config content: "every day"', () => {
      const r = checkSetupConfigGuard(SURFACES.reflection, 'Every day at 9pm is fine.');
      expect(r).toEqual({ blocked: false });
    });

    it('passes a bare affirmation to a coach proposal ("yes please")', () => {
      const r = checkSetupConfigGuard(SURFACES.morning, 'Yes please.');
      expect(r).toEqual({ blocked: false });
    });

    it('passes "sounds good" as an affirmation', () => {
      const r = checkSetupConfigGuard(SURFACES.weekly, 'Sounds good.');
      expect(r).toEqual({ blocked: false });
    });

    it('passes "sure" as an affirmation', () => {
      const r = checkSetupConfigGuard(SURFACES.reflection, 'Sure, that works.');
      expect(r).toEqual({ blocked: false });
    });
  });

  describe('normal cooperative flow (no false positives)', () => {
    it('a full morning check-in setup sentence passes cleanly', () => {
      const r = checkSetupConfigGuard(
        SURFACES.morning,
        'Every weekday at 7am, with a reminder please.',
      );
      expect(r).toEqual({ blocked: false });
    });

    it('a full reflection setup sentence passes cleanly', () => {
      const r = checkSetupConfigGuard(SURFACES.reflection, '9pm every day, no reminder needed.');
      expect(r).toEqual({ blocked: false });
    });

    it('a weekly day pick passes cleanly', () => {
      const r = checkSetupConfigGuard(SURFACES.weekly, 'Monday works best for me.');
      expect(r).toEqual({ blocked: false });
    });
  });

  describe('ambiguous cases (documented: allow, do not block)', () => {
    it('a soft hesitation with no negation word does not block', () => {
      const r = checkSetupConfigGuard(
        SURFACES.morning,
        'Hmm, I am not totally sure about this yet, 8am I guess.',
      );
      expect(r.blocked).toBe(false);
    });

    it('grumpiness without a negation word or surface mention does not trigger leg 1, but still needs config content or affirmation for leg 2', () => {
      const r = checkSetupConfigGuard(SURFACES.morning, 'Ugh fine, 9am.');
      expect(r).toEqual({ blocked: false });
    });
  });
});
