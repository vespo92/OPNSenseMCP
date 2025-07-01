export type TransportType = "stdio" | "sse";

export interface TransportOptions {
  port?: number;
  host?: string;
  corsOrigin?: string;
}
