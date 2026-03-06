export interface ItermSessionTarget {
  windowId?: number;
  tabId?: number;
  sessionId?: string;
}

export function validateItermSessionTarget(target?: ItermSessionTarget): void {
  if (!target) return;

  const hasSessionId = typeof target.sessionId === 'string' && target.sessionId.length > 0;
  const hasWindowId = Number.isInteger(target.windowId);
  const hasTabId = Number.isInteger(target.tabId);

  if (hasSessionId && (hasWindowId || hasTabId)) {
    throw new Error('sessionId cannot be combined with windowId/tabId');
  }

  if (hasTabId && !hasWindowId) {
    throw new Error('tabId requires windowId');
  }
}

function escapeForAppleScriptStringLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildSessionReference(target?: ItermSessionTarget): string {
  validateItermSessionTarget(target);

  if (target?.sessionId) {
    return `first session whose id is "${escapeForAppleScriptStringLiteral(target.sessionId)}"`;
  }

  if (Number.isInteger(target?.windowId) && Number.isInteger(target?.tabId)) {
    return `current session of tab ${target!.tabId} of window id ${target!.windowId}`;
  }

  if (Number.isInteger(target?.windowId)) {
    return `current session of current tab of window id ${target!.windowId}`;
  }

  return 'current session of current tab of current window';
}

