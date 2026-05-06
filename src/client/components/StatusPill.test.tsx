import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusPill } from "./StatusPill.js";

describe("StatusPill", () => {
  afterEach(cleanup);

  it("renders connection dot and model", () => {
    render(
      <StatusPill
        connected
        model="claude-sonnet"
        isStreaming={false}
        isCompacting={false}
        activeToolCount={0}
        pendingMessageCount={0}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("claude-sonnet")).toBeDefined();
  });

  it("shows Thinking… when isStreaming is true", () => {
    render(
      <StatusPill
        connected
        model={null}
        isStreaming
        isCompacting={false}
        activeToolCount={0}
        pendingMessageCount={0}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Thinking…")).toBeDefined();
  });

  it("shows Running 1 tool when activeToolCount is 1", () => {
    render(
      <StatusPill
        connected
        model={null}
        isStreaming={false}
        isCompacting={false}
        activeToolCount={1}
        pendingMessageCount={0}
        onClick={() => {}}
      />
    );
    expect(screen.getByText("Running 1 tool")).toBeDefined();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <StatusPill
        connected
        model={null}
        isStreaming={false}
        isCompacting={false}
        activeToolCount={0}
        pendingMessageCount={0}
        onClick={handleClick}
      />
    );
    screen.getByRole("button").click();
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
