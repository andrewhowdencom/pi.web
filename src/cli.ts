import { startServer } from "./server/index.js";
import open from "open";

async function main() {
  const args = process.argv.slice(2);
  let port: number | undefined;
  let noOpen = false;
  let agentUrl: string | undefined;

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
      case "--agent-url":
        agentUrl = args[++i];
        break;
      case "--help":
      case "-h":
        console.log(`Usage: pi-web [options]

Options:
  --port, -p <number>  Server port (default: 3142)
  --no-open            Don't open browser automatically
  --agent-url <url>    WebSocket URL of the external pi agent (e.g. ws://localhost:3141)
  --help, -h           Show this help message
`);
        process.exit(0);
    }
  }

  if (!agentUrl) {
    console.error("Error: --agent-url is required. Specify the WebSocket URL of the external pi agent.");
    process.exit(1);
  }

  if (!agentUrl.startsWith("ws://") && !agentUrl.startsWith("wss://")) {
    console.error("Error: --agent-url must start with ws:// or wss://");
    process.exit(1);
  }

  const { httpServer, agent, port: actualPort } = await startServer({
    port,
    agentUrl,
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
