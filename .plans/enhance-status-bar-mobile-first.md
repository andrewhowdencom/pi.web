# Plan: Enhance Web UI Status Display and Establish Mobile-First Rule

## Objective

Enhance the pi web UI to elegantly display the live agent status information that the pi TUI normally shows in its footer. The solution must be mobile-first: a compact, always-visible status indicator on small screens that expands into a detailed drawer, mirroring the pi terminal experience. Additionally, create an `AGENTS.md` at the project root that codifies mobile-first UI/UX as a design rule.

## Context

- **`src/client/components/StatusBar.tsx`**: Currently renders a minimal header bar with a connection dot, model name, and thinking level. It does not show session info, queue state, active tools, or extension status lines.
- **`src/client/store.ts`**: Handles the full agent event stream but ignores `tool_execution_start/end` events and converts `setStatus` extension UI requests into ephemeral toast notifications rather than persistent status lines.
- **`src/shared/protocol.ts`**: `AgentStateSnapshot` exposes `model`, `thinkingLevel`, `isStreaming`, `isCompacting`, `sessionName`, `messageCount`, and `pendingMessageCount`, but lacks the working directory.
- **`src/server/agent.ts`**: Maintains `this.cwd` but never injects it into the state snapshot returned by `get_state`.
- **Pi TUI footer**: Displays working directory, session name, total token/cache usage, cost, context usage, current model, and any extension status lines. The web UI protocol does not yet surface token/cost/context usage, so the initial implementation will use the data that is already available.
- **`src/client/index.css`**: Already uses `100dvh` for dynamic viewport height, providing a foundation for mobile layouts.
- **`AGENTS.md`**: No such file exists in the repository. Pi convention loads it from the current working directory, so the project root is the correct location.

## Architectural Blueprint

### Selected Approach: Dual-Layer Status Display

1. **Compact Status Pill** — An always-visible, thumb-reachable indicator (in the header on desktop, or anchored just above the input area on mobile) that surfaces the most critical live state at a glance: connection health, current model, and a single synthesized activity badge (e.g., "Thinking…", "Compacting…", "Running 2 tools", "1 queued"). On narrow viewports it collapses to icons and short abbreviations; on desktop it expands to readable text segments.
2. **Expandable Status Drawer** — A bottom-sheet on mobile and a popover on desktop, triggered by tapping the pill. It reveals the full pi-style status: session name, message count, pending queue breakdown, thinking level, auto-compaction state, working directory, active tool list, and all persistent `setStatus` lines set by extensions.

### Tree-of-Thought Deliberation

- **Path A — Expand the existing header `StatusBar`**: Rejected. The header is too narrow on mobile; adding more text makes it unreadable and competes with the app title.
- **Path B — Add a fixed footer below the input area**: Rejected. On mobile, the virtual keyboard already consumes significant screen space. A fixed bottom bar would conflict with `env(safe-area-inset-bottom)` and reduce the visible message area.
- **Path C — Compact pill + expandable drawer**: Selected. This is the idiomatic mobile-first pattern used by modern chat apps (iOS/Android, ChatGPT mobile). It keeps the main viewport clean, provides a large touch target, and naturally maps to the pi TUI's "always-visible status line that can be inspected" metaphor.

## Requirements

1. Create `AGENTS.md` at the project root stating that mobile-first is a mandatory UI/UX rule [explicit].
2. Refactor the client store so that `setStatus` extension UI requests produce persistent status lines instead of ephemeral notifications [inferred from pi extension UI behavior].
3. Track active tool executions in the client store so the UI can display a live tool count [inferred from pi TUI footer behavior].
4. Expose the agent's working directory through the WebSocket state snapshot [inferred from pi TUI footer contents].
5. Design and implement a compact, tap-friendly Status Pill component that synthesizes the most important live state [explicit].
6. Design and implement an expandable Status Details drawer that displays the full agent state and persistent status lines [explicit].
7. Add mobile-first responsive CSS for the new status components, including safe-area insets and minimum touch-target sizes [explicit].
8. Add tests for the new status state tracking and UI components [inferred].

## Task Breakdown

### Task 1: Create AGENTS.md with Mobile-First Rule
- **Goal**: Establish mobile-first as a project-wide UI/UX convention.
- **Dependencies**: None
- **Files Affected**: None
- **New Files**: `AGENTS.md`
- **Interfaces**: None
- **Details**: Create `AGENTS.md` in the project root. Add a "Design Principles" or "UI/UX" section stating that all web UI components must be designed mobile-first: default styles target narrow viewports, progressive enhancement is used for larger screens, touch targets must be at least 44×44px, and layout must account for virtual keyboards and dynamic viewport height (`100dvh`, `env(safe-area-inset-bottom)`).

### Task 2: Refactor Client Store to Persist `setStatus` Lines
- **Goal**: Map `extension_ui_request` events with `method: "setStatus"` to a persistent dictionary instead of a toast notification.
- **Dependencies**: None
- **Files Affected**: `src/client/store.ts`
- **New Files**: None
- **Interfaces**: `AppState` gains `statuses: Record<string, string>`.
- **Details**: In `AgentStore.handleEvent`, rewrite the `"setStatus"` case to update `this.state.statuses[event.statusKey] = event.statusText`. When `statusText` is undefined or empty, delete the key. Remove the notification push for this case entirely. This aligns the web UI with the pi TUI's persistent status-line behavior.

### Task 3: Track Active Tool Executions in Client Store
- **Goal**: Surface a live tool-execution count so the status pill can display badges like "Running 2 tools…".
- **Dependencies**: None
- **Files Affected**: `src/client/store.ts`
- **New Files**: None
- **Interfaces**: `AppState` gains `activeToolCalls: Map<string, string>` (toolCallId → toolName).
- **Details**: In `AgentStore.handleEvent`, handle `tool_execution_start` by adding the tool call to `activeToolCalls`. Handle `tool_execution_end` by deleting it. The UI will derive `activeToolCalls.size` for the badge and can enumerate tool names for the drawer.

### Task 4: Expose Working Directory in State Snapshot
- **Goal**: Provide the agent's working directory to the web UI so the status drawer can display it, matching the pi TUI footer.
- **Dependencies**: None
- **Files Affected**: `src/shared/protocol.ts`, `src/server/agent.ts`
- **New Files**: None
- **Interfaces**: `AgentStateSnapshot` gains `workingDirectory: string | null`.
- **Details**: Add `workingDirectory: string | null` to the `AgentStateSnapshot` interface and to `DEFAULT_STATE`. In `AgentService.handleResponse` under the `get_state` case, inject `rawState.workingDirectory = this.cwd` before assigning the result to `this.state`. The client will receive it automatically in the initial `state` message and in `get_state` responses.

### Task 5: Implement Compact Status Pill Component
- **Goal**: Build a minimal, always-visible status indicator suitable for mobile and desktop.
- **Dependencies**: Task 2, Task 3, Task 4
- **Files Affected**: `src/client/components/StatusBar.tsx`
- **New Files**: `src/client/components/StatusPill.tsx`
- **Interfaces**:
  ```typescript
  interface StatusPillProps {
    connected: boolean;
    model: string | null;
    isStreaming: boolean;
    isCompacting: boolean;
    activeToolCount: number;
    pendingMessageCount: number;
    onClick: () => void;
  }
  ```
- **Details**: Render a single rounded pill containing: a connection dot, a truncated model name, and a single synthesized activity badge that shows the highest-priority active state (e.g., "Thinking…" > "Compacting…" > "Running N tools" > "N queued"). The entire pill must be clickable/tappable (≥44px touch target). On desktop, the pill can expand horizontally to show separate labeled segments.

### Task 6: Implement Expandable Status Details Drawer
- **Goal**: Provide a panel that reveals full pi-style status on tap or click.
- **Dependencies**: Task 2, Task 3, Task 4
- **Files Affected**: `src/client/App.tsx`, `src/client/components/StatusPill.tsx`
- **New Files**: `src/client/components/StatusDetails.tsx`
- **Interfaces**:
  ```typescript
  interface StatusDetailsProps {
    isOpen: boolean;
    onClose: () => void;
    agentState: AgentStateSnapshot | null;
    statuses: Record<string, string>;
    activeToolCalls: Map<string, string>;
  }
  ```
- **Details**: On mobile, render as a bottom sheet (full width, slide-up from bottom, max-height ~60vh, top border radius, drag handle, close button). On desktop, render as a popover anchored below the status pill. Sections:
  - **Session**: name, ID, message count.
  - **Queue**: pending message count.
  - **Model & Thinking**: current model, thinking level.
  - **Operations**: streaming, compacting, auto-compaction status, active tool names.
  - **Extension Status**: all entries from the `statuses` map.
  - **Environment**: working directory.
  Include a backdrop overlay that closes the drawer on click.

### Task 7: Add Mobile-First CSS for Status Components
- **Goal**: Ensure the status pill and drawer are usable on mobile and gracefully enhance on desktop.
- **Dependencies**: Task 5, Task 6
- **Files Affected**: `src/client/index.css`
- **New Files**: None
- **Interfaces**: None
- **Details**: Add CSS classes:
  - `.status-pill`: `display: inline-flex`, `align-items: center`, `gap`, `border-radius: 999px`, `padding`, `min-height: 44px`, `cursor: pointer`.
  - `.status-details-sheet`: `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, `z-index: 100`, top border radius, padding-bottom respecting `env(safe-area-inset-bottom)`.
  - On desktop (`@media (min-width: 768px)`), change to a centered popover or anchored panel instead of a full-width bottom sheet.
  - `.status-details-backdrop`: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.5)`, `z-index: 99`.
  - Respect `prefers-reduced-motion` for transitions.

### Task 8: Write Tests for Status Logic and Components
- **Goal**: Verify state tracking and UI rendering.
- **Dependencies**: Task 5, Task 6
- **Files Affected**: None
- **New Files**: `src/client/components/StatusPill.test.tsx`, `src/client/components/StatusDetails.test.tsx`
- **Interfaces**: None
- **Details**: Use Vitest + React Testing Library. Test cases must cover:
  - `StatusPill` renders connection dot and model.
  - `StatusPill` shows "Thinking…" when `isStreaming` is true.
  - `StatusPill` shows "Running 1 tool" when `activeToolCount` is 1.
  - `StatusDetails` renders session name and message count.
  - `StatusDetails` lists all active tool names.
  - `StatusDetails` lists persistent `setStatus` entries.
  - `AgentStore` correctly adds/removes tool calls and statuses in response to events.

## Dependency Graph

- Task 1 is independent.
- Tasks 2, 3, and 4 are parallel data-layer tasks.
- Task 5 || Task 6 (UI components can be developed in parallel once the enriched state is defined).
- Task 7 depends on Task 5 and Task 6.
- Task 8 depends on Task 5 and Task 6.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| `AgentStateSnapshot` from pi `get_state` does not natively include `workingDirectory` | Low | Low | We inject `workingDirectory` server-side in `AgentService`; the client treats it as opaque snapshot data. |
| Mobile virtual keyboard pushes fixed bottom elements off-screen | High | High | Status pill lives in the `app-header` (fixed top) on mobile, avoiding the keyboard. Bottom sheet uses `position: fixed` with `env(safe-area-inset-bottom)` and `100dvh` (already in CSS). |
| Persistent `setStatus` lines accumulate indefinitely | Medium | Low | The protocol allows clearing by sending `undefined` `statusText`; the client must delete the key. Document this behavior in a code comment. |
| Drawer animation janks on low-end mobile devices | Low | Medium | Use simple CSS `transform: translateY()` transitions. Respect `prefers-reduced-motion`. |
| Existing `StatusBar` header placement conflicts with a bottom-area pill | Medium | Medium | The pill is placed in the header on all viewports; on mobile it is compact and right-aligned next to the title. The bottom sheet provides the detailed view. |

## Validation Criteria

- [ ] `AGENTS.md` exists in the project root and contains an explicit mobile-first design rule.
- [ ] `setStatus` extension UI requests no longer generate toast notifications; they appear as persistent lines inside the status drawer.
- [ ] Tapping the status pill on a 375px-wide viewport opens a readable bottom sheet without horizontal overflow or clipped text.
- [ ] The status pill shows at least the current model and a dynamic activity badge (e.g., "Thinking…", "Running 2 tools").
- [ ] The status drawer displays session name, message count, pending queue count, thinking level, working directory, and active tool names.
- [ ] All new CSS respects `env(safe-area-inset-bottom)` and touch targets are at least 44px.
- [ ] New component tests pass under `npm test`.
