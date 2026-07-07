import { describe, expect, it } from 'vitest';
import { isPathChoiceGrounded } from '../submitPathChoice.js';

describe('isPathChoiceGrounded (G13)', () => {
  describe('delegation turns — must REJECT', () => {
    it('rejects the exact round-3 repro shape: "skip this too, just pick one for me"', () => {
      expect(isPathChoiceGrounded('skip this too, just pick one for me')).toBe(false);
    });

    it('rejects "just pick one"', () => {
      expect(isPathChoiceGrounded('just pick one')).toBe(false);
    });

    it('rejects "you decide"', () => {
      expect(isPathChoiceGrounded('you decide')).toBe(false);
    });

    it('rejects "you choose"', () => {
      expect(isPathChoiceGrounded('you choose')).toBe(false);
    });

    it('rejects "pick for me"', () => {
      expect(isPathChoiceGrounded('pick for me')).toBe(false);
    });

    it('rejects "choose for me"', () => {
      expect(isPathChoiceGrounded('choose for me')).toBe(false);
    });

    it('rejects "doesn\'t matter to me"', () => {
      expect(isPathChoiceGrounded("doesn't matter to me")).toBe(false);
    });

    it('rejects "I don\'t care"', () => {
      expect(isPathChoiceGrounded("I don't care")).toBe(false);
    });

    it('rejects "just go ahead"', () => {
      expect(isPathChoiceGrounded('just go ahead')).toBe(false);
    });

    it('rejects "skip the choice"', () => {
      expect(isPathChoiceGrounded('skip the choice')).toBe(false);
    });

    it('rejects "skip this"', () => {
      expect(isPathChoiceGrounded('skip this')).toBe(false);
    });
  });

  describe('simple/beginner path turns — must PASS with path=simple', () => {
    it('accepts "let\'s do the simple guided one"', () => {
      expect(isPathChoiceGrounded("let's do the simple guided one")).toBe(true);
    });

    it('accepts "I\'m new to this"', () => {
      expect(isPathChoiceGrounded("I'm new to this")).toBe(true);
    });

    it('accepts "I\'ve never tracked habits before"', () => {
      expect(isPathChoiceGrounded("I've never tracked habits before")).toBe(true);
    });

    it('accepts "first time doing something like this"', () => {
      expect(isPathChoiceGrounded('first time doing something like this')).toBe(true);
    });

    it('accepts "I\'m a beginner"', () => {
      expect(isPathChoiceGrounded("I'm a beginner")).toBe(true);
    });

    it('accepts "the guided option sounds good"', () => {
      expect(isPathChoiceGrounded('the guided option sounds good')).toBe(true);
    });

    it('accepts "I\'m not sure yet, recommend the easy one"', () => {
      expect(isPathChoiceGrounded("I'm not sure yet, recommend the easy one")).toBe(true);
    });

    it('accepts "no I haven\'t really tracked anything"', () => {
      expect(isPathChoiceGrounded("no I haven't really tracked anything")).toBe(true);
    });
  });

  describe('braindump/advanced path turns — must PASS with path=braindump', () => {
    it('accepts "I already track my habits, brain dump"', () => {
      expect(isPathChoiceGrounded('I already track my habits, brain dump')).toBe(true);
    });

    it('accepts "I\'ve been tracking for years, go with advanced"', () => {
      expect(isPathChoiceGrounded("I've been tracking for years, go with advanced")).toBe(true);
    });

    it('accepts "I know what I want, brain dump works"', () => {
      expect(isPathChoiceGrounded("I know what I want, brain dump works")).toBe(true);
    });

    it('accepts "already doing habits daily"', () => {
      expect(isPathChoiceGrounded('already doing habits daily')).toBe(true);
    });

    it('accepts "I have existing habits I want to bring in"', () => {
      expect(isPathChoiceGrounded('I have existing habits I want to bring in')).toBe(true);
    });
  });

  describe('bare affirmations — must PASS (coach may have proposed a specific path)', () => {
    it('accepts bare "yes"', () => {
      expect(isPathChoiceGrounded('yes')).toBe(true);
    });

    it('accepts "yes please"', () => {
      expect(isPathChoiceGrounded('yes please')).toBe(true);
    });

    it('accepts "yeah that one"', () => {
      expect(isPathChoiceGrounded('yeah that one')).toBe(true);
    });

    it('accepts "sure"', () => {
      expect(isPathChoiceGrounded('sure')).toBe(true);
    });

    it('accepts "sounds good"', () => {
      expect(isPathChoiceGrounded('sounds good')).toBe(true);
    });

    it('accepts "ok"', () => {
      expect(isPathChoiceGrounded('ok')).toBe(true);
    });

    it('accepts "let\'s do it"', () => {
      expect(isPathChoiceGrounded("let's do it")).toBe(true);
    });
  });

  describe('off-topic turns — must REJECT', () => {
    it('rejects "what time is it?"', () => {
      expect(isPathChoiceGrounded('what time is it?')).toBe(false);
    });

    it('rejects "can we go faster?"', () => {
      expect(isPathChoiceGrounded('can we go faster?')).toBe(false);
    });

    it('rejects "what were you asking?"', () => {
      expect(isPathChoiceGrounded('what were you asking?')).toBe(false);
    });
  });
});
