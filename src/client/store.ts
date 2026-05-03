import { useState, useEffect } from "react";
import type { AgentStateSnapshot, ExtensionUIResponseCommand, RpcCommand } from "../shared/protocol.js";
import type { AgentEvent, ExtensionUIRequest, ServerMessage } from "../shared/events.js";
import { createWebSocketClient, type WebSocketClient } from "./websocket.js";

export interface UINotification {
  id: string;
  type: "info" | "warning" | "error";
  message: string;
  timestamp: number;
}

export interface AppState {
  connected: boolean;
  messages: unknown[];
  isStreaming: boolean;
  agentState: AgentStateSnapshot | null;
  pendingUIRequests: ExtensionUIRequest[];
  notifications: UINotification[];
}

const initialState: AppState = {
  connected: false,
  messages: [],
  isStreaming: false,
  agentState: null,
  pendingUIRequests: [],
  notifications: [],
};

class AgentStore {
  private client: WebSocketClient;
  private state: AppState = initialState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private unsubMessage: (() => void) | null = null;
  private unsubOpen: (() => void) | null = null;
  private unsubClose: (() => void) | null = null;

  constructor(url?: string) {
    this.client = createWebSocketClient(url);

    this.unsubOpen = this.client.onOpen(() => {
      this.setState({ ...this.state, connected: true });
    });

    this.unsubClose = this.client.onClose(() => {
      this.setState({ ...this.state, connected: false });
    });

    this.unsubMessage = this.client.onMessage((msg) => {
      this.handleServerMessage(msg);
    });
  }

  connect(): void {
    this.client.connect();
  }

  disconnect(): void {
    this.unsubMessage?.();
    this.unsubOpen?.();
    this.unsubClose?.();
    this.client.disconnect();
  }

  sendCommand(cmd: RpcCommand): void {
    this.client.send(cmd);
  }

  sendPrompt(message: string): void {
    this.sendCommand({ type: "prompt", message });
  }

  sendSteer(message: string): void {
    this.sendCommand({ type: "steer", message });
  }

  sendAbort(): void {
    this.sendCommand({ type: "abort" });
  }

  sendExtensionUIResponse(
    id: string,
    response: { value?: string; confirmed?: boolean; cancelled?: boolean }
  ): void {
    const request = this.state.pendingUIRequests.find((r) => r.id === id);
    if (!request) {
      console.warn("No pending UI request found for id:", id);
      return;
    }

    const cmd: ExtensionUIResponseCommand = {
      type: "extension_ui_response",
      id,
      ...response,
    };

    this.sendCommand(cmd);
    this.setState({
      ...this.state,
      pendingUIRequests: this.state.pendingUIRequests.filter((r) => r.id !== id),
    });
  }

  dismissNotification(id: string): void {
    this.setState({
      ...this.state,
      notifications: this.state.notifications.filter((n) => n.id !== id),
    });
  }

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: AppState): void {
    this.state = newState;
    for (const listener of this.listeners) {
      listener(newState);
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "event":
        this.handleEvent(msg.event);
        break;
      case "state":
        this.setState({ ...this.state, agentState: msg.state });
        break;
      case "response":
        console.log("Response:", msg);
        break;
    }
  }

  private handleEvent(event: AgentEvent): void {
    switch (event.type) {
      case "agent_start":
        this.setState({ ...this.state, isStreaming: true });
        break;
      case "agent_end":
        this.setState({ ...this.state, isStreaming: false });
        break;
      case "message_start": {
        const messages = [...this.state.messages, event.message];
        this.setState({ ...this.state, messages });
        break;
      }
      case "message_update": {
        const messages = [...this.state.messages];
        const lastIdx = messages.length - 1;
        if (lastIdx >= 0 && isAssistantMessage(messages[lastIdx])) {
          messages[lastIdx] = event.message;
        }
        this.setState({ ...this.state, messages });
        break;
      }
      case "message_end": {
        const messages = [...this.state.messages];
        const lastIdx = messages.length - 1;
        if (lastIdx >= 0 && isAssistantMessage(messages[lastIdx])) {
          messages[lastIdx] = event.message;
        }
        this.setState({ ...this.state, messages });
        break;
      }
      case "turn_end": {
        const messages = [...this.state.messages];
        for (const toolResult of event.toolResults) {
          messages.push(toolResult);
        }
        this.setState({ ...this.state, messages });
        break;
      }
      case "queue_update":
        this.setState({
          ...this.state,
          agentState: this.state.agentState
            ? {
                ...this.state.agentState,
                pendingMessageCount:
                  event.steering.length + event.followUp.length,
              }
            : null,
        });
        break;
      case "extension_ui_request": {
        switch (event.method) {
          case "select":
          case "confirm":
          case "input":
          case "editor": {
            this.setState({
              ...this.state,
              pendingUIRequests: [...this.state.pendingUIRequests, event],
            });
            break;
          }
          case "notify": {
            const notification: UINotification = {
              id: event.id,
              type: event.notifyType ?? "info",
              message: event.message,
              timestamp: Date.now(),
            };
            this.setState({
              ...this.state,
              notifications: [...this.state.notifications, notification],
            });
            break;
          }
          case "setStatus": {
            const notification: UINotification = {
              id: event.id,
              type: "info",
              message: `Status [${event.statusKey}]: ${event.statusText ?? "(cleared)"}`,
              timestamp: Date.now(),
            };
            this.setState({
              ...this.state,
              notifications: [...this.state.notifications, notification],
            });
            break;
          }
          case "setWidget":
          case "setTitle":
          case "set_editor_text": {
            console.log(`Extension UI ${event.method}:`, event);
            break;
          }
          default: {
            const cmd: ExtensionUIResponseCommand = {
              type: "extension_ui_response",
              id: (event as any).id,
              cancelled: true,
            };
            this.sendCommand(cmd);
            const notification: UINotification = {
              id: (event as any).id,
              type: "warning",
              message: `Web UI received an unsupported extension UI method '${(event as any).method}'. The agent has been notified with a cancellation response.`,
              timestamp: Date.now(),
            };
            this.setState({
              ...this.state,
              notifications: [...this.state.notifications, notification],
            });
            console.warn("Unknown extension_ui_request method:", event);
            break;
          }
        }
        break;
      }
      default: {
        const notification: UINotification = {
          id: `unknown-${Date.now()}`,
          type: "warning",
          message: `Web UI received an unsupported event type '${event.type}'. No response was sent to the agent — this event was informational only.`,
          timestamp: Date.now(),
        };
        this.setState({
          ...this.state,
          notifications: [...this.state.notifications, notification],
        });
        console.warn("Unknown event type:", event);
        break;
      }
    }
  }
}

function isAssistantMessage(msg: unknown): boolean {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as any).role === "assistant"
  );
}

const store = new AgentStore();

export function useAgent() {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    store.connect();
    return store.subscribe(setState);
  }, []);

  return {
    ...state,
    sendPrompt: (msg: string) => store.sendPrompt(msg),
    sendSteer: (msg: string) => store.sendSteer(msg),
    sendAbort: () => store.sendAbort(),
    sendExtensionUIResponse: (id: string, response: { value?: string; confirmed?: boolean; cancelled?: boolean }) =>
      store.sendExtensionUIResponse(id, response),
    dismissNotification: (id: string) => store.dismissNotification(id),
  };
}
