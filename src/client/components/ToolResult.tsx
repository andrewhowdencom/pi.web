import React from "react";

interface ToolResultProps {
  message: unknown;
}

export function ToolResult({ message }: ToolResultProps) {
  if (typeof message !== "object" || message === null) return null;

  const msg = message as any;
  const toolName = msg.toolName ?? "unknown";
  const isError = msg.isError ?? false;
  const text = extractText(message);

  return (
    <div className={`message message-tool${isError ? " error" : ""}`}>
      <div className="message-tool-header">
        <span>Tool: {toolName}</span>
        {isError && <span style={{ color: "#c0392b" }}>Error</span>}
      </div>
      <div className="message-tool-output">{text}</div>
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
