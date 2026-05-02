# Plan: Connect to External Pi Agent

## Objective

Refactor pi.web from an embedded-agent architecture (where the pi coding agent runs inside the web server's Node.js process) to an external-agent architecture where the web server connects to a separate, independently running instance of the pi coding agent via WebSocket. This decouples the web UI from the agent's runtime, allowing the agent to run in its own process (e.g., a terminal running `pi --mode rpc`) while the web server acts as a lightweight proxy and static file server.

## Context

The current codebase implements the architecture described in `.plans/create-pi-web-ui.md`, which intentionally embedded the pi SDK directly in the web server process. Key findings from repository inspection:

- **`src/server/agent.ts`**: `AgentService` directly imports `createAgentSession()`, `SessionManager`, `AuthStorage`, and `ModelRegistry` from `@mariozechner/pi-coding-agent` and creates the agent session in-process.
- **`src/server/index.ts`**: `startServer()` instantiates `AgentService`, calls `agent.initialize(cwd)`, and creates a WebSocket bridge that translates browser commands into direct SDK method calls.
- **`src/cli.ts`**: The CLI entry point receives the `agent` object from `startServer()` and calls `agent.dispose()` on shutdown, confirming the agent is part of the same process lifecycle.
- **`src/server/websocket.ts`**: Commands like `prompt`, `steer`, `abort` are handled by calling methods directly on the embedded `AgentService` instance. Events from the SDK are broadcast to all browser clients.
- **`package.json`**: Lists `@mariozechner/pi-coding-agent` as a direct runtime dependency.
- **`src/shared/protocol.ts`**: The comment states it "Mirrors the pi --mode rpc protocol for WebSocket transport," indicating the protocol was designed to be compatible with an external RPC-capable pi agent.
- **Client-side code** (`src/client/websocket.ts`, `src/client/store.ts`, `src/client/App.tsx`): The browser connects via WebSocket to the pi-web server. No changes are needed on the client if the server maintains its WebSocket endpoint as a proxy.

There is no configuration option to specify an external agent URL. The `--port` and `--cwd` CLI flags only configure the embedded web server and its working directory.

## Architectural Blueprint

### Selected Architecture: Server-as-Proxy

The browser continues to connect via WebSocket to the pi-web server. The pi-web server, in turn, opens a WebSocket connection to an external pi coding agent instance. The server acts as a transparent proxy, forwarding commands from browser clients to the external agent and broadcasting events from the external agent back to all connected browser clients.

```
+-------------+      WebSocket       +-------------+      WebSocket       +-------------+
|   Browser   | <------------------> |  pi-web     | <------------------> |  pi agent   |
|   (React)   |                      |  server     |                      |  (external) |
+-------------+                      |  (proxy)    |                      +-------------+
                                    +-------------+
```

**Why this path was chosen:**

| Path | Description | Pros | Cons | Verdict |
|------|-------------|------|------|---------|
| **A: Server-as-Proxy** | Browser -> pi-web server -> external agent | Minimal client changes, no CORS issues, server can add middleware, external agent URL stays private | Extra network hop | **Selected** |
| **B: Browser Direct** | Browser -> external agent directly | Fewer hops, simpler server, CDN-deployable UI | CORS complications, external agent exposed to browsers, significant client changes | Rejected -- contradicts user's explicit requirement that the webserver connects |
| **C: Hybrid/Embedded Fallback** | Configurable embedded or external | Backward compatible, dev convenience | Maintains heavy SDK dependency, two code paths | Rejected -- user explicitly wants to move away from embedding |

### Protocol Compatibility

The existing `src/shared/protocol.ts` and `src/shared/events.ts` already mirror the pi RPC protocol. In the proxy architecture, the pi-web server forwards `RpcCommand` messages from browsers to the external agent and relays `AgentEvent` messages from the external agent back to browsers. Minimal or no translation should be required if the external agent speaks the same WebSocket protocol.

## Requirements

1. The web server must connect to an external pi coding agent instance via configurable WebSocket URL [explicit]
2. The embedded `@mariozechner/pi-coding-agent` dependency must be removed [explicit]
3. Browser clients must continue to connect to the pi-web server's WebSocket endpoint with no changes [inferred]
4. All existing commands (prompt, steer, followUp, abort, setModel, setThinkingLevel, getState, getMessages) must continue to work [inferred]
5. Agent events must be broadcast to all connected browser clients as before [inferred]
6. The CLI must accept an `--agent-url` flag to specify the external agent [explicit]
7. Connection failures to the external agent must be handled gracefully with reconnection logic [inferred]
8. The development workflow must be updated to account for running the external agent separately [inferred]

## Task Breakdown

### Task 1: Add External Agent Connection Configuration
- **Goal**: Replace embedded-agent configuration with external agent URL configuration across CLI flags, server options, and development scripts.
- **Dependencies**: None
- **Files Affected**:
  - `src/cli.ts`
  - `src/server/index.ts`
  - `package.json`
- **New Files**: None
- **Interfaces**:
  ```typescript
  interface ServerOptions {
    port?: number;
    agentUrl: string;  // WebSocket URL of external pi agent, e.g. ws://localhost:3141
    staticDir?: string;
  }
  ```
- **Details**:
  - In `src/cli.ts`: Remove `--cwd` flag parsing. Add `--agent-url` flag parsing with validation that it is a valid WebSocket URL (starts with `ws://` or `wss://`). Update help text. Store `agentUrl` for passing to `startServer()`.
  - In `src/server/index.ts`: Replace `cwd` parameter in `ServerOptions` with `agentUrl: string`. Pass `agentUrl` to `AgentService.initialize()` instead of `cwd`.
  - In `package.json`: Update the `dev` script. The current script starts the embedded server with `tsx src/cli.ts --port 3142 --no-open`. The new script needs to either (a) assume an external agent is already running and pass `--agent-url ws://localhost:3141` (or whatever port the external agent uses), or (b) document that the external agent must be started separately.

### Task 2: Refactor AgentService to Connect to External Agent
- **Goal**: Rewrite `src/server/agent.ts` to connect to an external pi agent via WebSocket instead of embedding the SDK, while preserving the same public interface.
- **Dependencies**: Task 1
- **Files Affected**:
  - `src/server/agent.ts`
- **New Files**: None
- **Interfaces**:
  ```typescript
  export type EventCallback = (event: AgentEvent) => void;

  export class AgentService {
    async initialize(agentUrl: string): Promise<void>;
    onEvent(callback: EventCallback): () => void;
    getState(): AgentStateSnapshot;
    getMessages(): unknown[];
    async prompt(message: string, options?: { streamingBehavior?: "steer" | "followUp" }): Promise<void>;
    async steer(message: string): Promise<void>;
    async followUp(message: string): Promise<void>;
    async abort(): Promise<void>;
    async setModel(provider: string, modelId: string): Promise<void>;
    setThinkingLevel(level: string): void;
    dispose(): void;
  }
  ```
- **Details**:
  - Remove all imports from `@mariozechner/pi-coding-agent`. Import `WebSocket` from `ws` and `AgentEvent` from `../shared/events.js`.
  - In `initialize(agentUrl)`: Open a WebSocket connection to the external agent URL. Set up `onmessage` handler to parse incoming messages.
  - Handle three message types from external agent: (a) `event` -> broadcast to callbacks, (b) `state` -> update cached state, (c) `response` -> optionally log or handle.
  - Cache the latest `AgentStateSnapshot` and messages array in memory for `getState()` and `getMessages()` to return immediately.
  - `prompt()`, `steer()`, `followUp()`, `abort()`, `setModel()`, `setThinkingLevel()`: Send corresponding `RpcCommand` JSON over the WebSocket to the external agent.
  - `onEvent(callback)`: Add callback to a `Set`, return unsubscribe function.
  - `dispose()`: Close the WebSocket connection, clear callbacks, clear caches.
  - Define a simple local `PromptOptions` type if needed (previously imported from SDK).

### Task 3: Update Server Initialization and CLI Lifecycle
- **Goal**: Wire the refactored `AgentService` into the server startup and CLI shutdown paths.
- **Dependencies**: Task 2
- **Files Affected**:
  - `src/server/index.ts`
  - `src/cli.ts`
  - `src/server/websocket.ts` (verify no changes needed)
- **New Files**: None
- **Details**:
  - In `src/server/index.ts`: Update `startServer()` to create `new AgentService()` and call `await agent.initialize(options.agentUrl)` instead of `agent.initialize(cwd)`. The `agentUrl` is now required (no default).
  - In `src/cli.ts`: Pass `agentUrl` from parsed CLI args to `startServer()`. Update the shutdown handler: `agent.dispose()` now closes the external WebSocket connection instead of tearing down an embedded session.
  - Verify `src/server/websocket.ts` requires no changes since `AgentService` preserves its public interface. The command handlers (`handleCommand`) and event subscription logic should work unchanged.

### Task 4: Remove Embedded Agent Dependency
- **Goal**: Remove `@mariozechner/pi-coding-agent` from runtime dependencies and clean up any remaining SDK references.
- **Dependencies**: Task 3
- **Files Affected**:
  - `package.json`
  - `src/server/agent.ts` (already refactored in Task 2)
  - `tsconfig.server.json` (verify no SDK-specific config needed)
- **New Files**: None
- **Details**:
  - In `package.json`: Remove `@mariozechner/pi-coding-agent` from the `dependencies` object. Run `npm install` to update `package-lock.json` (or note this for the implementer).
  - Verify no other server-side files import from `@mariozechner/pi-coding-agent`. The only import should have been in `src/server/agent.ts` which is rewritten in Task 2.
  - Verify `tsconfig.json` and `tsconfig.server.json` do not have SDK-specific paths or types. They should not since the SDK was imported as a normal npm package.

### Task 5: Add Connection Resilience and Error Handling
- **Goal**: Implement reconnection logic for the external agent connection and surface connection state to browser clients.
- **Dependencies**: Task 2
- **Files Affected**:
  - `src/server/agent.ts`
  - `src/server/websocket.ts` (minor additions)
- **New Files**: None
- **Interfaces**: Add `connected: boolean` to `AgentStateSnapshot` [optional, if desired for UI]
- **Details**:
  - In `AgentService`: Add exponential backoff reconnection when the external agent WebSocket closes unexpectedly. Start at 1s delay, double up to 30s maximum. On reconnect, request fresh state from external agent if the protocol supports it (e.g., send `get_state` command).
  - If reconnection fails persistently, broadcast a synthetic event to browser clients indicating the external agent is unreachable. This can be a custom event type or a status update.
  - In `src/server/websocket.ts`: On new client connection, send the cached state (which may indicate `isStreaming: false` and no model if external agent is disconnected).
  - Ensure `dispose()` properly cleans up reconnection timers.

### Task 6: Update Development Workflow and Documentation
- **Goal**: Document how to run the external agent and web server in development, and update build/dev scripts.
- **Dependencies**: Task 3, Task 4, Task 5
- **Files Affected**:
  - `package.json`
  - `README.md`
- **New Files**: None
- **Details**:
  - In `package.json`: Update the `dev` script. Options:
    - Option A: Use `concurrently` to start both the external agent (if a CLI command is available) and the web server: `"dev": "VITE_WS_URL=ws://localhost:3142 concurrently -k \"vite\" \"pi --mode rpc --port 3141\" \"tsx src/cli.ts --port 3142 --agent-url ws://localhost:3141 --no-open\""`
    - Option B: Document that the external agent must be started in a separate terminal before running `npm run dev`.
  - In `README.md`: Rewrite setup instructions. Explain that pi.web is now a web UI that connects to an external pi agent. Document the `--agent-url` flag, the `--port` flag for the web server, and how to start the external agent.
  - Update `npm start` script if needed to include `--agent-url` with a sensible default or require it via environment variable.

## Dependency Graph

- Task 1 -> Task 2
- Task 2 -> Task 3
- Task 2 -> Task 5
- Task 3 -> Task 4
- Task 3, Task 4, Task 5 -> Task 6

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| External pi agent protocol differs from assumed WebSocket format | High | Medium | Spike task: verify the external agent's actual RPC/WebSocket interface before implementing Task 2. If stdio-based, the web server must spawn the pi process and translate stdio JSONL to WebSocket. |
| External agent does not expose a WebSocket server | High | Medium | Same as above. If only stdio RPC is available, implement a stdio-to-WebSocket adapter in `AgentService`. |
| CORS issues if external agent and web server run on different origins in some deployment | Medium | Low | Server-as-proxy architecture avoids this since the browser only connects to the pi-web server. |
| Reconnection logic causes event duplication or message loss | Medium | Medium | On reconnect, request full state sync from external agent. Design `AgentService` to replace cached messages rather than append on sync. |
| `@mariozechner/pi-coding-agent` types are still needed for type-checking even after removing runtime dependency | Low | Low | If SDK types are needed, move to `devDependencies`. Alternatively, define minimal local type stubs for the few types used (mainly `PromptOptions`). |

## Validation Criteria

- [ ] `npm run build` succeeds without `@mariozechner/pi-coding-agent` in dependencies
- [ ] Running `tsx src/cli.ts --port 3142 --agent-url ws://localhost:3141` starts the web server and connects to the external agent
- [ ] Browser UI connects to `ws://localhost:3142` and sees the same messages/events as before
- [ ] Sending a prompt from the browser flows through the web server to the external agent and responses stream back
- [ ] Tool calls and results appear in the message stream
- [ ] Abort button sends abort command through the proxy to the external agent
- [ ] Closing and restarting the external agent causes the web server to reconnect with exponential backoff
- [ ] A second browser tab connected to the same web server sees the same messages
- [ ] `npm start` works with a configured `--agent-url`
- [ ] `README.md` documents how to start the external agent and the web server
