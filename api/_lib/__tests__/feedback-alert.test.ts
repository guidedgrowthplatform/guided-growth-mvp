import { describe, it, expect } from 'vitest';
import { renderFeedbackAlert } from '../email-templates/feedback-alert';

const BASE = {
  text: 'The new layout feels great',
  userEmail: 'user@example.com',
  submittedAt: '2026-04-20T12:00:00.000Z',
} as const;

describe('renderFeedbackAlert', () => {
  it('renders each sentiment with a matching subject label', () => {
    const love = renderFeedbackAlert({ ...BASE, sentiment: 'love' });
    expect(love.subject).toContain('Loves it');
    expect(love.subject).toContain('user@example.com');

    const ok = renderFeedbackAlert({ ...BASE, sentiment: 'ok' });
    expect(ok.subject).toContain('OK');

    const needs = renderFeedbackAlert({ ...BASE, sentiment: 'needs-work' });
    expect(needs.subject).toContain('Needs work');
  });

  it('escapes HTML-sensitive characters in the feedback text', () => {
    const { html } = renderFeedbackAlert({
      ...BASE,
      sentiment: 'love',
      text: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes the user email in html output', () => {
    const { html } = renderFeedbackAlert({
      ...BASE,
      sentiment: 'ok',
      userEmail: 'evil"<img>@example.com',
    });
    expect(html).not.toContain('evil"<img>');
    expect(html).toContain('evil&quot;&lt;img&gt;@example.com');
  });

  it('converts newlines to <br> in html but keeps them in plain text', () => {
    const { html, text } = renderFeedbackAlert({
      ...BASE,
      sentiment: 'love',
      text: 'line one\nline two',
    });
    expect(html).toContain('line one<br>line two');
    expect(text).toContain('line one\nline two');
  });

  it('plain text variant contains no template-injected HTML (doctype, <br>, etc.)', () => {
    const { text } = renderFeedbackAlert({
      ...BASE,
      sentiment: 'love',
      text: 'normal feedback text',
    });
    expect(text).not.toContain('<br>');
    expect(text).not.toContain('<html');
    expect(text).not.toContain('<!doctype');
    expect(text).not.toContain('<body');
  });

  it('shows "(no text)" when feedback text is empty', () => {
    const { html, text } = renderFeedbackAlert({
      ...BASE,
      sentiment: 'ok',
      text: '',
    });
    expect(html).toContain('(no text)');
    expect(text).toContain('(no text)');
  });
});
