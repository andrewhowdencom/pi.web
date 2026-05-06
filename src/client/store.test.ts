import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { AgentStore } from "./store.js";
import type { ServerMessage } from "../shared/events.js";
import { createWebSocketClient } from "./websocket.js";

vi.mock("./websocket.js", () => ({
  createWebSocketClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    onOpen: vi.fn(() => () => {}),
    onClose: vi.fn(() => () => {}),
    onMessage: vi.fn(() => () => {}),
  })),
}));

describe("AgentStore", () => {
  let store: AgentStore;
  let messageHandler: (msg: ServerMessage) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new AgentStore();
    const client = vi.mocked(createWebSocketClient).mock.results[0].value;
    messageHandler = (client.onMessage.mock.calls[0] as any)[0] as (msg: ServerMessage) => void;
  });

  afterEach(() => {
    store.disconnect();
    cleanup();
  });

  it("tracks active tool calls on tool_execution_start and removes them on tool_execution_end", () => {
    messageHandler({
      type: "event",
      event: {
        type: "tool_execution_start",
        toolCallId: "tc-1",
        toolName: "read",
        args: {},
      },
    });

    let state = store.getState();
    expect(state.activeToolCalls.size).toBe(1);
    expect(state.activeToolCalls.get("tc-1")).toBe("read");

    messageHandler({
      type: "event",
      event: {
        type: "tool_execution_end",
        toolCallId: "tc-1",
        toolName: "read",
        result: null,
        isError: false,
      },
    });

    state = store.getState();
    expect(state.activeToolCalls.size).toBe(0);
  });

  it("persists setStatus lines and removes them when statusText is cleared", () => {
    messageHandler({
      type: "event",
      event: {
        type: "extension_ui_request",
        method: "setStatus",
        id: "1",
        statusKey: "build",
        statusText: "Compiling…",
      },
    });

    let state = store.getState();
    expect(state.statuses["build"]).toBe("Compiling…");

    messageHandler({
      type: "event",
      event: {
        type: "extension_ui_request",
        method: "setStatus",
        id: "2",
        statusKey: "build",
        statusText: undefined,
      },
    });

    state = store.getState();
    expect(state.statuses["build"]).toBeUndefined();
  });
});
