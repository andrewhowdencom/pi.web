// Simple structured logger with configurable level.
// Set via --log-level CLI flag or PI_WEB_LOG_LEVEL env variable.
// Defaults to "info".

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function logAtLevel(level: LogLevel, label: string, ...args: unknown[]): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${label.toUpperCase()}]`;

  if (level === "error") {
    console.error(prefix, ...args);
  } else if (level === "warn") {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export function debug(...args: unknown[]): void {
  logAtLevel("debug", "debug", ...args);
}

export function info(...args: unknown[]): void {
  logAtLevel("info", "info", ...args);
}

export function warn(...args: unknown[]): void {
  logAtLevel("warn", "warn", ...args);
}

export function error(...args: unknown[]): void {
  logAtLevel("error", "error", ...args);
}
