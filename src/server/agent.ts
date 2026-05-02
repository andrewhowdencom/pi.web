import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type PromptOptions,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { AgentStateSnapshot } from "../shared/protocol.js";

export type EventCallback = (event: AgentSessionEvent) => void;

export class AgentService {
  private session: AgentSession | null = null;
  private callbacks: Set<EventCallback> = new Set();
  private unsubscribe: (() => void) | null = null;

  async initialize(cwd: string = process.cwd()): Promise<void> {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);

    const { session } = await createAgentSession({
      sessionManager: SessionManager.create(cwd),
      authStorage,
      modelRegistry,
    });

    this.session = session;

    this.unsubscribe = session.subscribe((event) => {
      this.broadcast(event);
    });
  }

  private broadcast(event: AgentSessionEvent): void {
    for (const cb of this.callbacks) {
      try {
        cb(event);
      } catch (err) {
        console.error("Event callback error:", err);
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
    if (!this.session) {
      return {
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
    }

    const s = this.session;
    return {
      model: s.model?.id ?? null,
      thinkingLevel: s.thinkingLevel,
      isStreaming: s.isStreaming,
      isCompacting: false,
      sessionFile: s.sessionFile ?? null,
      sessionId: s.sessionId,
      sessionName: null,
      autoCompactionEnabled: true,
      messageCount: s.messages.length,
      pendingMessageCount: 0,
    };
  }

  getMessages(): unknown[] {
    if (!this.session) return [];
    return this.session.messages;
  }

  async prompt(message: string, options?: PromptOptions): Promise<void> {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.prompt(message, options);
  }

  async steer(message: string): Promise<void> {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.steer(message);
  }

  async followUp(message: string): Promise<void> {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.followUp(message);
  }

  async abort(): Promise<void> {
    if (!this.session) throw new Error("Session not initialized");
    await this.session.abort();
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    if (!this.session) throw new Error("Session not initialized");
    const model = getModel(provider as any, modelId as any);
    if (!model) throw new Error(`Model not found: ${provider}/${modelId}`);
    await this.session.setModel(model as any);
  }

  setThinkingLevel(level: string): void {
    if (!this.session) throw new Error("Session not initialized");
    this.session.setThinkingLevel(level as any);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.callbacks.clear();
    this.session?.dispose();
    this.session = null;
  }
}
