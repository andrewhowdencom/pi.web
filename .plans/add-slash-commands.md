# Plan: Add Slash Command Support to pi-web UI

## Objective

Enable users to type slash commands (`/new`, `/compress`, `/abort`, `/state`, `/messages`) in the web UI input area instead of relying on buttons or external controls. Commands are parsed client-side and mapped to existing WebSocket protocol messages. This plan also implements the missing server-side handlers for `new_session` and `compact` commands.

## Context

### Repository Topology

The pi-web project (`pi-web@0.1.0`) is a React + Express + WebSocket web UI for the Pi coding agent:

- **Client**: React 18 + Vite, custom store (`src/client/store.ts`), WebSocket transport (`src/client/websocket.ts`)
- **Server**: Express + WebSocket bridge (`src/server/websocket.ts`), AgentService (`src/server/agent.ts`) that spawns `pi --mode rpc`
- **Shared**: Protocol types (`src/shared/protocol.ts`), Event types (`src/shared/events.ts`)

### Key Findings

1. **Protocol already defines the commands** (`src/shared/protocol.ts`):
   - `NewSessionCommand` (type: `"new_session"`) → `/new`
   - `CompactCommand` (type: `"compact"`) → `/compress`, `/compact`
   - `AbortCommand` (type: `"abort"`) → `/abort`
   - `GetStateCommand` (type: `"get_state"`) → `/state`
   - `GetMessagesCommand` (type: `"get_messages"`) → `/messages`

2. **Server-side handlers are stubbed out** (`src/server/websocket.ts` lines ~120–128):
   ```typescript
   case "new_session": {
     sendError(ws, cmd.id, "new_session", "new_session not yet implemented");
     break;
   }
   case "compact": {
     sendError(ws, cmd.id, "compact", "compact not yet implemented");
     break;
   }
   ```

3. **AgentService lacks methods** (`src/server/agent.ts`) for `new_session` and `compact`.

4. **Client InputArea** (`src/client/components/InputArea.tsx`) sends all text verbatim as `prompt` or `steer` commands. There is no slash command detection.

5. **Client store** (`src/client/store.ts`) has specific methods (`sendPrompt`, `sendSteer`, `sendAbort`) but no generic slash command dispatch.

6. **Event protocol** already includes `compaction_start` / `compaction_end` events, so the UI will receive visual feedback when `/compress` runs.

## Architectural Blueprint

### Selected Approach: Client-Side Parser + Server-Side Completion

**Path evaluated:**

1. **Pure client-side parsing in InputArea** — Too simple; logic scattered in UI component, hard to extend.
2. **Server-side prompt parsing** — Violates existing protocol design (distinct command types); forces every message through a regex on the server.
3. **Dedicated slash command module (client) + server completion** — ✅ **Selected.** Clean separation of concerns: a small parser module maps `/command` to store actions, while the server gets the missing `new_session` and `compact` implementations. Extensible via a registry pattern.

### Architecture

```
User types "/new" in InputArea
        │
        ▼
+----------------------------+
│ InputArea.tsx              │
│ Detects leading "/"        │
│ Calls onSlashCommand()     │
+----------------------------+
        │
        ▼
+----------------------------+
│ App.tsx                    │
│ Receives onSlashCommand    │
│ Looks up handler           │
+----------------------------+
        │
        ▼
+----------------------------+
│ store.ts                   │
│ sendNewSession()           │
│ sendCompact(args)          │
│ sendAbort()                │
│ sendGetState()             │
│ sendGetMessages()          │
+----------------------------+
        │
        ▼
+----------------------------+
│ WebSocket (existing)       │
│ Sends RpcCommand JSON      │
+----------------------------+
        │
        ▼
+----------------------------+
│ server/websocket.ts        │
│ Routes to agent method     │
+----------------------------+
        │
        ▼
+----------------------------+
│ server/agent.ts            │
│ newSession() → JSONL       │
│ compact(args) → JSONL      │
│ (other methods exist)      │
+----------------------------+
        │
        ▼
   pi --mode rpc process
```

### Design Decisions

- **No message displayed for slash commands**: Meta-commands should not appear as user chat messages. Visual feedback comes from server events (e.g., `compaction_start`) or notifications.
- **Unknown commands show a toast**: The existing notification system (`UINotification`) is reused for error feedback.
- **Arguments supported for `/compact`**: `/compact` and `/compress` accept optional trailing text as `customInstructions` (e.g., `/compress Focus on API changes`).
- **No autocomplete in MVP**: A follow-up enhancement can add a Discord-style slash command popup. The parser is designed to support this.

## Requirements

1. Typing `/new` and pressing Enter resets the agent session (sends `new_session`).
2. Typing `/compress` or `/compact` and pressing Enter triggers context compaction (sends `compact`).
3. Typing `/abort` and pressing Enter aborts the current stream (sends `abort`).
4. Typing `/state` and pressing Enter refreshes the agent state display (sends `get_state`).
5. Typing `/messages` and pressing Enter refreshes the message list (sends `get_messages`).
6. Unknown slash commands (e.g., `/foo`) display an error notification in the UI without sending any command.
7. Slash commands are not displayed as user messages in the chat.
8. Server-side `new_session` and `compact` handlers are implemented and wired through `AgentService` to the `pi` RPC process.
9. TypeScript compilation passes cleanly.

## Task Breakdown

### Task 1: Create Client-Side Slash Command Parser
- **Goal**: Build a reusable parser module that identifies slash commands and extracts arguments.
- **Dependencies**: None.
- **Files Affected**: None (new file).
- **New Files**: `src/client/slash-commands.ts`
- **Interfaces**:
  ```typescript
  export type SlashCommandAction =
    | { type: "new_session" }
    | { type: "compact"; customInstructions?: string }
    | { type: "abort" }
    | { type: "get_state" }
    | { type: "get_messages" }
    | { type: "unknown"; command: string };

  export function parseSlashCommand(text: string): SlashCommandAction | null;
  ```
- **Details**: Implement a function that checks if text starts with `/`. Split on first whitespace to separate command name from arguments. Map known commands to `SlashCommandAction`. Return `null` for non-slash input. Return `unknown` for unrecognized commands. Support aliases: `compress` → `compact`.

### Task 2: Extend Store with Slash Command Dispatch
- **Goal**: Add methods to `AgentStore` for each slash command action, and a unified `sendSlashCommand` entry point.
- **Dependencies**: Task 1.
- **Files Affected**: `src/client/store.ts`
- **New Files**: None.
- **Interfaces**:
  ```typescript
  // New methods on AgentStore
  sendNewSession(): void;
  sendCompact(customInstructions?: string): void;
  sendGetState(): void;
  sendGetMessages(): void;

  // Unified entry point
  sendSlashCommand(text: string): boolean; // returns true if handled as slash command
  ```
- **Details**:
  - Import `parseSlashCommand` from Task 1.
  - `sendSlashCommand(text)` calls `parseSlashCommand(text)`. If `null`, returns `false` so caller can fall back to normal `sendPrompt`. If `unknown`, adds an error `UINotification` to state and returns `true`. Otherwise dispatches to the appropriate method and returns `true`.
  - `sendNewSession()` sends `{ type: "new_session" }` via WebSocket.
  - `sendCompact(customInstructions?)` sends `{ type: "compact", customInstructions }` via WebSocket.
  - `sendGetState()` sends `{ type: "get_state" }` via WebSocket.
  - `sendGetMessages()` sends `{ type: "get_messages" }` via WebSocket.

### Task 3: Update InputArea to Route Slash Commands
- **Goal**: Modify `InputArea` to detect slash commands and route them through a new callback instead of treating them as regular text.
- **Dependencies**: Task 2.
- **Files Affected**: `src/client/components/InputArea.tsx`
- **New Files**: None.
- **Interfaces**:
  ```typescript
  interface InputAreaProps {
    connected: boolean;
    isStreaming: boolean;
    onSend: (message: string) => void;
    onSteer: (message: string) => void;
    onAbort: () => void;
    onSlashCommand: (text: string) => boolean; // NEW
  }
  ```
- **Details**:
  - Add `onSlashCommand` prop.
  - In `handleKeyDown` and `handleSend`, after checking `text.trim()`, call `onSlashCommand(text.trim())` first. If it returns `true` (handled), clear the textarea and stop. If `false`, proceed with existing `onSend`/`onSteer` logic.
  - Do not display slash commands as user messages — this is handled by the fact that `onSlashCommand` returning `true` skips the `onSend` path entirely.

### Task 4: Wire Slash Commands in App.tsx
- **Goal**: Connect `InputArea`'s new `onSlashCommand` prop to the store's `sendSlashCommand` method.
- **Dependencies**: Task 2, Task 3.
- **Files Affected**: `src/client/App.tsx`
- **New Files**: None.
- **Interfaces**: No new interfaces.
- **Details**:
  - In the `useAgent()` hook output, expose `sendSlashCommand` (add it alongside `sendPrompt`, `sendSteer`, `sendAbort`).
  - Pass it to `InputArea` as `onSlashCommand={agent.sendSlashCommand}`.

### Task 5: Implement Missing AgentService Methods
- **Goal**: Add `newSession()` and `compact()` methods to `AgentService` so it can forward these commands to the `pi` RPC process.
- **Dependencies**: None (server-side, parallel with Tasks 1–4).
- **Files Affected**: `src/server/agent.ts`
- **New Files**: None.
- **Interfaces**:
  ```typescript
  async newSession(): Promise<void>;
  async compact(customInstructions?: string): Promise<void>;
  ```
- **Details**:
  - `newSession()` sends `{ type: "new_session" }` via `sendCommand()`.
  - `compact(customInstructions?)` sends `{ type: "compact", customInstructions }` via `sendCommand()`.
  - Follow the exact pattern of existing methods (`prompt`, `steer`, `abort`).

### Task 6: Wire Server-Side WebSocket Handlers
- **Goal**: Replace the stubbed error responses for `new_session` and `compact` in the WebSocket command handler with real calls to `AgentService`.
- **Dependencies**: Task 5.
- **Files Affected**: `src/server/websocket.ts`
- **New Files**: None.
- **Interfaces**: No new interfaces.
- **Details**:
  - In `handleCommand`, case `"new_session"`: call `await agent.newSession();` then `sendSuccess(ws, cmd.id, "new_session")`.
  - In `handleCommand`, case `"compact"`: call `await agent.compact(cmd.customInstructions);` then `sendSuccess(ws, cmd.id, "compact")`.
  - Ensure error handling follows the same try/catch pattern used by other commands.

### Task 7: TypeScript Validation
- **Goal**: Verify the entire change compiles without errors.
- **Dependencies**: Tasks 1–6.
- **Files Affected**: None.
- **New Files**: None.
- **Interfaces**: No new interfaces.
- **Details**: Run `npx tsc --noEmit` (or `npm run typecheck`). Fix any type errors. Verify that `src/client/slash-commands.ts` is included in the client compilation (it lives under `src/client/` which is covered by the default `tsconfig.json`).

## Dependency Graph

- Task 1 → Task 2 (parser module used by store)
- Task 2 → Task 3 (store methods used by InputArea)
- Task 2 → Task 4 (store exposes method to App)
- Task 3 + Task 4 (parallelizable once Task 2 is done)
- Task 5 → Task 6 (AgentService methods used by WebSocket handler)
- Tasks 1–4 || Tasks 5–6 (client work and server work are parallel tracks)
- Tasks 1–6 → Task 7 (validation requires all code changes)

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| `pi --mode rpc` does not actually support `new_session` or `compact` commands | High | Medium | The server will forward the command and receive an error response from the pi agent process, which is propagated back to the UI as a notification. Verify by testing `/new` and `/compress` after implementation. If unsupported, the commands will gracefully fail with an error toast. |
| Slash commands are accidentally sent as user messages | Medium | Low | The `InputArea` routing logic explicitly returns early when `onSlashCommand` returns `true`, preventing the text from reaching `onSend`/`onSteer`. Add a unit test or manual test verifying no user message appears for `/state`. |
| Adding `onSlashCommand` prop breaks existing consumers of `InputArea` | Low | Low | `InputArea` is only consumed in `App.tsx` within this codebase. No external consumers exist. Mark prop as optional if defensive. |
| Unknown command notifications flood the UI | Low | Low | Notifications are dismissible and the existing notification system is used. A single typo produces one toast. |

## Validation Criteria

- [ ] Typing `/new` and pressing Enter sends a `new_session` WebSocket message (verified via browser DevTools Network → WebSocket).
- [ ] Typing `/compress` or `/compact` and pressing Enter sends a `compact` WebSocket message. Optional trailing text is included as `customInstructions`.
- [ ] Typing `/abort` during streaming sends an `abort` message.
- [ ] Typing `/state` sends a `get_state` message and the StatusBar updates when the response arrives.
- [ ] Typing `/messages` sends a `get_messages` message.
- [ ] Typing `/unknowncommand` shows a red error notification toast and does not send any WebSocket message.
- [ ] Typing normal text without a leading `/` still works as a regular prompt/steer message.
- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] The `new_session` and `compact` server handlers no longer return "not yet implemented" errors.
