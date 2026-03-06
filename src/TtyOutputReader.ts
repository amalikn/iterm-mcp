import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { buildSessionReference, type ItermSessionTarget } from './ItermTarget.js';

const execPromise = promisify(exec);

export default class TtyOutputReader {
  static async call(linesOfOutput?: number, target?: ItermSessionTarget) {
    const buffer = await this.retrieveBuffer(target);
    if (!linesOfOutput) {
      return buffer;
    }
    const lines = buffer.split('\n');
    return lines.slice(-linesOfOutput - 1).join('\n');
  }

  static async retrieveBuffer(target?: ItermSessionTarget): Promise<string> {
    const sessionRef = buildSessionReference(target);
    const ascript = `
      tell application "iTerm2"
        tell ${sessionRef}
          set numRows to number of rows
          set allContent to contents
          return allContent
        end tell
      end tell
    `;
    
    const escapedAscript = ascript.replace(/'/g, "'\\''");
    const { stdout: finalContent } = await execPromise(`osascript -e '${escapedAscript}'`);
    return finalContent.trim();
  }
}
