// Server -> Client events for pi-web
// Mirrors the pi --mode rpc event protocol for WebSocket transport

import type { AgentStateSnapshot } from "./protocol.js";

export type ServerMessage =
  | { type: "event"; event: AgentEvent }
  | { type: "state"; state: AgentStateSnapshot }
  | { type: "response"; id?: string; command: string; success: true; data?: unknown }
  | { type: "response"; id?: string; command: string; success: false; error: string };

export type AgentEvent =
  | AgentLifecycleEvent
  | TurnEvent
  | MessageEvent
  | ToolExecutionEvent
  | QueueEvent
  | CompactionEvent
  | AutoRetryEvent
  | ExtensionUIEvent;

export type ExtensionUIEvent = {
  type: "extension_ui_request";
} & ExtensionUIRequest;

export type AgentLifecycleEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: unknown[] };

export type TurnEvent =
  | { type: "turn_start" }
  | { type: "turn_end"; message: unknown; toolResults: unknown[] };

export type MessageEvent =
  | { type: "message_start"; message: unknown }
  | { type: "message_update"; message: unknown; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: unknown };

export type AssistantMessageEvent =
  | { type: "start" }
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number; content: string }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number; content: string }
  | { type: "toolcall_start"; contentIndex: number }
  | { type: "toolcall_delta"; contentIndex: number; delta: string }
  | { type: "toolcall_end"; contentIndex: number; toolCall: unknown }
  | { type: "done"; reason: string }
  | { type: "error"; reason: string };

export type ToolExecutionEvent =
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: Record<string, unknown>; partialResult: unknown }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: unknown; isError: boolean };

export type QueueEvent =
  | { type: "queue_update"; steering: string[]; followUp: string[] };

export type CompactionEvent =
  | { type: "compaction_start"; reason: "manual" | "threshold" | "overflow" }
  | { type: "compaction_end"; reason: "manual" | "threshold" | "overflow"; result: unknown; aborted: boolean; willRetry: boolean; errorMessage?: string };

export type AutoRetryEvent =
  | { type: "auto_retry_start"; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
  | { type: "auto_retry_end"; success: boolean; attempt: number; finalError?: string };

export type ExtensionUIRequest =
  | ExtensionUISelectRequest
  | ExtensionUIConfirmRequest
  | ExtensionUIInputRequest
  | ExtensionUIEditorRequest
  | ExtensionUINotifyRequest
  | ExtensionUISetStatusRequest
  | ExtensionUISetWidgetRequest
  | ExtensionUISetTitleRequest
  | ExtensionUISetEditorTextRequest;

export interface ExtensionUISelectRequest {
  method: "select";
  id: string;
  title: string;
  message?: string;
  options: string[];
  timeout?: number;
}

export interface ExtensionUIConfirmRequest {
  method: "confirm";
  id: string;
  title: string;
  message?: string;
  timeout?: number;
}

export interface ExtensionUIInputRequest {
  method: "input";
  id: string;
  title: string;
  message?: string;
  placeholder?: string;
  timeout?: number;
}

export interface ExtensionUIEditorRequest {
  method: "editor";
  id: string;
  title: string;
  message?: string;
  prefill?: string;
  timeout?: number;
}

export interface ExtensionUINotifyRequest {
  method: "notify";
  id: string;
  message: string;
  notifyType?: "info" | "warning" | "error";
}

export interface ExtensionUISetStatusRequest {
  method: "setStatus";
  id: string;
  statusKey: string;
  statusText?: string;
}

export interface ExtensionUISetWidgetRequest {
  method: "setWidget";
  id: string;
  widgetKey: string;
  widgetLines?: string[];
  widgetPlacement?: "aboveEditor" | "belowEditor";
}

export interface ExtensionUISetTitleRequest {
  method: "setTitle";
  id: string;
  title: string;
}

export interface ExtensionUISetEditorTextRequest {
  method: "set_editor_text";
  id: string;
  text: string;
}
