import type { RpcCommand } from "../shared/protocol.js";
import type { ServerMessage } from "../shared/events.js";

export interface WebSocketClient {
  connect(): void;
  disconnect(): void;
  send(cmd: RpcCommand): void;
  onMessage(handler: (msg: ServerMessage) => void): () => void;
  onOpen(handler: () => void): () => void;
  onClose(handler: () => void): () => void;
  eagerReconnect(): void;
  get isOpen(): boolean;
}

export function createWebSocketClient(url: string = getWebSocketUrl()): WebSocketClient {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  const maxReconnectDelay = 30000;

  const messageHandlers = new Set<(msg: ServerMessage) => void>();
  const openHandlers = new Set<() => void>();
  const closeHandlers = new Set<() => void>();

  function connect(): void {
    if (ws?.readyState === WebSocket.OPEN) return;
    if (ws?.readyState === WebSocket.CONNECTING) return;

    ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectDelay = 1000;
      for (const h of openHandlers) h();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        for (const h of messageHandlers) h(msg);
      } catch (err) {
        console.error("Failed to parse server message:", err);
      }
    };

    ws.onclose = () => {
      for (const h of closeHandlers) h();
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }

  function disconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    ws?.close();
    ws = null;
  }

  function send(cmd: RpcCommand): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    } else {
      console.error("WebSocket not connected");
    }
  }

  function onMessage(handler: (msg: ServerMessage) => void): () => void {
    messageHandlers.add(handler);
    return () => messageHandlers.delete(handler);
  }

  function onOpen(handler: () => void): () => void {
    openHandlers.add(handler);
    return () => openHandlers.delete(handler);
  }

  function onClose(handler: () => void): () => void {
    closeHandlers.add(handler);
    return () => closeHandlers.delete(handler);
  }

  function eagerReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectDelay = 1000;
    connect();
  }

  return {
    connect,
    disconnect,
    send,
    onMessage,
    onOpen,
    onClose,
    eagerReconnect,
    get isOpen() {
      return ws?.readyState === WebSocket.OPEN;
    },
  };
}

function getWebSocketUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}`;
}
