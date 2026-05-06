import { spawn, type ChildProcess } from "child_process";
import { StringDecoder } from "string_decoder";
import type { AgentEvent } from "../shared/events.js";
import type { AgentStateSnapshot, ExtensionUIResponseCommand, RpcCommand } from "../shared/protocol.js";
import { debug, error as logError } from "../shared/logger.js";

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
  workingDirectory: null,
};

export class AgentService {
  private process: ChildProcess | null = null;
  private callbacks: Set<EventCallback> = new Set();
  private state: AgentStateSnapshot | null = null;
  private messages: unknown[] = [];
  private cwd: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connected = false;
  private isDisposed = false;
  private decoder = new StringDecoder("utf8");
  private buffer = "";

  async initialize(cwd: string): Promise<void> {
    this.cwd = cwd;
    return this.spawnAgent();
  }

  private spawnAgent(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.cwd) {
        reject(new Error("cwd not set"));
        return;
      }

      let hasResolved = false;
      this.isDisposed = false;

      console.log(`Spawning pi agent in ${this.cwd}`);

      this.process = spawn("pi", ["--mode", "rpc"], {
        cwd: this.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Handle stdout JSONL
      this.process.stdout!.on("data", (chunk: Buffer) => {
        this.buffer += this.decoder.write(chunk);
        this.flushBuffer();
      });

      this.process.stdout!.on("end", () => {
        this.buffer += this.decoder.end();
        this.flushBuffer();
        // Process any remaining partial line (no trailing \n)
        if (this.buffer.length > 0) {
          this.processLine(this.buffer);
          this.buffer = "";
        }
      });

      // Handle stderr (log but don't fail)
      this.process.stderr!.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trimEnd();
        if (text.length > 0) {
          console.error("[pi agent stderr]", text);
        }
      });

      // Handle process exit
      this.process.on("exit", (code, signal) => {
        console.log(
          `Agent process exited (code: ${code ?? "unknown"}, signal: ${signal ?? "none"})`
        );
        this.connected = false;
        this.process = null;
        if (!hasResolved) {
          reject(
            new Error(
              `Agent process exited unexpectedly (code: ${code ?? "unknown"})`
            )
          );
        } else if (!this.isDisposed) {
          this.scheduleReconnect();
        }
      });

      // Handle process error (e.g., pi not found)
      this.process.on("error", (err) => {
        console.error("Agent process error:", err);
        if (!hasResolved) {
          reject(err);
        }
      });

      // Resolve immediately after spawn — pi RPC streams events
      // and we consider it "connected" once the process is running.
      this.connected = true;
      hasResolved = true;

      resolve();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.cwd) return;

    console.log(
      `Restarting agent process in ${this.reconnectDelay}ms...`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.spawnAgent().catch((err) => {
        console.error("Agent restart failed:", err);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }

  private flushBuffer(): void {
    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) break;

      let line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      // Strip trailing \r if present (protocol allows \r\n input)
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      this.processLine(line);
    }
  }

  private processLine(line: string): void {
    if (line.length === 0) return;
    debug("Agent raw line:", line);
    try {
      const msg = JSON.parse(line);
      this.handleMessage(msg);
    } catch (err) {
      logError("Failed to parse agent JSONL:", err, "Line:", line);
    }
  }

  private handleMessage(msg: any): void {
    if (msg.type === "response") {
      this.handleResponse(msg);
      return;
    }

    // pi --mode rpc sends bare events (not wrapped in {type: "event"})
    this.broadcast(msg);
    this.updateFromEvent(msg);
  }

  private handleResponse(msg: any): void {
    debug("Agent response:", msg);
    if (!msg.success) {
      logError(
        `Agent command '${msg.command ?? "unknown"}' failed:`,
        msg.error
      );
      return;
    }

    switch (msg.command) {
      case "get_state": {
        const rawState = msg.data;
        if (rawState) {
          rawState.model = this.normalizeModel(rawState.model);
          rawState.workingDirectory = this.cwd;
        }
        this.state = rawState;
        break;
      }
      case "get_messages":
        this.messages = msg.data?.messages ?? [];
        break;
    }
  }

  private normalizeModel(model: unknown): string | null {
    if (model === null || model === undefined) return null;
    if (typeof model === "string") return model;
    if (typeof model === "object" && model !== null) {
      const m = model as Record<string, unknown>;
      const candidate = m.model ?? m.modelId ?? m.id ?? m.name;
      if (typeof candidate === "string") return candidate;
    }
    return null;
  }

  private broadcast(event: AgentEvent): void {
    debug("Agent event:", event);
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        logError("Event callback error:", err);
      }
    }
  }

  private updateFromEvent(event: AgentEvent): void {
    switch (event.type) {
      case "agent_start": {
        if (this.state) {
          this.state = { ...this.state, isStreaming: true };
        }
        break;
      }
      case "agent_end": {
        this.messages = event.messages;
        if (this.state) {
          this.state = {
            ...this.state,
            isStreaming: false,
            messageCount: this.messages.length,
          };
        }
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
            pendingMessageCount:
              event.steering.length + event.followUp.length,
          };
        }
        break;
      }
      case "compaction_start": {
        if (this.state) {
          this.state = { ...this.state, isCompacting: true };
        }
        break;
      }
      case "compaction_end": {
        if (this.state) {
          this.state = { ...this.state, isCompacting: false };
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

  async newSession(): Promise<void> {
    this.sendCommand({ type: "new_session" });
  }

  async compact(customInstructions?: string): Promise<void> {
    this.sendCommand({ type: "compact", customInstructions });
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    this.sendCommand({ type: "set_model", provider, modelId });
  }

  setThinkingLevel(level: string): void {
    this.sendCommand({ type: "set_thinking_level", level });
  }

  sendExtensionUIResponse(response: ExtensionUIResponseCommand): void {
    this.sendRaw(response);
  }

  private sendCommand(cmd: RpcCommand): void {
    this.sendRaw(cmd);
  }

  private sendRaw(data: unknown): void {
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) {
      throw new Error("Agent process not running");
    }
    const payload = JSON.stringify(data) + "\n";
    debug("Agent request:", data);
    this.process.stdin.write(payload);
  }

  dispose(): void {
    this.isDisposed = true;
    this.callbacks.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.process?.kill();
    this.process = null;
    this.connected = false;
    this.state = null;
    this.messages = [];
  }
}
