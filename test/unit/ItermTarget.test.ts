import { describe, expect, test } from '@jest/globals';
import { buildSessionReference, validateItermSessionTarget } from '../../src/ItermTarget.js';

describe('ItermTarget', () => {
  test('buildSessionReference defaults to current session of current window', () => {
    expect(buildSessionReference()).toBe('current session of current tab of current window');
  });

  test('buildSessionReference with sessionId', () => {
    expect(buildSessionReference({ sessionId: 'abc123' })).toContain('first session whose id is "abc123"');
  });

  test('buildSessionReference with window and tab', () => {
    expect(buildSessionReference({ windowId: 100, tabId: 2 })).toBe('current session of tab 2 of window id 100');
  });

  test('validate rejects sessionId mixed with window/tab', () => {
    expect(() => validateItermSessionTarget({ sessionId: 'abc', windowId: 1 })).toThrow(
      'sessionId cannot be combined with windowId/tabId'
    );
  });

  test('validate rejects tab without window', () => {
    expect(() => validateItermSessionTarget({ tabId: 2 })).toThrow('tabId requires windowId');
  });
});

