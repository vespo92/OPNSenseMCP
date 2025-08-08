import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TransportOptions } from "./types.js";

interface SSEConnection {
  transport: SSEServerTransport;
  sessionId: string;
}

export class SSETransportServer {
  private server: Server | null = null;
  private port: number;
  private host: string;
  private corsOrigin: string;
  private connections: Map<string, SSEConnection> = new Map();
  private onConnectionCallback:
    | ((transport: Transport) => Promise<void>)
    | null = null;

  constructor(options: TransportOptions = {}) {
    this.port = options.port || 3000;
    this.host = options.host || "0.0.0.0";
    this.corsOrigin = options.corsOrigin || "*";
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        // Set CORS headers
        res.setHeader("Access-Control-Allow-Origin", this.corsOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Handle preflight
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || "/", `http://${req.headers.host}`);

        // Handle SSE connection establishment
        if (req.method === "GET" && url.pathname === "/sse") {
          await this.handleSSEConnection(req, res);
        }
        // Handle message posts
        else if (req.method === "POST" && url.pathname === "/messages") {
          await this.handlePostMessage(req, res);
        }
        // Health check endpoint
        else if (req.method === "GET" && url.pathname === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "healthy",
              transport: "sse",
              port: this.port,
              connections: this.connections.size,
            }),
          );
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      });

      this.server.on("error", reject);
      this.server.listen(this.port, this.host, () => {
        console.log(
          `SSE MCP Server listening on http://${this.host}:${this.port}`,
        );
        console.log(`- SSE endpoint: http://${this.host}:${this.port}/sse`);
        console.log(
          `- Messages endpoint: http://${this.host}:${this.port}/messages`,
        );
        console.log(`- Health check: http://${this.host}:${this.port}/health`);
        resolve();
      });
    });
  }

  private async handleSSEConnection(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      // Create a new transport for this connection
      const transport = new SSEServerTransport("/messages", res);

      // Don't call transport.start() here - Server.connect() will do it automatically

      // Extract session ID from the transport (this is set by the SDK)
      // We'll need to track this for routing POST messages
      const sessionId = this.extractSessionId(transport);

      if (sessionId) {
        this.connections.set(sessionId, { transport, sessionId });
        console.log(`New SSE connection established: ${sessionId}`);
      }

      // Notify that a new connection is ready
      // The callback should call Server.connect() which will start the transport
      if (this.onConnectionCallback) {
        await this.onConnectionCallback(transport);
      }

      // Clean up on connection close
      req.on("close", () => {
        if (sessionId) {
          this.connections.delete(sessionId);
          console.log(`SSE connection closed: ${sessionId}`);
        }
      });
    } catch (error) {
      console.error("Error handling SSE connection:", error);
      // Don't write headers if SSE has already started
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  }

  private async handlePostMessage(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);
      const sessionId = url.searchParams.get("sessionId");

      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId parameter" }));
        return;
      }

      const connection = this.connections.get(sessionId);
      if (!connection) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid sessionId" }));
        return;
      }

      // Let the transport handle the message
      await connection.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling POST message:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  private extractSessionId(transport: SSEServerTransport): string | null {
    // The SSEServerTransport generates a session ID internally
    // We need to extract it from the transport instance
    // This is a bit of a hack, but necessary for routing
    try {
      // Access the private _sessionId property
      return (transport as any)._sessionId || null;
    } catch {
      return null;
    }
  }

  // This method allows the TransportManager to set up a callback
  // for when new connections are established
  onConnection(callback: (transport: Transport) => Promise<void>): void {
    this.onConnectionCallback = callback;
  }

  // Get the first available transport (for backward compatibility)
  getTransport(): Transport {
    const firstConnection = this.connections.values().next().value;
    if (!firstConnection) {
      throw new Error(
        "No SSE connections available. Waiting for client connection...",
      );
    }
    return firstConnection.transport;
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all active connections
      for (const connection of this.connections.values()) {
        try {
          // The transport will close the SSE stream
          (connection.transport as any).close();
        } catch (error) {
          console.error("Error closing connection:", error);
        }
      }
      this.connections.clear();

      if (this.server) {
        this.server.close(() => {
          console.log("SSE MCP Server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
