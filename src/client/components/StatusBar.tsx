import React from "react";

interface StatusBarProps {
  connected: boolean;
  model: string | null;
  thinkingLevel: string | null;
}

export function StatusBar({ connected, model, thinkingLevel }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span
        className={`connection-dot ${connected ? "connected" : "disconnected"}`}
      />
      <span>{connected ? "Connected" : "Disconnected"}</span>
      {model && <span>Model: {model}</span>}
      {thinkingLevel && thinkingLevel !== "off" && (
        <span>Thinking: {thinkingLevel}</span>
      )}
    </div>
  );
}
