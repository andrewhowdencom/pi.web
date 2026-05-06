import React from "react";

export interface StatusPillProps {
  connected: boolean;
  model: string | null;
  isStreaming: boolean;
  isCompacting: boolean;
  activeToolCount: number;
  pendingMessageCount: number;
  onClick: () => void;
}

export function StatusPill({
  connected,
  model,
  isStreaming,
  isCompacting,
  activeToolCount,
  pendingMessageCount,
  onClick,
}: StatusPillProps) {
  let badge: string | null = null;
  if (isStreaming) {
    badge = "Thinking…";
  } else if (isCompacting) {
    badge = "Compacting…";
  } else if (activeToolCount > 0) {
    badge = activeToolCount === 1 ? "Running 1 tool" : `Running ${activeToolCount} tools`;
  } else if (pendingMessageCount > 0) {
    badge = pendingMessageCount === 1 ? "1 queued" : `${pendingMessageCount} queued`;
  }

  return (
    <button
      className="status-pill"
      onClick={onClick}
      aria-label="Open status details"
      type="button"
    >
      <span
        className={`connection-dot ${connected ? "connected" : "disconnected"}`}
      />
      {model && (
        <span className="status-model" title={model}>
          {model}
        </span>
      )}
      {badge && <span className="status-badge">{badge}</span>}
    </button>
  );
}
