import { describe, expect, it } from 'vitest';
import { parseProfileSpeech } from '../parseProfileSpeech';

describe('parseProfileSpeech', () => {
  it('extracts digit age and male gender', () => {
    expect(parseProfileSpeech("I'm 44 and male")).toEqual({ age: 44, gender: 'Male' });
  });

  it('extracts word-number age and female gender', () => {
    expect(parseProfileSpeech('forty four, female')).toEqual({ age: 44, gender: 'Female' });
  });

  it('extracts male gender from guy', () => {
    expect(parseProfileSpeech("I'm a guy")).toEqual({ gender: 'Male' });
  });

  it('extracts age only', () => {
    expect(parseProfileSpeech('44')).toEqual({ age: 44 });
  });

  it('extracts other gender', () => {
    expect(parseProfileSpeech('other')).toEqual({ gender: 'Other' });
  });

  it('does not return gender when male and female tokens both appear', () => {
    expect(parseProfileSpeech('male or female')).toEqual({});
  });

  it('returns no fields for junk', () => {
    expect(parseProfileSpeech('banana spaceship')).toEqual({});
  });
});
