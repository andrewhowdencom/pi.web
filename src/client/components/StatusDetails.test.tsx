import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { AgentStateSnapshot } from "../../shared/protocol.js";
import { StatusDetails } from "./StatusDetails.js";

const baseAgentState: AgentStateSnapshot = {
  model: "claude-sonnet",
  thinkingLevel: "medium",
  isStreaming: false,
  isCompacting: false,
  sessionFile: null,
  sessionId: "sess-123",
  sessionName: "Test Session",
  autoCompactionEnabled: true,
  messageCount: 5,
  pendingMessageCount: 2,
  workingDirectory: "/home/user/project",
};

describe("StatusDetails", () => {
  afterEach(cleanup);

  it("renders session name and message count", () => {
    render(
      <StatusDetails
        isOpen
        onClose={vi.fn()}
        agentState={baseAgentState}
        statuses={{}}
        activeToolCalls={new Map()}
      />
    );
    expect(screen.getByText(/Test Session/)).toBeDefined();
    expect(screen.getByText(/Messages: 5/)).toBeDefined();
  });

  it("lists all active tool names", () => {
    const tools = new Map([
      ["tc-1", "read"],
      ["tc-2", "bash"],
    ]);
    render(
      <StatusDetails
        isOpen
        onClose={vi.fn()}
        agentState={baseAgentState}
        statuses={{}}
        activeToolCalls={tools}
      />
    );
    expect(screen.getByText("read")).toBeDefined();
    expect(screen.getByText("bash")).toBeDefined();
  });

  it("lists persistent setStatus entries", () => {
    const statuses = { build: "Compiling…", lint: "OK" };
    render(
      <StatusDetails
        isOpen
        onClose={vi.fn()}
        agentState={baseAgentState}
        statuses={statuses}
        activeToolCalls={new Map()}
      />
    );
    expect(screen.getByText("Compiling…")).toBeDefined();
    expect(screen.getByText("OK")).toBeDefined();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <StatusDetails
        isOpen={false}
        onClose={vi.fn()}
        agentState={baseAgentState}
        statuses={{}}
        activeToolCalls={new Map()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <StatusDetails
        isOpen
        onClose={onClose}
        agentState={baseAgentState}
        statuses={{}}
        activeToolCalls={new Map()}
      />
    );
    screen.getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
