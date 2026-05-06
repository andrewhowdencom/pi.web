// Shared protocol types for pi-web
// Mirrors the pi --mode rpc protocol for WebSocket transport

// ============ Client -> Server Commands ============

export type RpcCommand =
  | PromptCommand
  | SteerCommand
  | FollowUpCommand
  | AbortCommand
  | GetStateCommand
  | GetMessagesCommand
  | SetModelCommand
  | SetThinkingLevelCommand
  | NewSessionCommand
  | CompactCommand
  | ExtensionUIResponseCommand;

export interface PromptCommand {
  id?: string;
  type: "prompt";
  message: string;
  streamingBehavior?: "steer" | "followUp";
}

export interface SteerCommand {
  id?: string;
  type: "steer";
  message: string;
}

export interface FollowUpCommand {
  id?: string;
  type: "follow_up";
  message: string;
}

export interface AbortCommand {
  id?: string;
  type: "abort";
}

export interface GetStateCommand {
  id?: string;
  type: "get_state";
}

export interface GetMessagesCommand {
  id?: string;
  type: "get_messages";
}

export interface SetModelCommand {
  id?: string;
  type: "set_model";
  provider: string;
  modelId: string;
}

export interface SetThinkingLevelCommand {
  id?: string;
  type: "set_thinking_level";
  level: string;
}

export interface NewSessionCommand {
  id?: string;
  type: "new_session";
}

export interface CompactCommand {
  id?: string;
  type: "compact";
  customInstructions?: string;
}

export interface ExtensionUIResponseCommand {
  type: "extension_ui_response";
  id: string;
  value?: string;
  confirmed?: boolean;
  cancelled?: boolean;
}

// ============ Server -> Client Responses ============

export type RpcResponse = SuccessResponse | ErrorResponse;

export interface SuccessResponse {
  id?: string;
  type: "response";
  command: string;
  success: true;
  data?: unknown;
}

export interface ErrorResponse {
  id?: string;
  type: "response";
  command: string;
  success: false;
  error: string;
}

// ============ State Snapshot ============

export interface AgentStateSnapshot {
  model: string | null;
  thinkingLevel: string;
  isStreaming: boolean;
  isCompacting: boolean;
  sessionFile: string | null;
  sessionId: string;
  sessionName: string | null;
  autoCompactionEnabled: boolean;
  messageCount: number;
  pendingMessageCount: number;
  workingDirectory: string | null;
}

// ============ Client Types ============

export type ClientMessage = RpcCommand;
