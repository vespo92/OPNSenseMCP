/**
 * Regression tests for the MCP transport architecture fix.
 *
 * Background: SSETransportServer previously connected every HTTP/SSE client
 * to a single shared Server (Protocol) instance. The SDK only permits one
 * transport per Server, so the second connection (or even the second
 * request of the first Streamable HTTP session, due to a related session-id
 * timing bug) threw "Already connected to a transport" and surfaced as a
 * 500. The fix: each HTTP/SSE connection now gets its own Server instance
 * (OPNSenseMCPServer.createMcpServer()); stdio keeps a single instance.
 *
 * These are live integration tests: they spawn the real compiled server and
 * exercise it against the real OPNsense API (matching this project's
 * existing tests/integration/*-live-test.mjs convention). They need
 * OPNSENSE_HOST / OPNSENSE_API_KEY / OPNSENSE_API_SECRET in the environment
 * (source .env before running) and are skipped otherwise.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SERVER_ENTRY = join(REPO_ROOT, 'dist', 'index.js');

const HAVE_LIVE_CREDS = Boolean(
  process.env.OPNSENSE_HOST &&
    process.env.OPNSENSE_API_KEY &&
    process.env.OPNSENSE_API_SECRET,
);

const maybeDescribe = HAVE_LIVE_CREDS ? describe : describe.skip;

function waitForLog(
  child: ChildProcessWithoutNullStreams,
  pattern: string,
  timeoutMs = 8000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for log: ${pattern}`)),
      timeoutMs,
    );
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes(pattern)) {
        clearTimeout(timer);
        child.stderr.off('data', onData);
        resolve();
      }
    };
    child.stderr.on('data', onData);
  });
}

async function jsonRpc(
  baseUrl: string,
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
  id: number | undefined = 1,
): Promise<{ status: number; body: any; sessionId: string | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const payload =
    id === undefined
      ? { jsonrpc: '2.0', method, params }
      : { jsonrpc: '2.0', id, method, params };

  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const newSessionId = res.headers.get('mcp-session-id');
  const text = await res.text();
  const match = text.match(/data:\s*(\{.*\})/s);
  let body: any;
  try {
    body = JSON.parse(match ? match[1] : text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body, sessionId: newSessionId };
}

async function openSession(baseUrl: string, clientName: string) {
  const init = await jsonRpc(
    baseUrl,
    'initialize',
    {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: clientName, version: '1.0.0' },
    },
    undefined,
    1,
  );
  expect(init.status).toBe(200);
  expect(init.sessionId).toBeTruthy();
  const sessionId = init.sessionId!;
  await jsonRpc(baseUrl, 'notifications/initialized', {}, sessionId, undefined);
  return sessionId;
}

maybeDescribe('MCP transport lifecycle (Streamable HTTP)', () => {
  const PORT = 3098;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  let child: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    child = spawn('node', [SERVER_ENTRY], {
      env: {
        ...process.env,
        MCP_TRANSPORT: 'sse',
        MCP_SSE_HOST: '127.0.0.1',
        MCP_SSE_PORT: String(PORT),
      },
    });
    await waitForLog(child, 'Waiting for client connections');
  });

  afterAll(() => {
    child.kill();
  });

  it('supports multiple concurrent HTTP sessions without "Already connected" errors', async () => {
    const sessionIds = await Promise.all([
      openSession(BASE_URL, 'concurrent-1'),
      openSession(BASE_URL, 'concurrent-2'),
      openSession(BASE_URL, 'concurrent-3'),
    ]);

    // Every session must be distinct - proves independent Server instances.
    expect(new Set(sessionIds).size).toBe(3);

    const results = await Promise.all(
      sessionIds.map((sid) => jsonRpc(BASE_URL, 'tools/list', {}, sid, 2)),
    );

    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.body.error).toBeUndefined();
      expect(Array.isArray(result.body.result?.tools)).toBe(true);
      expect(result.body.result.tools.length).toBeGreaterThan(50);
    }
  });

  it('supports multiple sequential tool calls within one session', async () => {
    const sessionId = await openSession(BASE_URL, 'multi-call-session');

    const list = await jsonRpc(BASE_URL, 'tools/list', {}, sessionId, 2);
    expect(list.status).toBe(200);
    expect(list.body.error).toBeUndefined();

    const call1 = await jsonRpc(
      BASE_URL,
      'tools/call',
      { name: 'list_vlans', arguments: {} },
      sessionId,
      3,
    );
    expect(call1.status).toBe(200);
    expect(call1.body.error).toBeUndefined();
    expect(call1.body.result?.content).toBeDefined();

    const call2 = await jsonRpc(
      BASE_URL,
      'tools/call',
      { name: 'list_firewall_rules', arguments: {} },
      sessionId,
      4,
    );
    expect(call2.status).toBe(200);
    expect(call2.body.error).toBeUndefined();
    expect(call2.body.result?.content).toBeDefined();
  });

  it('supports reconnect: terminating a session then opening a new one both work', async () => {
    const sessionId = await openSession(BASE_URL, 'reconnect-original');

    const del = await fetch(`${BASE_URL}/mcp`, {
      method: 'DELETE',
      headers: { 'mcp-session-id': sessionId },
    });
    expect(del.status).toBe(200);

    // The deleted session must no longer be usable.
    const afterDelete = await jsonRpc(BASE_URL, 'tools/list', {}, sessionId, 5);
    expect(afterDelete.status).toBe(400);

    // A brand new session opened afterward must work - proves the
    // singleton-Server bug (which broke every 2nd+ connection) is fixed.
    const newSessionId = await openSession(BASE_URL, 'reconnect-new');
    expect(newSessionId).not.toBe(sessionId);

    const afterReconnect = await jsonRpc(
      BASE_URL,
      'tools/list',
      {},
      newSessionId,
      6,
    );
    expect(afterReconnect.status).toBe(200);
    expect(afterReconnect.body.error).toBeUndefined();
    expect(afterReconnect.body.result.tools.length).toBeGreaterThan(50);
  });
});

maybeDescribe('MCP transport lifecycle (legacy SSE)', () => {
  const PORT = 3097;
  const BASE_URL = `http://127.0.0.1:${PORT}`;
  let child: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    child = spawn('node', [SERVER_ENTRY], {
      env: {
        ...process.env,
        MCP_TRANSPORT: 'sse',
        MCP_SSE_HOST: '127.0.0.1',
        MCP_SSE_PORT: String(PORT),
      },
    });
    await waitForLog(child, 'Waiting for client connections');
  });

  afterAll(() => {
    child.kill();
  });

  async function legacySseRoundTrip(clientName: string): Promise<number> {
    const sseRes = await fetch(`${BASE_URL}/sse`, {
      headers: { Accept: 'text/event-stream' },
    });
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let sessionId: string | null = null;
    const pending = new Map<number, (msg: any) => void>();

    const pump = (async () => {
      while (true) {
        const { done, value } = await reader.read().catch(() => ({
          done: true,
          value: undefined,
        }));
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = chunk.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (event === 'endpoint') {
            sessionId = new URL(data, BASE_URL).searchParams.get('sessionId');
          } else {
            try {
              const msg = JSON.parse(data);
              if (msg.id !== undefined && pending.has(msg.id)) {
                pending.get(msg.id)!(msg);
                pending.delete(msg.id);
              }
            } catch {
              /* ignore non-JSON keepalive frames */
            }
          }
        }
      }
    })();
    void pump;

    // Wait for the endpoint event (session established).
    const deadline = Date.now() + 5000;
    while (!sessionId && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    if (!sessionId) throw new Error(`${clientName}: SSE session never established`);

    let nextId = 1;
    async function call(method: string, params: Record<string, unknown>) {
      const id = nextId++;
      const done = new Promise((resolve) => pending.set(id, resolve));
      await fetch(`${BASE_URL}/messages?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      return done as Promise<any>;
    }

    await call('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: clientName, version: '1.0.0' },
    });
    const tools = await call('tools/list', {});
    return (tools.result?.tools ?? []).length;
  }

  it('supports two sequential legacy SSE connections (the original crash scenario)', async () => {
    const count1 = await legacySseRoundTrip('legacy-sse-1');
    expect(count1).toBeGreaterThan(50);

    const count2 = await legacySseRoundTrip('legacy-sse-2');
    expect(count2).toBeGreaterThan(50);
    expect(count2).toBe(count1);
  });
});

maybeDescribe('MCP transport lifecycle (stdio)', () => {
  let child: ChildProcessWithoutNullStreams;
  const pending = new Map<number, (msg: any) => void>();
  let nextId = 1;

  beforeAll(async () => {
    child = spawn('node', [SERVER_ENTRY], {
      env: { ...process.env, MCP_TRANSPORT: undefined },
    });
    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)!(msg);
          pending.delete(msg.id);
        }
      } catch {
        /* ignore non-JSON-RPC stderr-ish noise on stdout, if any */
      }
    });
    await waitForLog(child, 'running on stdio');
  });

  afterAll(() => {
    child.kill();
  });

  function send(method: string, params: Record<string, unknown>, id?: number) {
    const payload =
      id === undefined
        ? { jsonrpc: '2.0', method, params }
        : { jsonrpc: '2.0', id, method, params };
    child.stdin.write(JSON.stringify(payload) + '\n');
    if (id === undefined) return Promise.resolve(null);
    return new Promise((resolve) => pending.set(id, resolve));
  }

  it('still works after the transport refactor: tool discovery and tool calls over stdio', async () => {
    const init: any = await send(
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'stdio-regression', version: '1.0.0' },
      },
      nextId++,
    );
    expect(init.result?.serverInfo?.name).toBe('opnsense-mcp');

    await send('notifications/initialized', {});

    const tools: any = await send('tools/list', {}, nextId++);
    expect(tools.result.tools.length).toBeGreaterThan(50);
    expect(tools.result.tools.some((t: any) => t.name === 'list_vlans')).toBe(
      true,
    );

    const call: any = await send(
      'tools/call',
      { name: 'list_vlans', arguments: {} },
      nextId++,
    );
    expect(call.error).toBeUndefined();
    expect(call.result?.content).toBeDefined();
  });
});
