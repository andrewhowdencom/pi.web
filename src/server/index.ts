import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { AgentService } from "./agent.js";
import { createWebSocketBridge } from "./websocket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  port?: number;
  cwd?: string;
  staticDir?: string;
}

export async function startServer(
  options: ServerOptions
): Promise<{
  httpServer: ReturnType<typeof createServer>;
  wss: ReturnType<typeof createWebSocketBridge>;
  agent: AgentService;
  port: number;
}> {
  const preferredPort = options.port || 3142;
  const staticDir =
    options.staticDir || path.resolve(__dirname, "../../dist/client");

  const cwd = options.cwd || process.cwd();

  // Initialize agent
  const agent = new AgentService();
  await agent.initialize(cwd);

  // Create Express app
  const app = express();
  app.use(express.static(staticDir));

  // Fallback to index.html for SPA routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });

  // Find available port
  const port = await findPort(preferredPort);

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket bridge
  const wss = createWebSocketBridge(httpServer, agent);

  // Start listening
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      console.log(`pi-web server running on http://localhost:${port}`);
      resolve();
    });
    httpServer.on("error", reject);
  });

  return { httpServer, wss, agent, port };
}

function findPort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(preferred, () => {
      const addr = server.address();
      const port =
        typeof addr === "object" && addr !== null ? addr.port : preferred;
      server.close(() => resolve(port));
    });
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        server.close(() => {
          const fallback = createServer();
          fallback.listen(0, () => {
            const addr = fallback.address();
            const port =
              typeof addr === "object" && addr !== null ? addr.port : 0;
            fallback.close(() => resolve(port));
          });
          fallback.on("error", reject);
        });
      } else {
        server.close();
        reject(err);
      }
    });
  });
}
