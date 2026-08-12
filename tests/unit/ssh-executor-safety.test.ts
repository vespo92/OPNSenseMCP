/**
 * Unit tests for SSHExecutor's dry-run / read-only safety gating.
 *
 * The SSH executor is a separate blast-radius surface from the OPNsense API
 * client: it runs whitelisted shell commands (including `rm`, `pfctl`,
 * `configctl`, `service`) directly on the router over SSH. OPNSENSE_DRY_RUN
 * and OPNSENSE_READ_ONLY must stop anything but a small set of known
 * read-only commands from ever reaching the SSH connection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
}

class FakeSSHClient extends EventEmitter {
  connect = vi.fn(() => {
    // Simulate an async, successful SSH handshake.
    setImmediate(() => this.emit('ready'));
    return this;
  });
  exec = vi.fn((_command: string, cb: (err: Error | undefined, stream: FakeStream) => void) => {
    const stream = new FakeStream();
    cb(undefined, stream);
    setImmediate(() => {
      stream.emit('data', Buffer.from('ok'));
      stream.emit('close', 0, undefined);
    });
  });
  end = vi.fn();
}

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(function (this: any) {
    return new FakeSSHClient();
  }),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, OPNSENSE_SSH_HOST: 'opnsense.example.test', OPNSENSE_SSH_PASSWORD: 'x' };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('SSHExecutor read-only mode', () => {
  it('blocks a mutating command without opening an SSH connection', async () => {
    process.env.OPNSENSE_READ_ONLY = 'true';
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('pfctl -d'); // disables the firewall — must never run

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/read-only mode/i);
    expect(result.exitCode).toBe(1);
  });

  it('blocks rm even though it is on the base command whitelist', async () => {
    process.env.OPNSENSE_READ_ONLY = 'true';
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('rm /conf/config.xml');

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/read-only mode/i);
  });

  it('still allows a known read-only diagnostic command through', async () => {
    process.env.OPNSENSE_READ_ONLY = 'true';
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('netstat -rn');

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });
});

describe('SSHExecutor dry-run mode', () => {
  it('simulates a mutating command instead of running it', async () => {
    process.env.OPNSENSE_DRY_RUN = 'true';
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('configctl filter reload');

    expect(result.success).toBe(true); // simulated success, not a real failure
    expect(result.stdout).toMatch(/DRY RUN/);
    expect(result.stdout).toContain('configctl filter reload');
  });

  it('still allows a known read-only diagnostic command through', async () => {
    process.env.OPNSENSE_DRY_RUN = 'true';
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('pfctl -s rules');

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('ok'); // came from the fake SSH stream, i.e. it really "ran"
  });
});

describe('SSHExecutor normal mode (regression)', () => {
  it('runs a whitelisted mutating command as before', async () => {
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('configctl filter reload');

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('ok');
  });

  it('still rejects a command outside the base whitelist', async () => {
    const { SSHExecutor } = await import('../../src/resources/ssh/executor.js');
    const executor = new SSHExecutor();

    const result = await executor.execute('shutdown -r now');

    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/not in whitelist/i);
  });
});
