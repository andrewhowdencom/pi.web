import React, { useRef, useEffect } from "react";
import { UserMessage } from "./UserMessage.js";
import { AssistantMessage } from "./AssistantMessage.js";
import { ToolResult } from "./ToolResult.js";

interface MessageListProps {
  messages: unknown[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="message-list">
      {messages.map((msg, i) => {
        const role = getRole(msg);
        const isLast = i === messages.length - 1;

        switch (role) {
          case "user":
            return <UserMessage key={i} message={msg} />;
          case "assistant":
            return (
              <AssistantMessage
                key={i}
                message={msg}
                isStreaming={isStreaming && isLast}
              />
            );
          case "toolResult":
            return <ToolResult key={i} message={msg} />;
          default:
            return (
              <div key={i} className="message">
                Unknown message type
              </div>
            );
        }
      })}
      {isStreaming && (
        <div className="streaming-indicator">●</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function getRole(msg: unknown): string | null {
  if (typeof msg !== "object" || msg === null) return null;
  return (msg as any).role ?? null;
}
