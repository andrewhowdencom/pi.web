import React, { useState, useEffect } from "react";
import type { ExtensionUIRequest } from "../../shared/events.js";

interface ExtensionUIDialogProps {
  request: ExtensionUIRequest;
  onResponse: (
    id: string,
    response: { value?: string; confirmed?: boolean }
  ) => void;
  onCancel: (id: string) => void;
}

const TimeoutNote: React.FC<{ timeout?: number }> = ({ timeout }) => {
  if (!timeout) return null;
  return (
    <p className="extension-ui-dialog-timeout">
      Auto-dismisses in {Math.ceil(timeout / 1000)}s
    </p>
  );
};

export const ExtensionUIDialog: React.FC<ExtensionUIDialogProps> = ({
  request,
  onResponse,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (request.method === "input") {
      setInputValue("");
    } else if (request.method === "editor") {
      setInputValue(request.prefill ?? "");
    }
  }, [request.id]);

  const renderContent = () => {
    switch (request.method) {
      case "confirm":
        return (
          <>
            <h2 className="extension-ui-dialog-title">{request.title}</h2>
            {request.message && (
              <p className="extension-ui-dialog-message">{request.message}</p>
            )}
            <TimeoutNote timeout={request.timeout} />
            <div className="extension-ui-dialog-buttons">
              <button
                onClick={() =>
                  onResponse(request.id, { confirmed: true })
                }
              >
                Confirm
              </button>
              <button onClick={() => onCancel(request.id)}>Cancel</button>
            </div>
          </>
        );
      case "select":
        return (
          <>
            <h2 className="extension-ui-dialog-title">{request.title}</h2>
            {request.message && (
              <p className="extension-ui-dialog-message">{request.message}</p>
            )}
            <TimeoutNote timeout={request.timeout} />
            <div className="extension-ui-dialog-options">
              {request.options.map((option) => (
                <button
                  key={option}
                  onClick={() =>
                    onResponse(request.id, { value: option })
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="extension-ui-dialog-buttons">
              <button onClick={() => onCancel(request.id)}>Cancel</button>
            </div>
          </>
        );
      case "input":
        return (
          <>
            <h2 className="extension-ui-dialog-title">{request.title}</h2>
            {request.message && (
              <p className="extension-ui-dialog-message">{request.message}</p>
            )}
            <TimeoutNote timeout={request.timeout} />
            <input
              className="extension-ui-input"
              type="text"
              placeholder={request.placeholder ?? ""}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue) {
                  onResponse(request.id, { value: inputValue });
                }
              }}
              autoFocus
            />
            <div className="extension-ui-dialog-buttons">
              <button
                onClick={() =>
                  onResponse(request.id, { value: inputValue })
                }
                disabled={!inputValue}
              >
                Submit
              </button>
              <button onClick={() => onCancel(request.id)}>Cancel</button>
            </div>
          </>
        );
      case "editor":
        return (
          <>
            <h2 className="extension-ui-dialog-title">{request.title}</h2>
            {request.message && (
              <p className="extension-ui-dialog-message">{request.message}</p>
            )}
            <TimeoutNote timeout={request.timeout} />
            <textarea
              className="extension-ui-textarea"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
            <div className="extension-ui-dialog-buttons">
              <button
                onClick={() =>
                  onResponse(request.id, { value: inputValue })
                }
              >
                Submit
              </button>
              <button onClick={() => onCancel(request.id)}>Cancel</button>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="extension-ui-overlay">
      <div className="extension-ui-dialog">{renderContent()}</div>
    </div>
  );
};
