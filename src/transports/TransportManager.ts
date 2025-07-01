import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { TransportType, TransportOptions } from "./types.js";
import { SSETransportServer } from "./SSETransportServer.js";

export class TransportManager {
  static sseServer: SSETransportServer | null = null;

  static async createTransport(
    type: TransportType,
    options: TransportOptions = {},
  ): Promise<Transport | SSETransportServer> {
    switch (type) {
      case "stdio":
        return new StdioServerTransport();

      case "sse":
        // For SSE, we return the server itself which will handle connections
        this.sseServer = new SSETransportServer(options);
        await this.sseServer.start();
        return this.sseServer;

      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }

  static getTransportType(): TransportType {
    const args = process.argv.slice(2);
    const transportIndex = args.indexOf("--transport");

    if (transportIndex !== -1 && args[transportIndex + 1]) {
      const transport = args[transportIndex + 1] as TransportType;
      if (transport === "stdio" || transport === "sse") {
        return transport;
      }
    }

    return (process.env.MCP_TRANSPORT as TransportType) || "stdio";
  }

  static getTransportOptions(): TransportOptions {
    const args = process.argv.slice(2);
    const options: TransportOptions = {};

    const portIndex = args.indexOf("--port");
    if (portIndex !== -1 && args[portIndex + 1]) {
      options.port = parseInt(args[portIndex + 1], 10);
    } else if (process.env.MCP_SSE_PORT) {
      options.port = parseInt(process.env.MCP_SSE_PORT, 10);
    }

    const hostIndex = args.indexOf("--host");
    if (hostIndex !== -1 && args[hostIndex + 1]) {
      options.host = args[hostIndex + 1];
    } else if (process.env.MCP_SSE_HOST) {
      options.host = process.env.MCP_SSE_HOST;
    }

    options.corsOrigin = process.env.MCP_CORS_ORIGIN || "*";

    return options;
  }
}
