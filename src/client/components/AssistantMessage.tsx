import React from "react";
import { ToolCall } from "./ToolCall.js";

interface AssistantMessageProps {
  message: unknown;
  isStreaming: boolean;
}

export function AssistantMessage({
  message,
  isStreaming,
}: AssistantMessageProps) {
  const content = (message as any)?.content;

  if (!Array.isArray(content)) {
    return (
      <div className="message message-assistant">
        <div className="message-text">{(message as any)?.content ?? ""}</div>
      </div>
    );
  }

  return (
    <div className="message message-assistant">
      {content.map((block: any, i: number) => {
        switch (block?.type) {
          case "text":
            return (
              <div key={i} className="message-text">
                {block.text}
              </div>
            );
          case "thinking":
            return (
              <details key={i} className="thinking-block">
                <summary>Thinking</summary>
                <pre>{block.thinking}</pre>
              </details>
            );
          case "toolCall":
            return (
              <ToolCall
                key={i}
                toolCall={{
                  toolName: block.name,
                  args: block.arguments,
                }}
              />
            );
          default:
            return null;
        }
      })}
      {isStreaming && (
        <span style={{ color: "#27ae60" }}>▌</span>
      )}
    </div>
  );
}
