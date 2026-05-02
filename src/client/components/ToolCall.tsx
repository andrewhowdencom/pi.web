import React from "react";

interface ToolCallProps {
  toolCall: {
    id?: string;
    toolName: string;
    args: Record<string, unknown>;
  };
}

export const ToolCall: React.FC<ToolCallProps> = ({ toolCall }) => {
  const { toolName, args } = toolCall;
  const argsString = JSON.stringify(args, null, 2);

  return (
    <div className="tool-call">
      <details>
        <summary>
          <span className="tool-call-icon">🔧</span>
          <span className="tool-call-name">{toolName}</span>
        </summary>
        <div className="tool-call-args">
          <pre>{argsString}</pre>
        </div>
      </details>
    </div>
  );
};
