import React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer.js";

interface UserMessageProps {
  message: unknown;
}

export function UserMessage({ message }: UserMessageProps) {
  const text = extractText(message);
  return (
    <div className="message message-user">
      <MarkdownRenderer content={text} />
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
