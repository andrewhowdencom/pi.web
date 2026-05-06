import React, { useEffect } from "react";
import type { AgentStateSnapshot } from "../../shared/protocol.js";

export interface StatusDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  agentState: AgentStateSnapshot | null;
  statuses: Record<string, string>;
  activeToolCalls: Map<string, string>;
}

export function StatusDetails({
  isOpen,
  onClose,
  agentState,
  statuses,
  activeToolCalls,
}: StatusDetailsProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeTools = Array.from(activeToolCalls.entries());
  const statusEntries = Object.entries(statuses);

  return (
    <>
      <div className="status-details-backdrop" onClick={onClose} />
      <div className="status-details-sheet" role="dialog" aria-modal="true">
        <div className="status-details-handle" aria-hidden="true" />
        <div className="status-details-content">
          <h2>Agent Status</h2>

          <section>
            <h3>Session</h3>
            <p>Name: {agentState?.sessionName ?? "—"}</p>
            <p>ID: {agentState?.sessionId ?? "—"}</p>
            <p>Messages: {agentState?.messageCount ?? 0}</p>
          </section>

          <section>
            <h3>Queue</h3>
            <p>Pending: {agentState?.pendingMessageCount ?? 0}</p>
          </section>

          <section>
            <h3>Model &amp; Thinking</h3>
            <p>Model: {agentState?.model ?? "—"}</p>
            <p>Thinking: {agentState?.thinkingLevel ?? "off"}</p>
          </section>

          <section>
            <h3>Operations</h3>
            <p>Streaming: {agentState?.isStreaming ? "Yes" : "No"}</p>
            <p>Compacting: {agentState?.isCompacting ? "Yes" : "No"}</p>
            <p>
              Auto-compaction:{" "}
              {agentState?.autoCompactionEnabled ? "Enabled" : "Disabled"}
            </p>
          </section>

          {activeTools.length > 0 && (
            <section>
              <h3>Active Tools</h3>
              <ul>
                {activeTools.map(([id, name]) => (
                  <li key={id}>{name}</li>
                ))}
              </ul>
            </section>
          )}

          {statusEntries.length > 0 && (
            <section>
              <h3>Extension Status</h3>
              {statusEntries.map(([key, text]) => (
                <p key={key}>
                  <strong>{key}:</strong> {text}
                </p>
              ))}
            </section>
          )}

          <section>
            <h3>Environment</h3>
            <p>Working directory: {agentState?.workingDirectory ?? "—"}</p>
          </section>

          <button
            className="status-details-close"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
