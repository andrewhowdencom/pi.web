# Plan: Create Pi Web UI

## Objective

Create a minimal web-based user interface for the pi coding agent. A single shared server embeds the pi SDK and exposes the existing RPC protocol over WebSocket. The web UI is purely static client-side files that connect to the server and speak the same protocol. This architecture avoids per-UI backends — the server is the only process that embeds the agent.

## Context

- **Repository**: `pi.web` is minimal — only `README.md` and `LICENSE`. Greenfield project.
- **SDK**: `@mariozechner/pi-coding-agent` provides `createAgentSession()`, event streaming, tools, session management.
- **RPC Protocol**: `pi --mode rpc` defines a complete JSONL protocol (commands like `prompt`, `steer`, `abort`, `set_model`, and events like `message_update`, `tool_execution_start`). These message shapes are well-documented and battle-tested.
- **No existing web primitives**: The TUI (`@mariozechner/pi-tui`) is terminal-only. The web UI is built from scratch, but the protocol layer is reused entirely.

## Architectural Blueprint

### Two Artifacts

| Artifact | What It Is | Embeds SDK? | Runs As |
|----------|-----------|-------------|---------|
| **Shared Agent Server** | Node.js/TypeScript app | Yes | `node dist/server.js` |
| **Web UI** | Static HTML/CSS/JS | No | Served by any static file server |

### Shared Agent Server

A single Node.js process that:
1. Embeds `@mariozechner/pi-coding-agent` via `createAgentSession()`
2. Listens on a WebSocket port for client connections
3. Speaks the **existing pi RPC protocol** over WebSocket instead of stdio
4. Optionally serves the Web UI static files via Express `express.static()`
5. Broadcasts agent events to all connected clients
6. Routes command responses back to the originating client using the `id` field

### Web UI

Purely client-side:
- React (or vanilla JS) app bundled to static files
- Opens `new WebSocket('ws://localhost:<port>')` on load
- Sends RPC commands (`prompt`, `steer`, `abort`, etc.) as JSON over WebSocket
- Renders events (`message_update`, `tool_execution_start`, etc.) into the DOM
- No backend code, no API routes, no session logic

### Why Reuse the RPC Protocol?

- The message shapes already cover every interaction: prompting, steering, aborting, model switching, thinking levels, compaction, session management, tool execution, streaming text, etc.
- The `RpcClient` class in the SDK already types these messages — we can reuse the type definitions even if not the stdio transport.
- Future adapters (Slack, Telegram) speak the same protocol without translation layers.
- Less design work, fewer bugs, familiar to anyone who knows `pi --mode rpc`.

### Multiplexing: stdio RPC → WebSocket

The stdio RPC mode is 1:1 (one client process, one pi process). WebSocket is N:1 (many browser tabs, one server). The adaptation is minimal:

- **Commands**: Client sends `{ id: "req-1", type: "prompt", message: "..." }`. The server forwards to the SDK. When the SDK responds, the server routes the response back to the client that sent `id: "req-1"`.
- **Events**: SDK events (`message_update`, `tool_execution_start`, etc.) have no `id`. The server broadcasts them to all connected clients. All clients see the same agent state.
- **Shared session**: All clients share one `AgentSession`. If any client sends a prompt, all clients see the response stream in.

## Requirements

1. Single shared server process embeds the pi SDK [explicit]
2. Server exposes the existing RPC protocol over WebSocket [explicit]
3. Web UI is purely static client-side files [explicit]
4. Server optionally serves the static files [explicit]
5. Single CLI entry point starts the server and opens the browser [explicit]
6. Real-time streaming of assistant responses in the web UI [inferred]
7. Display tool calls and results in the web UI [inferred]
8. Support prompt, steer, followUp, and abort from the web UI [inferred]
9. Show model, session, and connection status [inferred]
10. Support model switching and thinking level selection [inferred]

## Task Breakdown

### Task 1: Initialize Project Structure
- **Goal**: Set up package.json, TypeScript config, directory layout.
- **Dependencies**: None
- **Files Affected**: None
- **New Files**:
  - `package.json` — dependencies: `@mariozechner/pi-coding-agent`, `ws`, `express`, `open`, `react`, `react-dom`, `vite` (dev)
  - `tsconfig.json` — TypeScript for server (Node ESM) and client (Vite)
  - `vite.config.ts` — Vite config for client bundling
  - `.gitignore`
  - `src/server/`, `src/client/`, `src/shared/`
- **Details**: Single package, `type: "module"`. Server code in `src/server/`, client code in `src/client/`, shared protocol types in `src/shared/`. Use `tsx` for dev server execution.

### Task 2: Shared Server — SDK Agent Wrapper
- **Goal**: Create the core service that initializes the pi `AgentSession` via `createAgentSession()`.
- **Dependencies**: Task 1
- **Files Affected**: None
- **New Files**:
  - `src/server/agent.ts` — `AgentService` class
- **Interfaces**:
  ```typescript
  class AgentService {
    async initialize(): Promise<void>;
    async prompt(message: string, options?: PromptOptions): Promise<void>;
    async steer(message: string): Promise<void>;
    async followUp(message: string): Promise<void>;
    async abort(): Promise<void>;
    async setModel(provider: string, modelId: string): Promise<void>;
    async setThinkingLevel(level: string): Promise<void>;
    getState(): AgentStateSnapshot;
    onEvent(callback: (event: AgentSessionEvent) => void): () => void;
  }
  ```
- **Details**: Use `createAgentSession()` with `SessionManager.create(cwd)` for persistence. Subscribe to all `AgentSessionEvent`s and forward to registered callbacks. Use `AuthStorage.create()` and `ModelRegistry.create()` for standard auth and model resolution. Keep this thin — just a wrapper around the SDK that exposes async methods matching the RPC protocol commands.

### Task 3: Shared Server — WebSocket + RPC Protocol Bridge
- **Goal**: Create the WebSocket server that accepts client connections, speaks the pi RPC protocol, and routes messages between clients and the `AgentService`.
- **Dependencies**: Task 2
- **Files Affected**: None
- **New Files**:
  - `src/server/websocket.ts` — WebSocket server setup
  - `src/server/index.ts` — Express app + WebSocket + static file serving
- **Details**:
  - Use the `ws` library alongside Express.
  - On client connect, add to a `Set<WebSocket>`.
  - On client message: parse JSON, validate it's a known RPC command shape, forward to `AgentService`.
  - Track command `id` → `WebSocket` mapping so responses route back to the sender.
  - On SDK event: broadcast JSON event to all connected clients.
  - Serve `dist/client/` via `express.static()` for convenience.
  - Handle disconnect cleanup.

### Task 4: Define Shared Protocol Types
- **Goal**: Create TypeScript type definitions for the RPC protocol messages, shared between server and client.
- **Dependencies**: Task 1
- **Files Affected**: None
- **New Files**:
  - `src/shared/protocol.ts` — RPC command types (client → server)
  - `src/shared/events.ts` — RPC event types (server → client)
- **Details**: Define types matching the pi RPC protocol exactly. Use discriminated unions. Types only — no runtime code. Examples:
  ```typescript
  type RpcCommand =
    | { id?: string; type: "prompt"; message: string; streamingBehavior?: "steer" | "followUp" }
    | { id?: string; type: "steer"; message: string }
    | { id?: string; type: "follow_up"; message: string }
    | { id?: string; type: "abort" }
    | { id?: string; type: "get_state" }
    | { id?: string; type: "set_model"; provider: string; modelId: string }
    | { id?: string; type: "set_thinking_level"; level: string };
  ```
  Events mirror `AgentSessionEvent` from the SDK but are serializable JSON.

### Task 5: Client — WebSocket Connection and State Management
- **Goal**: Create the client's WebSocket connection logic and a lightweight state store.
- **Dependencies**: Task 4
- **Files Affected**: None
- **New Files**:
  - `src/client/websocket.ts` — WebSocket client wrapper
  - `src/client/store.ts` — Simple state store (or React context + reducer)
- **Interfaces**:
  ```typescript
  interface AgentStore {
    connected: boolean;
    messages: DisplayMessage[];
    isStreaming: boolean;
    state: AgentStateSnapshot | null;
    sendCommand(cmd: RpcCommand): void;
  }
  ```
- **Details**: `websocket.ts` opens the WebSocket, handles reconnect with exponential backoff, parses incoming messages as events, and sends outgoing commands. `store.ts` maintains the message list, streaming state, and agent state. Use a simple approach — custom event emitter or React `useReducer` + Context, no heavy state library needed.

### Task 6: Client — Message Display Components
- **Goal**: Render agent events into the DOM as chat messages.
- **Dependencies**: Task 5
- **Files Affected**: None
- **New Files**:
  - `src/client/components/MessageList.tsx` — Scrollable container
  - `src/client/components/UserMessage.tsx` — User prompt display
  - `src/client/components/AssistantMessage.tsx` — Streaming assistant text
  - `src/client/components/ToolCall.tsx` — Tool call display
  - `src/client/components/ToolResult.tsx` — Tool result display
- **Details**: `MessageList` auto-scrolls to bottom. `AssistantMessage` renders partial text as `text_delta` events arrive. Tool calls show name + arguments in a collapsible block. Tool results show output with `<pre>` formatting for text. Keep styling minimal — CSS file, no CSS-in-JS library.

### Task 7: Client — Input and Status Bar
- **Goal**: Prompt input area and status display.
- **Dependencies**: Task 5
- **Files Affected**: None
- **New Files**:
  - `src/client/components/InputArea.tsx` — Textarea + send/steer/abort buttons
  - `src/client/components/StatusBar.tsx` — Connection status, model, session
- **Details**: `InputArea`: Enter sends, Shift+Enter newline. Show "Steer" button when streaming (sends `steer` command). Show "Abort" button when streaming. `StatusBar`: green/red dot for connection, current model name, session name, context usage if available.

### Task 8: CLI Entry Point
- **Goal**: Single command that starts the server, serves static files, and opens the browser.
- **Dependencies**: Tasks 3, 6, 7
- **Files Affected**: None
- **New Files**:
  - `src/cli.ts` — Entry point
- **Details**: Parse `process.argv` for optional `--port`, `--ws-port`, `--no-open`, `--cwd`. Default: find an available port for HTTP and WebSocket. Start the shared server. If `--no-open` is not set, use the `open` package to launch the default browser at `http://localhost:<http-port>`. Handle SIGINT for graceful shutdown (close WebSocket, dispose agent session). Add `bin` entry in `package.json`: `"pi-web": "dist/cli.js"`.

### Task 9: Build Scripts and Dev Workflow
- **Goal**: Configure npm scripts for development and production.
- **Dependencies**: Tasks 1, 8
- **Files Affected**: `package.json`
- **New Files**: None
- **Details**:
  - `npm run dev` — Vite dev server for client (with HMR) + `tsx --watch src/cli.ts` for server (use `concurrently`)
  - `npm run build` — Vite builds client to `dist/client/`, TypeScript compiles server to `dist/server/`
  - `npm start` — Run compiled server (`node dist/cli.js`)
  - `npm run typecheck` — `tsc --noEmit` for both client and server

## Dependency Graph

- Task 1 → Task 2 → Task 3 → Task 8
- Task 1 → Task 4 → Task 5 → Task 6
- Task 1 → Task 4 → Task 5 → Task 7
- Task 6 || Task 7 (parallel)
- Task 3, Task 6, Task 7 → Task 9 (build scripts depend on all core code)

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SDK `createAgentSession()` expects terminal context; headless mode may have issues | Medium | Medium | Test early with minimal config. Use `ResourceLoader` override if discovery fails. Fallback to `SessionManager.inMemory()`. |
| WebSocket drops during long streaming; reconnection loses state | Medium | Low | Client reconnects with backoff. Server keeps running; state is server-side. On reconnect, client calls `get_state` and `get_messages` to sync. |
| Multiple clients sending conflicting commands (e.g., two prompts at once) | Low | Medium | SDK queues messages internally. Server serializes commands. Events broadcast to all. Acceptable for shared-session model. |
| Browser `file://` origin blocks WebSocket | Low | Low | Always serve via `http://` (the server does this). Never open as `file://`. |
| RPC protocol over WebSocket needs client ID routing that stdio doesn't have | Low | High | Server maintains `Map<string, WebSocket>` for `id` → client routing. Responses without `id` are broadcast. |

## Validation Criteria

- [ ] Running `npm run dev` starts the server and a browser window opens
- [ ] The web UI connects to the server via WebSocket (status shows "connected")
- [ ] Typing a prompt and pressing Enter sends an RPC `prompt` command; response streams in real-time
- [ ] Tool calls and results appear in the message stream
- [ ] Abort button sends `abort` command and stops streaming
- [ ] A second browser tab connected to the same server sees the same messages
- [ ] `npm run build` produces `dist/client/` (static files) and `dist/server/` (server JS)
- [ ] `npm start` runs the production build successfully
- [ ] The CLI entry point works: `npx pi-web` or `node dist/cli.js`
