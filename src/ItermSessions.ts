import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

export interface ItermSessionInfo {
  windowId: number;
  windowIndex: number;
  tabIndex: number;
  tabName: string;
  sessionId: string;
  tty: string;
}

export default class ItermSessions {
  static async list(): Promise<ItermSessionInfo[]> {
    const delimiter = String.fromCharCode(31);
    const ascript = `
      tell application "iTerm2"
        set allRows to {}
        repeat with w in windows
          set wid to id of w
          set widx to index of w
          set tabCount to count of tabs of w
          repeat with ti from 1 to tabCount
            set t to tab ti of w
            set tidx to ti
            set tname to ""
            try
              set tname to name of t
            end try
            set sessionCount to count of sessions of t
            repeat with si from 1 to sessionCount
              set s to session si of t
              set sid to id of s
              set stty to ""
              try
                set stty to tty of s
              end try
              set row to (wid as string) & (ASCII character 31) & (widx as string) & (ASCII character 31) & (tidx as string) & (ASCII character 31) & tname & (ASCII character 31) & (sid as string) & (ASCII character 31) & stty
              copy row to end of allRows
            end repeat
          end repeat
        end repeat
        set outText to ""
        set rowCount to count of allRows
        repeat with i from 1 to rowCount
          set outText to outText & (item i of allRows)
          if i is not rowCount then
            set outText to outText & linefeed
          end if
        end repeat
        return outText
      end tell
    `;

    const escapedAscript = ascript.replace(/'/g, "'\\''");
    const { stdout } = await execPromise(`osascript -e '${escapedAscript}'`);

    const lines = stdout.trim() ? stdout.trim().split('\n') : [];
    return lines
      .map((line) => line.split(delimiter))
      .filter((parts) => parts.length >= 6)
      .map((parts) => ({
        windowId: Number(parts[0]) || 0,
        windowIndex: Number(parts[1]) || 0,
        tabIndex: Number(parts[2]) || 0,
        tabName: parts[3] || '',
        sessionId: parts[4] || '',
        tty: parts[5] || '',
      }));
  }
}
