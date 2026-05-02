# pi.web

A web-based user interface for the [pi coding agent](https://github.com/mariozechner/pi). The web server spawns a pi agent process and communicates with it via stdin/stdout JSONL, providing a browser-based chat interface with real-time streaming, tool call visualization, and session management.

## Architecture

pi.web spawns the pi coding agent as a child process and acts as a bridge between the browser and the agent:

```
+-------------+      WebSocket       +-------------+      stdio JSONL      +-------------+
|   Browser   | <------------------> |  pi-web     | <------------------> |  pi agent   |
|   (React)   |                      |  server     |                      |  (child     |
+-------------+                      |  (bridge)   |                      |   process)  |
                                    +-------------+                      +-------------+
```

The web server:
- Serves the React-based web UI as static files
- Accepts WebSocket connections from browser clients
- Spawns `pi --mode rpc` as a child process
- Translates between WebSocket messages (browser) and JSONL over stdin/stdout (pi agent)
- Handles agent process crashes with automatic restart and exponential backoff

The pi coding agent runs in a separate OS process with its own stdio streams.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- The `pi` CLI available in your `PATH`

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This concurrently runs:
- **Vite dev server** (client HMR on the default Vite port)
- **pi-web server** on port `3142`, which spawns the pi agent in the current working directory

The browser will open automatically. Multiple browser tabs can connect to the same pi-web server and share the same agent session.

## Production

### Build

```bash
npm run build
```

This compiles the server to `dist/server/` and bundles the client to `dist/client/`.

### Start

```bash
npm start -- --cwd /path/to/project
```

Or install globally and use the `pi-web` CLI:

```bash
npm install -g .
pi-web --cwd /path/to/project
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port, -p <number>` | HTTP server port | `3142` |
| `--cwd <path>` | Working directory for the pi agent | Current directory |
| `--no-open` | Don't open browser automatically | `false` |
| `--help, -h` | Show help message | — |

### Examples

```bash
# Run with default settings (agent uses current directory)
pi-web

# Custom project directory
pi-web --cwd ~/projects/my-app

# Custom port, don't open browser
pi-web --port 8080 --cwd ~/projects/my-app --no-open
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_WS_URL` | WebSocket URL the browser connects to in development (set by `npm run dev`) |

## How It Works

### Protocol

The browser and pi-web server communicate using a WebSocket protocol that mirrors `pi --mode rpc`:

- **Commands** (browser → server → agent): `prompt`, `steer`, `follow_up`, `abort`, `set_model`, `set_thinking_level`, `get_state`, `get_messages`
- **Events** (agent → server → browser): `message_start`, `message_update`, `message_end`, `tool_execution_start`, `tool_execution_end`, `agent_start`, `agent_end`, etc.
- **State snapshots**: The server caches the agent's state and serves it to newly connected browser clients

### JSONL Transport

The pi agent speaks a strict JSONL (JSON Lines) protocol over stdin/stdout:

- Records are delimited by `\n` only
- Commands are written to the agent's **stdin**
- Events and responses are read from the agent's **stdout**
- The server handles proper buffering and framing to avoid splitting inside JSON strings

### Process Resilience

If the pi agent process crashes or exits, the web server automatically restarts it with exponential backoff (starting at 1 second, up to 30 seconds). The browser UI stays connected to the web server and resumes receiving events once the agent is back online.

## Project Structure

```
src/
├── server/
│   ├── agent.ts       # Child process manager + JSONL transport for pi agent
│   ├── index.ts       # Express server + WebSocket bridge setup
│   └── websocket.ts   # Browser WebSocket handling + command routing
├── client/
│   ├── App.tsx        # Main React app
│   ├── store.ts       # Agent state store
│   ├── websocket.ts   # Browser WebSocket client
│   └── components/    # UI components (MessageList, InputArea, StatusBar, etc.)
└── shared/
    ├── protocol.ts    # RPC command + response types
    └── events.ts      # Agent event types
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server + pi-web server (spawns pi agent automatically) |
| `npm run build` | Compile server and bundle client for production |
| `npm start` | Run compiled server (pass `--cwd` for agent working directory) |
| `npm run typecheck` | Run TypeScript type checking |
