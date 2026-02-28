export type TransportType = "stdio" | "sse" | "streamable-http";

export interface TransportOptions {
  port?: number;
  host?: string;
  corsOrigin?: string;
}
