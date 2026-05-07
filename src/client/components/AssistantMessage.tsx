import React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer.js";
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
        <MarkdownRenderer
          content={(message as any)?.content ?? ""}
          isStreaming={isStreaming}
        />
      </div>
    );
  }

  return (
    <div className="message message-assistant">
      {content.map((block: any, i: number) => {
        switch (block?.type) {
          case "text":
            return (
              <MarkdownRenderer
                key={i}
                content={block.text ?? ""}
                isStreaming={isStreaming}
              />
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
