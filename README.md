# iterm-mcp 
A Model Context Protocol server that provides access to your iTerm session.

![Main Image](.github/images/demo.gif)

### Features

**Efficient Token Use:** iterm-mcp gives the model the ability to inspect only the output that the model is interested in. The model typically only wants to see the last few lines of output even for long running commands. 

**Natural Integration:** You share iTerm with the model. You can ask questions about what's on the screen, or delegate a task to the model and watch as it performs each step.

**Full Terminal Control and REPL support:** The model can start and interact with REPL's as well as send control characters like ctrl-c, ctrl-z, etc.

**Easy on the Dependencies:** iterm-mcp is built with minimal dependencies and is runnable via npx. It's designed to be easy to add to Claude Desktop and other MCP clients. It should just work.


## Safety Considerations

* The user is responsible for using the tool safely.
* No built-in restrictions: iterm-mcp makes no attempt to evaluate the safety of commands that are executed.
* Models can behave in unexpected ways. The user is expected to monitor activity and abort when appropriate.
* For multi-step tasks, you may need to interrupt the model if it goes off track. Start with smaller, focused tasks until you're familiar with how the model behaves. 

### Tools
- `list_sessions` - Lists available iTerm windows/tabs/sessions (window id, tab index/name, session id, tty).
- `select_session` - Sets a default target session for subsequent tool calls (or clears it).
- `list_session_routes` - Lists named host/role routes and their mapped target sessions.
- `set_session_route` - Creates or updates a named route (for example, `lpmg01:ops`) to a target session.
- `remove_session_route` - Removes one route by key.
- `clear_session_routes` - Removes all routes.
- `write_to_terminal` - Writes to the active iTerm terminal, often used to run a command. Returns the number of lines of output produced by the command.
- `read_terminal_output` - Reads the requested number of lines from the active iTerm terminal.
- `send_control_character` - Sends a control character to the active iTerm terminal.

### Session Targeting

You can now target sessions explicitly instead of relying on front/current selection.

Flow:

1. Call `list_sessions` and pick a target.
2. Call `select_session` with either:
   - `sessionId`, or
   - `windowId` (optionally with `tabId`)
3. Use `write_to_terminal`, `read_terminal_output`, and `send_control_character`.
4. Optionally override the selected default by passing per-call target args (`windowId`, `tabId`, `sessionId`).

Rules:

- `sessionId` cannot be combined with `windowId`/`tabId`.
- `tabId` requires `windowId`.
- Route tools support host/role routing across multiple tabs for the same host.
- Target precedence is:
  1. per-call explicit target (`sessionId` or `windowId` + `tabId`)
  2. per-call `routeKey`
  3. selected default session (`select_session`)
  4. route lookup by per-call `host`/`role`
  5. front/current session fallback

Example for two tabs on the same host:

1. Set route `lpmg01:ops` to one tab/session.
2. Set route `lpmg01:logs` to another tab/session.
3. Run calls with `routeKey=lpmg01:ops` or `routeKey=lpmg01:logs`.
4. For one-off manual override, pass explicit `sessionId` in that call.

### Long Command Best Practices

For complex shell programs (especially long `awk`, `sed`, or nested quote payloads), avoid sending one very large `write_to_terminal` call.

Recommended operational pattern:

1. Start a heredoc in the terminal:
   `cat >/tmp/iterm-mcp-job.sh <<'EOF'`
2. Send script contents in multiple small `write_to_terminal` calls.
3. Close heredoc with `EOF`.
4. Execute with `bash /tmp/iterm-mcp-job.sh`.
5. Poll output with `read_terminal_output` using small tail windows (for example, 25 to 200 lines).
6. Use `send_control_character` (`C`) to interrupt long-running work when needed.

Why this works better:

- It reduces AppleScript/shell quoting stress from giant single payloads.
- It makes failures easier to isolate and retry.
- It keeps token usage predictable by reading only the output needed.

Implementation note:

- Multiline command escaping includes shell-safe handling for single quotes.
- Even with this, chunked script delivery is still the most reliable approach for very long commands.

### Requirements

* iTerm2 must be running
* Node version 18 or greater


## Installation

To use with Claude Desktop, add the server config:

On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "iterm-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "iterm-mcp"
      ]
    }
  }
}
```

To use with Codex (`~/.codex/config.toml`), add:

```toml
[mcp_servers.iterm-mcp]
command = "bash"
args = ["-lc", "mkdir -p /Volumes/Data/_ai/mcp-data/iterm-mcp && cd /Volumes/Data/_ai/mcp-data/iterm-mcp && exec npx -y iterm-mcp"]
startup_timeout_sec = 120
```

### Installing via Smithery

To install iTerm for Claude Desktop automatically via [Smithery](https://smithery.ai/server/iterm-mcp):

```bash
npx -y @smithery/cli install iterm-mcp --client claude
```
[![smithery badge](https://smithery.ai/badge/iterm-mcp)](https://smithery.ai/server/iterm-mcp)

## Development

Install dependencies:
```bash
yarn install
```

Build the server:
```bash
yarn run build
```

For development with auto-rebuild:
```bash
yarn run watch
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
yarn run inspector
yarn debug <command>
```

The Inspector will provide a URL to access debugging tools in your browser.

## Enhancement Notes

### 2026-03-06

- Version bump: `1.4.0`.
- Improved multiline command safety in `CommandExecutor` by escaping single quotes in per-line AppleScript string escaping.
- Added explicit session-targeting flow:
  - `list_sessions` to discover targets
  - `select_session` to set default target
  - per-call target args for write/read/control tools
- Added route-based multi-tab targeting:
  - `set_session_route`, `list_session_routes`, `remove_session_route`, `clear_session_routes`
  - route precedence and host/role hint lookup
  - manual per-call override support with explicit targets
- Added runtime `sessionId` resolution to active `windowId`/`tabId` before execution to ensure robust targeted operations.
- Verified live smoke flow:
  - tool discovery includes `list_sessions` and `select_session`
  - targeted write/read by `sessionId` succeeds
  - selected default target read succeeds
- Added `Long Command Best Practices` guidance:
  - use chunked `write_to_terminal` calls
  - prefer heredoc script delivery for complex shell payloads
  - poll output with `read_terminal_output`
  - interrupt with `send_control_character` when required
- Added Codex setup example with persistent MCP data root at `/Volumes/Data/_ai/mcp-data/iterm-mcp`.
