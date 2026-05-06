const STORAGE_KEY = "pi_web_messages";

export interface PersistedMessages {
  sessionId: string;
  messages: unknown[];
  timestamp: number;
}

export function saveMessages(sessionId: string, messages: unknown[]): void {
  try {
    const payload: PersistedMessages = {
      sessionId,
      messages,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to persist messages:", e);
  }
}

export function loadMessages(): PersistedMessages | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedMessages;
  } catch (e) {
    console.warn("Failed to load persisted messages:", e);
    return null;
  }
}

export function clearMessages(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear persisted messages:", e);
  }
}
