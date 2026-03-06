import { describe, expect, test } from '@jest/globals';
import { getRouteByHints, getRouteByKey, type SessionRoute } from '../../src/SessionRouting.js';

const routes: SessionRoute[] = [
  {
    key: 'lpmg01:ops',
    host: 'lpmg01',
    role: 'ops',
    target: { sessionId: 'session-ops' },
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
  {
    key: 'lpmg01:logs',
    host: 'lpmg01',
    role: 'logs',
    target: { sessionId: 'session-logs' },
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
  {
    key: 'lpmg02:ops',
    host: 'lpmg02',
    role: 'ops',
    target: { sessionId: 'session-lpmg02-ops' },
    updatedAt: '2026-03-06T00:00:00.000Z',
  },
];

describe('SessionRouting', () => {
  test('getRouteByKey resolves exact route', () => {
    const route = getRouteByKey(routes, 'lpmg01:ops');
    expect(route?.target.sessionId).toBe('session-ops');
  });

  test('getRouteByHints resolves unique host+role', () => {
    const route = getRouteByHints(routes, 'lpmg01', 'logs');
    expect(route?.key).toBe('lpmg01:logs');
  });

  test('getRouteByHints throws on ambiguous host-only match', () => {
    expect(() => getRouteByHints(routes, 'lpmg01', undefined)).toThrow('Multiple session routes matched');
  });

  test('getRouteByHints throws when no match exists', () => {
    expect(() => getRouteByHints(routes, 'missing-host', 'ops')).toThrow('No session route matched');
  });
});

