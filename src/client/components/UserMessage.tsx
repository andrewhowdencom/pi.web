import React from "react";

interface UserMessageProps {
  message: unknown;
}

export function UserMessage({ message }: UserMessageProps) {
  const text = extractText(message);
  return (
    <div className="message message-user">
      <div className="message-text">{text}</div>
    </div>
  );
}

function extractText(msg: unknown): string {
  if (typeof msg !== "object" || msg === null) return "";
  const content = (msg as any).content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c?.text ?? "")
      .join("\n");
  }

  return "";
}
