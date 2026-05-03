import { startServer } from "./server/index.js";
import open from "open";
import { setLogLevel, type LogLevel } from "./shared/logger.js";

async function main() {
  const args = process.argv.slice(2);
  let port: number | undefined;
  let noOpen = false;
  let cwd = process.cwd();
  let logLevel: LogLevel | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--port":
      case "-p":
        port = parseInt(args[++i], 10);
        break;
      case "--no-open":
        noOpen = true;
        break;
      case "--cwd":
        cwd = args[++i];
        break;
      case "--log-level":
        logLevel = args[++i] as LogLevel;
        break;
      case "--help":
      case "-h":
        console.log(`Usage: pi-web [options]

Options:
  --port, -p <number>  Server port (default: 3142)
  --no-open            Don't open browser automatically
  --cwd <path>         Working directory for the pi agent (default: current directory)
  --log-level <level>  Logging level: debug, info, warn, error (default: info)
  --help, -h           Show this help message
`);
        process.exit(0);
    }
  }

  // Apply log level from CLI flag or environment variable
  const effectiveLevel: LogLevel =
    logLevel ??
    (process.env.PI_WEB_LOG_LEVEL as LogLevel | undefined) ??
    "info";
  setLogLevel(effectiveLevel);

  const { httpServer, agent, port: actualPort } = await startServer({
    port,
    cwd,
  });

  if (!noOpen) {
    try {
      await open(`http://localhost:${actualPort}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
    }
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    agent.dispose();
    httpServer.close(() => {
      process.exit(0);
    });
    // Force exit after 5s if server doesn't close
    setTimeout(() => process.exit(1), 5000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
