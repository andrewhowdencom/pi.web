import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { AgentStore } from "./store.js";
import type { ServerMessage } from "../shared/events.js";
import { createWebSocketClient } from "./websocket.js";
import { loadMessages } from "./session-storage.js";

vi.mock("./websocket.js", () => ({
  createWebSocketClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    onOpen: vi.fn(() => () => {}),
    onClose: vi.fn(() => () => {}),
    onMessage: vi.fn(() => () => {}),
    eagerReconnect: vi.fn(),
    get isOpen() { return false; },
  })),
}));

describe("AgentStore", () => {
  let store: AgentStore;
  let messageHandler: (msg: ServerMessage) => void;
  let sendSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    store = new AgentStore();
    const client = vi.mocked(createWebSocketClient).mock.results[0].value;
    messageHandler = (client.onMessage.mock.calls[0] as any)[0] as (msg: ServerMessage) => void;
    sendSpy = client.send;
  });

  afterEach(() => {
    store.disconnect();
    cleanup();
    sessionStorage.clear();
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

  it("restores messages from sessionStorage on construction", () => {
    const payload = JSON.stringify({
      sessionId: "session-abc",
      messages: [{ role: "user", content: "restored" }],
      timestamp: Date.now(),
    });
    sessionStorage.setItem("pi_web_messages", payload);

    const freshStore = new AgentStore();
    expect(freshStore.getState().messages).toEqual([
      { role: "user", content: "restored" },
    ]);

    freshStore.disconnect();
  });

  it("clears restored messages when server sessionId differs", () => {
    const payload = JSON.stringify({
      sessionId: "session-old",
      messages: [{ role: "user", content: "old" }],
      timestamp: Date.now(),
    });
    sessionStorage.setItem("pi_web_messages", payload);

    const freshStore = new AgentStore();
    expect(freshStore.getState().messages).toEqual([
      { role: "user", content: "old" },
    ]);

    const client = vi.mocked(createWebSocketClient).mock.results.at(-1)!.value;
    const freshHandler = (client.onMessage.mock.calls[0] as any)[0] as (msg: ServerMessage) => void;

    freshHandler({
      type: "state",
      state: {
        sessionId: "session-new",
        model: null,
        thinkingLevel: "medium",
        isStreaming: false,
        isCompacting: false,
        sessionFile: null,
        sessionName: null,
        autoCompactionEnabled: false,
        messageCount: 0,
        pendingMessageCount: 0,
        workingDirectory: null,
      } as any,
    });

    expect(freshStore.getState().messages).toEqual([]);
    expect(sessionStorage.getItem("pi_web_messages")).toBeNull();

    freshStore.disconnect();
  });

  it("persists messages to sessionStorage after message events when sessionId is known", () => {
    messageHandler({
      type: "state",
      state: {
        sessionId: "session-abc",
        model: null,
        thinkingLevel: "medium",
        isStreaming: false,
        isCompacting: false,
        sessionFile: null,
        sessionName: null,
        autoCompactionEnabled: false,
        messageCount: 0,
        pendingMessageCount: 0,
        workingDirectory: null,
      } as any,
    });

    messageHandler({
      type: "event",
      event: {
        type: "message_start",
        message: { role: "user", content: "hello" },
      } as any,
    });

    const stored = loadMessages();
    expect(stored).not.toBeNull();
    expect(stored!.sessionId).toBe("session-abc");
    expect(stored!.messages).toEqual([{ role: "user", content: "hello" }]);
  });

  it("clears sessionStorage when starting a new session", () => {
    sessionStorage.setItem(
      "pi_web_messages",
      JSON.stringify({ sessionId: "s", messages: [], timestamp: 1 })
    );
    store.sendNewSession();
    expect(sessionStorage.getItem("pi_web_messages")).toBeNull();
  });

  it("requests state and messages when tab becomes visible", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "get_state" })
    );
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "get_messages" })
    );
  });

  it("removes lifecycle event listeners on disconnect", () => {
    const freshStore = new AgentStore();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    freshStore.disconnect();
    expect(removeSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    expect(removeSpy).toHaveBeenCalledWith("freeze", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("resume", expect.any(Function));
    removeSpy.mockRestore();
  });
});
