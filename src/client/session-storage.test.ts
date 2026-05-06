import { describe, it, expect, beforeEach } from "vitest";
import { saveMessages, loadMessages, clearMessages } from "./session-storage.js";

describe("session-storage", () => {
  beforeEach(() => {
    clearMessages();
  });

  it("round-trips messages via saveMessages and loadMessages", () => {
    const messages = [{ role: "user", content: "hello" }];
    saveMessages("session-123", messages);
    const loaded = loadMessages();
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe("session-123");
    expect(loaded!.messages).toEqual(messages);
    expect(loaded!.timestamp).toBeTypeOf("number");
  });

  it("returns null when no messages are stored", () => {
    expect(loadMessages()).toBeNull();
  });

  it("clears stored messages", () => {
    saveMessages("session-123", [{ role: "user", content: "hello" }]);
    clearMessages();
    expect(loadMessages()).toBeNull();
  });

  it("returns null on corrupted JSON", () => {
    sessionStorage.setItem("pi_web_messages", "not-json");
    expect(loadMessages()).toBeNull();
  });
});
