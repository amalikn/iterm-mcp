#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import CommandExecutor from "./CommandExecutor.js";
import TtyOutputReader from "./TtyOutputReader.js";
import SendControlCharacter from "./SendControlCharacter.js";
import ItermSessions from "./ItermSessions.js";
import { type ItermSessionTarget, validateItermSessionTarget } from "./ItermTarget.js";

const server = new Server(
  {
    name: "iterm-mcp",
    version: "1.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let selectedSessionTarget: ItermSessionTarget | undefined = undefined;

function getTargetFromArgs(args: any): ItermSessionTarget | undefined {
  const target: ItermSessionTarget = {};
  if (typeof args?.sessionId === 'string' && args.sessionId.length > 0) {
    target.sessionId = args.sessionId;
  }
  if (Number.isInteger(args?.windowId)) {
    target.windowId = Number(args.windowId);
  }
  if (Number.isInteger(args?.tabId)) {
    target.tabId = Number(args.tabId);
  }

  if (!target.sessionId && !target.windowId && !target.tabId) {
    return undefined;
  }

  validateItermSessionTarget(target);
  return target;
}

function getEffectiveTarget(args: any): ItermSessionTarget | undefined {
  const explicit = getTargetFromArgs(args);
  return explicit || selectedSessionTarget;
}

async function resolveExecutionTarget(target?: ItermSessionTarget): Promise<ItermSessionTarget | undefined> {
  if (!target?.sessionId) return target;

  const sessions = await ItermSessions.list();
  const matched = sessions.find((s) => s.sessionId === target.sessionId);
  if (!matched) {
    throw new Error(`Unable to resolve sessionId ${target.sessionId} to an active window/tab`);
  }

  return {
    windowId: matched.windowId,
    tabId: matched.tabIndex,
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_sessions",
        description: "Lists available iTerm sessions with window/tab/session identifiers and tty details",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "select_session",
        description: "Selects a default iTerm session target for subsequent calls. Per-call target args still override this default.",
        inputSchema: {
          type: "object",
          properties: {
            windowId: {
              type: "integer",
              description: "Target window id"
            },
            tabId: {
              type: "integer",
              description: "Target tab index (requires windowId)"
            },
            sessionId: {
              type: "string",
              description: "Target session id (cannot be combined with windowId/tabId)"
            },
            clear: {
              type: "boolean",
              description: "Clear selected session target"
            }
          }
        }
      },
      {
        name: "write_to_terminal",
        description: "Writes text to the active iTerm terminal - often used to run a command in the terminal",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The command to run or text to write to the terminal"
            },
            windowId: {
              type: "integer",
              description: "Target window id"
            },
            tabId: {
              type: "integer",
              description: "Target tab index (requires windowId)"
            },
            sessionId: {
              type: "string",
              description: "Target session id (cannot be combined with windowId/tabId)"
            }
          },
          required: ["command"]
        }
      },
      {
        name: "read_terminal_output",
        description: "Reads the output from the active iTerm terminal",
        inputSchema: {
          type: "object",
          properties: {
            linesOfOutput: {
              type: "integer",
              description: "The number of lines of output to read."
            },
            windowId: {
              type: "integer",
              description: "Target window id"
            },
            tabId: {
              type: "integer",
              description: "Target tab index (requires windowId)"
            },
            sessionId: {
              type: "string",
              description: "Target session id (cannot be combined with windowId/tabId)"
            }
          },
          required: ["linesOfOutput"]
        }
      },
      {
        name: "send_control_character",
        description: "Sends a control character to the active iTerm terminal (e.g., Control-C, or special sequences like ']' for telnet escape)",
        inputSchema: {
          type: "object",
          properties: {
            letter: {
              type: "string",
              description: "The letter corresponding to the control character (e.g., 'C' for Control-C, ']' for telnet escape)"
            },
            windowId: {
              type: "integer",
              description: "Target window id"
            },
            tabId: {
              type: "integer",
              description: "Target tab index (requires windowId)"
            },
            sessionId: {
              type: "string",
              description: "Target session id (cannot be combined with windowId/tabId)"
            }
          },
          required: ["letter"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "list_sessions": {
      const sessions = await ItermSessions.list();
      const selected = selectedSessionTarget || null;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            selectedTarget: selected,
            sessions
          }, null, 2)
        }]
      };
    }
    case "select_session": {
      const args = request.params.arguments || {};
      const clear = Boolean(args.clear);

      if (clear) {
        selectedSessionTarget = undefined;
        return {
          content: [{
            type: "text",
            text: "Cleared selected session target."
          }]
        };
      }

      const target = getTargetFromArgs(args);
      if (!target) {
        throw new Error("select_session requires one of sessionId or windowId (with optional tabId), or clear=true");
      }

      selectedSessionTarget = target;
      return {
        content: [{
          type: "text",
          text: `Selected session target: ${JSON.stringify(selectedSessionTarget)}`
        }]
      };
    }
    case "write_to_terminal": {
      let executor = new CommandExecutor();
      const command = String(request.params.arguments?.command);
      const target = await resolveExecutionTarget(getEffectiveTarget(request.params.arguments));
      const beforeCommandBuffer = await TtyOutputReader.retrieveBuffer(target);
      const beforeCommandBufferLines = beforeCommandBuffer.split("\n").length;
      
      await executor.executeCommand(command, target);
      
      const afterCommandBuffer = await TtyOutputReader.retrieveBuffer(target);
      const afterCommandBufferLines = afterCommandBuffer.split("\n").length;
      const outputLines = afterCommandBufferLines - beforeCommandBufferLines

      return {
        content: [{
          type: "text",
          text: `${outputLines} lines were output after sending the command to the terminal. Read the last ${outputLines} lines of terminal contents to orient yourself. Never assume that the command was executed or that it was successful. Target: ${target ? JSON.stringify(target) : "front/current session"}`
        }]
      };
    }
    case "read_terminal_output": {
      const linesOfOutput = Number(request.params.arguments?.linesOfOutput) || 25
      const target = await resolveExecutionTarget(getEffectiveTarget(request.params.arguments));
      const output = await TtyOutputReader.call(linesOfOutput, target)

      return {
        content: [{
          type: "text",
          text: output
        }]
      };
    }
    case "send_control_character": {
      const ttyControl = new SendControlCharacter();
      const letter = String(request.params.arguments?.letter);
      const target = await resolveExecutionTarget(getEffectiveTarget(request.params.arguments));
      await ttyControl.send(letter, target);
      
      return {
        content: [{
          type: "text",
          text: `Sent control character: Control-${letter.toUpperCase()} (${target ? JSON.stringify(target) : "front/current session"})`
        }]
      };
    }
    default:
      throw new Error("Unknown tool");
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
