import React, { useState } from "react";

interface InputAreaProps {
  connected: boolean;
  isStreaming: boolean;
  onSend: (message: string) => void;
  onSteer: (message: string) => void;
  onAbort: () => void;
  onSlashCommand: (text: string) => boolean;
}

export function InputArea({
  connected,
  isStreaming,
  onSend,
  onSteer,
  onAbort,
  onSlashCommand,
}: InputAreaProps) {
  const [text, setText] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = text.trim();
      if (trimmed) {
        if (onSlashCommand(trimmed)) {
          setText("");
        } else if (isStreaming) {
          onSteer(trimmed);
          setText("");
        } else {
          onSend(trimmed);
          setText("");
        }
      }
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed) {
      if (onSlashCommand(trimmed)) {
        setText("");
      } else if (isStreaming) {
        onSteer(trimmed);
        setText("");
      } else {
        onSend(trimmed);
        setText("");
      }
    }
  };

  return (
    <div className="input-area">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!connected}
        placeholder={
          !connected
            ? "Disconnected..."
            : isStreaming
            ? "Send a steering message..."
            : "Type a prompt (Enter to send, Shift+Enter for newline)..."
        }
        rows={2}
      />
      <div className="input-buttons">
        {isStreaming ? (
          <>
            <button onClick={handleSend} disabled={!connected || !text.trim()}>
              Steer
            </button>
            <button onClick={onAbort} disabled={!connected}>
              Abort
            </button>
          </>
        ) : (
          <button onClick={handleSend} disabled={!connected || !text.trim()}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
