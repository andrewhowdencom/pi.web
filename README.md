# pi.web

A web-based user interface for the [pi coding agent](https://github.com/mariozechner/pi). The web server connects to a running pi agent instance via WebSocket and provides a browser-based chat interface with real-time streaming, tool call visualization, and session management.

## Architecture

pi.web acts as a lightweight proxy and static file server between the browser and an external pi agent:

```
+-------------+      WebSocket       +-------------+      WebSocket       +-------------+
|   Browser   | <------------------> |  pi-web     | <------------------> |  pi agent   |
|   (React)   |                      |  server     |                      |  (external) |
+-------------+                      |  (proxy)    |                      +-------------+
                                    +-------------+
```

The web server:
- Serves the React-based web UI as static files
- Accepts WebSocket connections from browser clients
- Proxies commands and events to/from the external pi agent instance
- Handles reconnection with exponential backoff if the external agent becomes unavailable

The pi coding agent must be running in a separate process with its RPC/WebSocket interface enabled.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A running pi coding agent instance with WebSocket/RPC support

## Installation

```bash
npm install
```

## Development

### 1. Start the external pi agent

In a separate terminal, start the pi coding agent with its RPC server enabled. The exact command depends on your pi setup; for example:

```bash
pi --mode rpc --port 3141
```

This makes the agent available at `ws://localhost:3141`.

### 2. Start the web UI

In another terminal:

```bash
npm run dev
```

This concurrently runs:
- **Vite dev server** (client HMR on the default Vite port)
- **pi-web server** on port `3142`, proxying to the agent at `ws://localhost:3141`

The browser will open automatically. Multiple browser tabs can connect to the same pi-web server and share the same agent session.

## Production

### Build

```bash
npm run build
```

This compiles the server to `dist/server/` and bundles the client to `dist/client/`.

### Start

```bash
npm start -- --agent-url ws://localhost:3141
```

Or install globally and use the `pi-web` CLI:

```bash
npm install -g .
pi-web --agent-url ws://localhost:3141
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--port, -p <number>` | HTTP server port | `3142` |
| `--agent-url <url>` | **Required.** WebSocket URL of the external pi agent | — |
| `--no-open` | Don't open browser automatically | `false` |
| `--help, -h` | Show help message | — |

### Examples

```bash
# Connect to agent on default port, serve web UI on port 3142
pi-web --agent-url ws://localhost:3141

# Custom web server port
pi-web --port 8080 --agent-url ws://localhost:3141

# Don't open browser
pi-web --agent-url ws://localhost:3141 --no-open

# Secure WebSocket (wss)
pi-web --agent-url wss://agent.example.com:443
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_WS_URL` | WebSocket URL the browser connects to in development (set by `npm run dev`) |

## How It Works

### Protocol

The browser and pi-web server communicate using the same JSON message protocol as `pi --mode rpc`:

- **Commands** (browser → server → agent): `prompt`, `steer`, `follow_up`, `abort`, `set_model`, `set_thinking_level`, `get_state`, `get_messages`
- **Events** (agent → server → browser): `message_start`, `message_update`, `message_end`, `tool_execution_start`, `tool_execution_end`, `agent_start`, `agent_end`, etc.
- **State snapshots**: The server caches the agent's state and serves it to newly connected browser clients

### Reconnection

If the external pi agent restarts or becomes temporarily unavailable, the pi-web server automatically reconnects with exponential backoff (starting at 1 second, up to 30 seconds). The browser UI stays connected to the web server and resumes receiving events once the agent is back online.

## Project Structure

```
src/
├── server/
│   ├── agent.ts       # WebSocket client for the external pi agent
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
| `npm run dev` | Start Vite dev server + pi-web server (requires external agent) |
| `npm run build` | Compile server and bundle client for production |
| `npm start` | Run compiled server (requires `--agent-url`) |
| `npm run typecheck` | Run TypeScript type checking |
