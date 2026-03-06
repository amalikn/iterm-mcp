import { type ItermSessionTarget } from './ItermTarget.js';

export interface SessionRoute {
  key: string;
  target: ItermSessionTarget;
  host?: string;
  role?: string;
  notes?: string;
  updatedAt: string;
}

function normalizeToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getRouteByKey(routes: SessionRoute[], key: unknown): SessionRoute | undefined {
  const normalizedKey = normalizeToken(key);
  if (!normalizedKey) return undefined;
  return routes.find((r) => r.key === normalizedKey);
}

export function getRouteByHints(routes: SessionRoute[], host: unknown, role: unknown): SessionRoute | undefined {
  const normalizedHost = normalizeToken(host);
  const normalizedRole = normalizeToken(role);

  if (!normalizedHost && !normalizedRole) {
    return undefined;
  }

  const matches = routes.filter((route) => {
    const hostMatch = !normalizedHost || route.host === normalizedHost;
    const roleMatch = !normalizedRole || route.role === normalizedRole;
    return hostMatch && roleMatch;
  });

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(`No session route matched host=${normalizedHost || '*'} role=${normalizedRole || '*'}`);
  }

  const keys = matches.map((m) => m.key).join(', ');
  throw new Error(`Multiple session routes matched host=${normalizedHost || '*'} role=${normalizedRole || '*'} (${keys}). Use routeKey or explicit target.`);
}

export function upsertRoute(
  routes: Map<string, SessionRoute>,
  route: Omit<SessionRoute, 'updatedAt'>
): SessionRoute {
  const saved: SessionRoute = {
    ...route,
    updatedAt: new Date().toISOString(),
  };
  routes.set(route.key, saved);
  return saved;
}

