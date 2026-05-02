import { WebSocket } from "ws";
import type { AgentEvent } from "../shared/events.js";
import type { AgentStateSnapshot, RpcCommand } from "../shared/protocol.js";

export type EventCallback = (event: AgentEvent) => void;

interface PromptOptions {
  streamingBehavior?: "steer" | "followUp";
}

const DEFAULT_STATE: AgentStateSnapshot = {
  model: null,
  thinkingLevel: "off",
  isStreaming: false,
  isCompacting: false,
  sessionFile: null,
  sessionId: "",
  sessionName: null,
  autoCompactionEnabled: true,
  messageCount: 0,
  pendingMessageCount: 0,
};

export class AgentService {
  private ws: WebSocket | null = null;
  private callbacks: Set<EventCallback> = new Set();
  private state: AgentStateSnapshot | null = null;
  private messages: unknown[] = [];
  private agentUrl: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connected = false;

  async initialize(agentUrl: string): Promise<void> {
    this.agentUrl = agentUrl;
    return this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.agentUrl) {
        reject(new Error("agentUrl not set"));
        return;
      }

      let hasResolved = false;

      this.ws = new WebSocket(this.agentUrl);

      this.ws.on("open", () => {
        this.connected = true;
        this.reconnectDelay = 1000;
        hasResolved = true;
        console.log(`Connected to external pi agent at ${this.agentUrl}`);
        this.sendRaw({ type: "get_state" });
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (err) {
          console.error("Failed to parse agent message:", err);
        }
      });

      this.ws.on("error", (err) => {
        console.error("External agent connection error:", err);
        if (!hasResolved) {
          reject(err);
        }
      });

      this.ws.on("close", () => {
        console.log("External agent connection closed");
        this.connected = false;
        this.ws = null;
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.agentUrl) return;

    console.log(
      `Reconnecting to external agent in ${this.reconnectDelay}ms...`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.error("Reconnection failed:", err);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case "event":
        this.broadcast(msg.event);
        this.updateFromEvent(msg.event);
        break;
      case "state":
        this.state = msg.state;
        break;
      case "response":
        // Responses are routed by the server layer (websocket.ts) via command IDs.
        // The external agent sends responses for commands we forwarded.
        // For now, we don't need to handle them here since commands are
        // fire-and-forget from the AgentService perspective.
        break;
      default:
        console.warn("Unknown message type from external agent:", msg.type);
    }
  }

  private broadcast(event: AgentEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        console.error("Event callback error:", err);
      }
    }
  }

  private updateFromEvent(event: AgentEvent): void {
    switch (event.type) {
      case "agent_end": {
        this.messages = event.messages;
        break;
      }
      case "message_start": {
        this.messages.push(event.message);
        if (this.state) {
          this.state = { ...this.state, messageCount: this.messages.length };
        }
        break;
      }
      case "message_update":
      case "message_end": {
        const lastIdx = this.messages.length - 1;
        if (lastIdx >= 0) {
          this.messages[lastIdx] = event.message;
        }
        break;
      }
      case "turn_end": {
        for (const toolResult of event.toolResults) {
          this.messages.push(toolResult);
        }
        if (this.state) {
          this.state = { ...this.state, messageCount: this.messages.length };
        }
        break;
      }
      case "queue_update": {
        if (this.state) {
          this.state = {
            ...this.state,
            pendingMessageCount: event.steering.length + event.followUp.length,
          };
        }
        break;
      }
    }
  }

  onEvent(callback: EventCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  getState(): AgentStateSnapshot {
    if (!this.state) {
      return DEFAULT_STATE;
    }
    return {
      ...this.state,
      isStreaming: this.connected && this.state.isStreaming,
    };
  }

  getMessages(): unknown[] {
    return this.messages;
  }

  async prompt(message: string, options?: PromptOptions): Promise<void> {
    this.sendCommand({
      type: "prompt",
      message,
      streamingBehavior: options?.streamingBehavior,
    });
  }

  async steer(message: string): Promise<void> {
    this.sendCommand({ type: "steer", message });
  }

  async followUp(message: string): Promise<void> {
    this.sendCommand({ type: "follow_up", message });
  }

  async abort(): Promise<void> {
    this.sendCommand({ type: "abort" });
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    this.sendCommand({ type: "set_model", provider, modelId });
  }

  setThinkingLevel(level: string): void {
    this.sendCommand({ type: "set_thinking_level", level });
  }

  private sendCommand(cmd: RpcCommand): void {
    this.sendRaw(cmd);
  }

  private sendRaw(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to external agent");
    }
    this.ws.send(JSON.stringify(data));
  }

  dispose(): void {
    this.callbacks.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.state = null;
    this.messages = [];
  }
}
