import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { AgentService } from "./agent.js";
import type {
  RpcCommand,
  RpcResponse,
  AgentStateSnapshot,
} from "../shared/protocol.js";
import type { AgentEvent } from "../shared/events.js";
import { debug, error as logError, info } from "../shared/logger.js";

export function createWebSocketBridge(
  httpServer: Server,
  agent: AgentService
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Set<WebSocket>();

  // Forward agent events to all connected clients
  const unsubscribe = agent.onEvent((sdkEvent) => {
    try {
      const event = sdkEvent as AgentEvent;
      info("Broadcasting event:", event.type);
      const payload = JSON.stringify({ type: "event", event });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    } catch (err) {
      console.error("Failed to serialize/broadcast event:", err);
    }
  });

  wss.on("connection", (ws) => {
    clients.add(ws);

    // Send current state on connect
    try {
      const state = agent.getState();
      ws.send(JSON.stringify({ type: "state", state }));
    } catch (err) {
      console.error("Failed to send initial state:", err);
    }

    ws.on("message", async (rawData) => {
      try {
        const cmd = JSON.parse(rawData.toString()) as RpcCommand;
        debug("WebSocket command:", cmd);
        await handleCommand(ws, cmd, agent);
      } catch (err) {
        logError("WebSocket message error:", err);
        sendError(ws, undefined, "parse", String(err));
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", (err) => {
      logError("WebSocket client error:", err);
      clients.delete(ws);
    });
  });

  // Cleanup on server close
  wss.on("close", () => {
    unsubscribe();
    clients.clear();
  });

  return wss;
}

async function handleCommand(
  ws: WebSocket,
  cmd: RpcCommand,
  agent: AgentService
): Promise<void> {
  try {
    switch (cmd.type) {
      case "prompt": {
        await agent.prompt(cmd.message, {
          streamingBehavior: cmd.streamingBehavior,
        });
        sendSuccess(ws, cmd.id, "prompt");
        break;
      }
      case "steer": {
        await agent.steer(cmd.message);
        sendSuccess(ws, cmd.id, "steer");
        break;
      }
      case "follow_up": {
        await agent.followUp(cmd.message);
        sendSuccess(ws, cmd.id, "follow_up");
        break;
      }
      case "abort": {
        await agent.abort();
        sendSuccess(ws, cmd.id, "abort");
        break;
      }
      case "get_state": {
        const state = agent.getState();
        sendSuccess(ws, cmd.id, "get_state", state);
        break;
      }
      case "get_messages": {
        const messages = agent.getMessages();
        sendSuccess(ws, cmd.id, "get_messages", { messages });
        break;
      }
      case "set_model": {
        await agent.setModel(cmd.provider, cmd.modelId);
        sendSuccess(ws, cmd.id, "set_model");
        break;
      }
      case "set_thinking_level": {
        agent.setThinkingLevel(cmd.level);
        sendSuccess(ws, cmd.id, "set_thinking_level");
        break;
      }
      case "new_session": {
        sendError(ws, cmd.id, "new_session", "new_session not yet implemented");
        break;
      }
      case "compact": {
        sendError(ws, cmd.id, "compact", "compact not yet implemented");
        break;
      }
      case "extension_ui_response": {
        agent.sendExtensionUIResponse(cmd);
        sendSuccess(ws, cmd.id, "extension_ui_response");
        break;
      }
      default: {
        sendError(
          ws,
          (cmd as any).id,
          (cmd as any).type ?? "unknown",
          "Unknown command type"
        );
        break;
      }
    }
  } catch (err) {
    logError(`Command ${cmd.type} error:`, err);
    sendError(ws, cmd.id, cmd.type, String(err));
  }
}

function sendSuccess(
  ws: WebSocket,
  id: string | undefined,
  command: string,
  data?: unknown
): void {
  const response: RpcResponse = {
    ...(id !== undefined ? { id } : {}),
    type: "response",
    command,
    success: true,
    ...(data !== undefined ? { data } : {}),
  };
  debug("WebSocket response:", response);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

function sendError(
  ws: WebSocket,
  id: string | undefined,
  command: string,
  error: string
): void {
  const response: RpcResponse = {
    ...(id !== undefined ? { id } : {}),
    type: "response",
    command,
    success: false,
    error,
  };
  debug("WebSocket response:", response);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}
